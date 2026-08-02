/**
 * In-process WHO job worker.
 * Claims queued who.lookup jobs, runs who(), writes dossier + audit.
 */

import type { CaspaJob } from '@ocrowley/jobs';
import { setConfig } from '@ocrowley/persistence';
import { who, type WhoHints } from '../who.js';
import { assertOsintAllowed } from '../policy.js';
import { dossierFromWhoResult } from '../dossier/fromWhoResult.js';
import { writeDossier } from '../dossier/dossierStore.js';
import { appendWhoAudit } from '../audit/whoAudit.js';
import { WHO_JOB_TYPE, type WhoJobPayload, type WhoJobResult } from './whoJobTypes.js';
import { whoJobService } from './whoJobService.js';

export interface WhoWorkerOptions {
  /** Poll interval when idle (ms). Default 750. */
  pollMs?: number;
  /** Stop after this many processed jobs (tests). */
  maxJobs?: number;
  /** Abort signal / stop flag. */
  shouldStop?: () => boolean;
}

let running = false;
let stopRequested = false;
let loopPromise: Promise<void> | null = null;

export function isWhoWorkerRunning(): boolean {
  return running;
}

export function requestWhoWorkerStop(): void {
  stopRequested = true;
}

/** Configure persistence root from OCROWLEY_DATA_DIR if set. */
export function ensureWhoDataDir(): void {
  const dir = process.env.OCROWLEY_DATA_DIR || process.env.DATA_DIR;
  if (dir) setConfig({ dataDir: dir });
}

export async function processWhoJob(job: CaspaJob): Promise<CaspaJob> {
  const jobs = whoJobService();
  const payload = job.input as unknown as WhoJobPayload;
  const actorId = payload.actorId || job.userId || process.env.OCROWLEY_OSINT_ACTOR || 'local';
  const caseRef = String(payload.caseRef || job.projectId || '').trim();

  try {
    await jobs.startStage(job.id, 'policy');
    assertOsintAllowed('enrich.person', {
      actorId,
      roles: ['osint-operator'],
      authorizationRef: caseRef,
      purpose: process.env.OCROWLEY_OSINT_PURPOSE || 'authorised people research',
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    });
    await appendWhoAudit({
      actorId,
      action: 'who.requested',
      resourceType: 'who.job',
      resourceId: job.id,
      metadata: { q: payload.q, caseRef },
    });
    await jobs.completeStage(job.id, 'policy', { caseRef });

    await jobs.startStage(job.id, 'discover');
    const hints: WhoHints = {
      case: caseRef,
      deep: payload.deep,
      full: payload.full,
      archive: payload.archive !== false,
      at: payload.at,
      in: payload.in,
      email: payload.email,
      username: payload.username,
      phone: payload.phone,
      aka: payload.aka,
      country: payload.country,
      enableCliTools: payload.enableCliTools,
    };
    const result = await who(payload.q, hints);
    await jobs.completeStage(job.id, 'discover', {
      name: result.name,
      stats: result.stats,
      toolsUsed: result.toolsUsed,
    });

    await jobs.startStage(job.id, 'dossier');
    const dossier = dossierFromWhoResult(result, caseRef);
    const stored = await writeDossier({
      caseRef,
      dossier,
      jobId: job.id,
      archiveId: result.archiveId,
    });
    await appendWhoAudit({
      actorId,
      action: 'dossier.written',
      resourceType: 'who.dossier',
      resourceId: stored.id,
      metadata: { caseRef, entityId: stored.entityId, jobId: job.id },
    });
    await jobs.completeStage(job.id, 'dossier', { dossierId: stored.id });

    await jobs.startStage(job.id, 'audit');
    const completed = await appendWhoAudit({
      actorId,
      action: 'who.completed',
      resourceType: 'who.job',
      resourceId: job.id,
      metadata: {
        caseRef,
        dossierId: stored.id,
        archiveId: result.archiveId,
        confirmed: result.stats.confirmed,
        checked: result.stats.checked,
      },
    });
    await jobs.completeStage(job.id, 'audit', { auditSequence: completed.sequence });

    const jobResult: WhoJobResult = {
      who: {
        q: result.q,
        name: result.name,
        next: result.next,
        stats: result.stats,
        toolsUsed: result.toolsUsed,
        archiveId: result.archiveId,
        recursive: result.recursive,
      },
      dossierId: stored.id,
      auditSequence: completed.sequence,
      warning: result.warning,
    };
    const done = await jobs.complete(job.id, jobResult);
    return done ?? job;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const denied = /denied|authorization|case/i.test(message);
    try {
      await appendWhoAudit({
        actorId,
        action: denied ? 'who.denied' : 'who.failed',
        resourceType: 'who.job',
        resourceId: job.id,
        metadata: { caseRef, error: message },
      });
    } catch {
      // audit sink must not mask the original failure
    }
    const failed = await jobs.markFailed(job.id, message);
    return failed ?? job;
  }
}

export async function claimNextWhoJob(): Promise<CaspaJob | null> {
  const jobs = whoJobService();
  const queued = (await jobs.list())
    .filter((j) => j.type === WHO_JOB_TYPE && j.status === 'queued')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const next = queued[0];
  if (!next) return null;
  return jobs.patch(next.id, {
    status: 'running',
    startedAt: next.startedAt ?? new Date().toISOString(),
  });
}

export async function runWhoWorkerOnce(): Promise<CaspaJob | null> {
  ensureWhoDataDir();
  const claimed = await claimNextWhoJob();
  if (!claimed) return null;
  return processWhoJob(claimed);
}

export async function startWhoWorker(opts: WhoWorkerOptions = {}): Promise<void> {
  if (running) return;
  ensureWhoDataDir();
  const jobs = whoJobService();

  // Recover only WHO jobs stuck in running (avoid touching other job types).
  const stuck = (await jobs.list()).filter(
    (j) => j.type === WHO_JOB_TYPE && j.status === 'running',
  );
  for (const job of stuck) {
    await jobs.patch(job.id, {
      status: 'partial',
      error: 'Worker restarted while this job was running — retry to resume.',
      resumeFromStage: job.currentStage,
    });
  }

  running = true;
  stopRequested = false;
  const pollMs = opts.pollMs ?? 750;
  let processed = 0;

  loopPromise = (async () => {
    while (!stopRequested && !(opts.shouldStop?.())) {
      if (opts.maxJobs !== undefined && processed >= opts.maxJobs) break;
      const job = await runWhoWorkerOnce();
      if (job) {
        processed += 1;
        continue;
      }
      await sleep(pollMs);
    }
  })().finally(() => {
    running = false;
    loopPromise = null;
  });

  await Promise.resolve();
}

export async function stopWhoWorker(): Promise<void> {
  stopRequested = true;
  if (loopPromise) await loopPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

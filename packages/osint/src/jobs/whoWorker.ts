/**
 * In-process WHO job worker (Phase 2: leases + SSE progress).
 */

import { generateId, setConfig } from '@ocrowley/persistence';
import type { CaspaJob } from '@ocrowley/jobs';
import { who, type WhoHints } from '../who.js';
import { assertOsintAllowed } from '../policy.js';
import { dossierFromWhoResult } from '../dossier/fromWhoResult.js';
import { writeDossier } from '../dossier/dossierStore.js';
import { upsertEntityIndex } from '../dossier/entityIndex.js';
import { appendWhoAudit } from '../audit/whoAudit.js';
import { WHO_JOB_TYPE, type WhoJobPayload, type WhoJobResult } from './whoJobTypes.js';
import { whoJobService } from './whoJobService.js';
import { publishWhoProgress } from './whoProgress.js';

export interface WhoWorkerOptions {
  pollMs?: number;
  maxJobs?: number;
  shouldStop?: () => boolean;
  /** Lease duration ms (default 90s). */
  leaseMs?: number;
  /** Worker identity (default random). */
  workerId?: string;
}

let running = false;
let stopRequested = false;
let loopPromise: Promise<void> | null = null;
let workerId = '';

const DEFAULT_LEASE_MS = 90_000;

export function isWhoWorkerRunning(): boolean {
  return running;
}

export function getWhoWorkerId(): string {
  return workerId;
}

export function requestWhoWorkerStop(): void {
  stopRequested = true;
}

export function ensureWhoDataDir(): void {
  const dir = process.env.OCROWLEY_DATA_DIR || process.env.DATA_DIR;
  if (dir) setConfig({ dataDir: dir });
}

async function stage(
  jobId: string,
  stageId: string,
  label: string,
  work: () => Promise<unknown>,
): Promise<unknown> {
  const jobs = whoJobService();
  const current = await jobs.get(jobId);
  if (current?.status === 'cancelled') {
    throw Object.assign(new Error('Job cancelled'), { statusCode: 409, cancelled: true });
  }
  await jobs.startStage(jobId, stageId);
  publishWhoProgress(jobId, 'stage', { stage: stageId, label, status: 'running' });
  await jobs.heartbeatLease(jobId, workerId, DEFAULT_LEASE_MS);
  const partial = await work();
  const after = await jobs.get(jobId);
  if (after?.status === 'cancelled') {
    throw Object.assign(new Error('Job cancelled'), { statusCode: 409, cancelled: true });
  }
  await jobs.completeStage(jobId, stageId, partial);
  publishWhoProgress(jobId, 'stage', { stage: stageId, label, status: 'completed', partial });
  return partial;
}

export async function processWhoJob(job: CaspaJob): Promise<CaspaJob> {
  const jobs = whoJobService();
  const payload = job.input as unknown as WhoJobPayload;
  const actorId = payload.actorId || job.userId || process.env.OCROWLEY_OSINT_ACTOR || 'local';
  const caseRef = String(payload.caseRef || job.projectId || '').trim();

  try {
    await stage(job.id, 'policy', 'Authorize case', async () => {
      assertOsintAllowed('enrich.person', {
        actorId,
        roles: ['osint-operator'],
        authorizationRef: caseRef,
        purpose: process.env.OCROWLEY_OSINT_PURPOSE || 'authorised people research',
        environment:
          (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      });
      await appendWhoAudit({
        actorId,
        action: 'who.requested',
        resourceType: 'who.job',
        resourceId: job.id,
        metadata: { q: payload.q, caseRef },
      });
      return { caseRef };
    });

    publishWhoProgress(job.id, 'progress', {
      percent: 25,
      message: 'Running who() discover',
    });

    let whoResult!: Awaited<ReturnType<typeof who>>;
    await stage(job.id, 'discover', 'Run who()', async () => {
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
      await jobs.heartbeatLease(job.id, workerId, DEFAULT_LEASE_MS);
      whoResult = await who(payload.q, hints);
      publishWhoProgress(job.id, 'progress', {
        percent: 70,
        message: 'Discover finished',
        stats: whoResult.stats,
        toolsUsed: whoResult.toolsUsed,
      });
      return {
        name: whoResult.name,
        stats: whoResult.stats,
        toolsUsed: whoResult.toolsUsed,
      };
    });

    publishWhoProgress(job.id, 'progress', { percent: 80, message: 'Writing dossier' });
    const stored = (await stage(job.id, 'dossier', 'Write dossier', async () => {
      const dossier = dossierFromWhoResult(whoResult, caseRef);
      const written = await writeDossier({
        caseRef,
        dossier,
        jobId: job.id,
        archiveId: whoResult.archiveId,
      });
      await upsertEntityIndex({
        caseRef,
        entityId: written.entityId,
        value: dossier.entity.value,
        type: String(dossier.entity.type),
        dossierId: written.id,
        jobId: job.id,
        stats: whoResult.stats,
      });
      await appendWhoAudit({
        actorId,
        action: 'dossier.written',
        resourceType: 'who.dossier',
        resourceId: written.id,
        metadata: { caseRef, entityId: written.entityId, jobId: job.id },
      });
      return { dossierId: written.id, entityId: written.entityId };
    })) as { dossierId: string; entityId: string };

    const completed = (await stage(job.id, 'audit', 'Append audit', async () => {
      const entry = await appendWhoAudit({
        actorId,
        action: 'who.completed',
        resourceType: 'who.job',
        resourceId: job.id,
        metadata: {
          caseRef,
          dossierId: stored.dossierId,
          archiveId: whoResult.archiveId,
          confirmed: whoResult.stats.confirmed,
          checked: whoResult.stats.checked,
        },
      });
      return { auditSequence: entry.sequence };
    })) as { auditSequence: number };

    const jobResult: WhoJobResult = {
      who: {
        q: whoResult.q,
        name: whoResult.name,
        next: whoResult.next,
        stats: whoResult.stats,
        toolsUsed: whoResult.toolsUsed,
        archiveId: whoResult.archiveId,
        recursive: whoResult.recursive,
      },
      dossierId: stored.dossierId,
      auditSequence: completed.auditSequence,
      warning: whoResult.warning,
    };
    const done = await jobs.complete(job.id, jobResult);
    publishWhoProgress(job.id, 'completed', {
      percent: 100,
      result: jobResult,
    });
    return done ?? job;
  } catch (err) {
    const cancelled = Boolean((err as { cancelled?: boolean }).cancelled);
    const message = err instanceof Error ? err.message : String(err);
    if (cancelled) {
      publishWhoProgress(job.id, 'cancelled', { message });
      const cur = await jobs.get(job.id);
      return cur ?? job;
    }
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
      // ignore
    }
    const failed = await jobs.markFailed(job.id, message);
    publishWhoProgress(job.id, 'failed', { message, denied });
    return failed ?? job;
  }
}

export async function claimNextWhoJob(owner = workerId): Promise<CaspaJob | null> {
  const jobs = whoJobService();
  const leaseMs = Number(process.env.OCROWLEY_WHO_LEASE_MS || DEFAULT_LEASE_MS);
  const claimed = await jobs.claimNextJobWithLease({
    owner: owner || 'who-worker',
    leaseMs,
    type: WHO_JOB_TYPE,
  });
  if (claimed) {
    publishWhoProgress(claimed.id, 'claimed', {
      workerId: owner || workerId,
      leaseUntil: claimed.leaseUntil,
    });
  }
  return claimed;
}

export async function runWhoWorkerOnce(): Promise<CaspaJob | null> {
  ensureWhoDataDir();
  if (!workerId) workerId = `who-${generateId().slice(0, 10)}`;
  const claimed = await claimNextWhoJob(workerId);
  if (!claimed) return null;
  return processWhoJob(claimed);
}

export async function startWhoWorker(opts: WhoWorkerOptions = {}): Promise<void> {
  if (running) return;
  ensureWhoDataDir();
  workerId = opts.workerId || `who-${generateId().slice(0, 10)}`;
  const jobs = whoJobService();
  const leaseMs = opts.leaseMs ?? Number(process.env.OCROWLEY_WHO_LEASE_MS || DEFAULT_LEASE_MS);

  // Requeue expired leases as partial for explicit retry; claimNext also reclaims.
  await jobs.recoverStuckJobs({ type: WHO_JOB_TYPE });

  running = true;
  stopRequested = false;
  const pollMs = opts.pollMs ?? 750;
  let processed = 0;

  loopPromise = (async () => {
    while (!stopRequested && !(opts.shouldStop?.())) {
      if (opts.maxJobs !== undefined && processed >= opts.maxJobs) break;
      // keep leases warm is handled per-stage; claim uses leaseMs
      void leaseMs;
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

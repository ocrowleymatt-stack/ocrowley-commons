import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '@ocrowley/persistence';

export type CaspaJobStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial'
  | 'needs-review';

export interface CaspaJobStage {
  id: string;
  label: string;
  status: CaspaJobStatus;
  startedAt?: string;
  completedAt?: string;
  partialResult?: unknown;
}

export interface CaspaJob {
  id: string;
  userId?: string;
  projectId?: string;
  type: string;
  status: CaspaJobStatus;
  currentStage?: string;
  stages: CaspaJobStage[];
  input: Record<string, unknown>;
  result?: unknown;
  partialResult?: unknown;
  error?: string;
  retryCount: number;
  resumeFromStage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  /** Worker that currently holds the lease (Phase 2). */
  leaseOwner?: string;
  /** ISO timestamp when the lease expires; expired running jobs become reclaimable. */
  leaseUntil?: string;
}

const DEFAULT_LEASE_MS = 60_000;

export class CaspaJobService {
  private subPath = 'caspa-jobs';

  async create(input: {
    userId?: string;
    projectId?: string;
    type: string;
    stages: Array<{ id: string; label: string }>;
    payload?: Record<string, unknown>;
  }): Promise<CaspaJob> {
    const now = new Date().toISOString();
    const job: CaspaJob = {
      id: generateId(),
      userId: input.userId,
      projectId: input.projectId,
      type: input.type,
      status: 'queued',
      stages: input.stages.map((s) => ({ ...s, status: 'queued' as CaspaJobStatus })),
      input: input.payload ?? {},
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await writeJsonFile(this.subPath, `${job.id}.json`, job);
    return job;
  }

  async get(id: string): Promise<CaspaJob | null> {
    return readJsonFile<CaspaJob>(this.subPath, `${id}.json`);
  }

  async list(opts?: { projectId?: string; userId?: string; type?: string }): Promise<CaspaJob[]> {
    const files = await listJsonFiles(this.subPath);
    const jobs: CaspaJob[] = [];
    for (const file of files) {
      const job = await readJsonFile<CaspaJob>(this.subPath, file);
      if (!job) continue;
      if (opts?.projectId && job.projectId !== opts.projectId) continue;
      if (opts?.userId && job.userId !== opts.userId) continue;
      if (opts?.type && job.type !== opts.type) continue;
      jobs.push(job);
    }
    return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async patch(id: string, patch: Partial<CaspaJob>): Promise<CaspaJob | null> {
    const current = await this.get(id);
    if (!current) return null;
    const updated: CaspaJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(this.subPath, `${updated.id}.json`, updated);
    return updated;
  }

  async startStage(id: string, stageId: string): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (job.status === 'cancelled') return job;
    const now = new Date().toISOString();
    job.status = 'running';
    job.currentStage = stageId;
    job.startedAt = job.startedAt ?? now;
    job.stages = job.stages.map((s) =>
      s.id === stageId ? { ...s, status: 'running', startedAt: now } : s,
    );
    job.updatedAt = now;
    await writeJsonFile(this.subPath, `${job.id}.json`, job);
    return job;
  }

  async completeStage(id: string, stageId: string, partialResult?: unknown): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (job.status === 'cancelled') return job;
    const now = new Date().toISOString();
    job.stages = job.stages.map((s) =>
      s.id === stageId
        ? { ...s, status: 'completed', completedAt: now, partialResult }
        : s,
    );
    job.partialResult = partialResult ?? job.partialResult;
    job.updatedAt = now;
    await writeJsonFile(this.subPath, `${job.id}.json`, job);
    return job;
  }

  async complete(id: string, result: unknown): Promise<CaspaJob | null> {
    return this.patch(id, {
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
      leaseOwner: undefined,
      leaseUntil: undefined,
    });
  }

  async fail(id: string, error: string): Promise<CaspaJob | null> {
    return this.patch(id, {
      status: 'partial',
      error,
      resumeFromStage: (await this.get(id))?.currentStage,
      leaseOwner: undefined,
      leaseUntil: undefined,
    });
  }

  async markFailed(id: string, error: string): Promise<CaspaJob | null> {
    return this.patch(id, {
      status: 'failed',
      error,
      resumeFromStage: (await this.get(id))?.currentStage,
      completedAt: new Date().toISOString(),
      leaseOwner: undefined,
      leaseUntil: undefined,
    });
  }

  async cancel(id: string, reason = 'Cancelled by operator'): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (['completed', 'cancelled'].includes(job.status)) return job;
    return this.patch(id, {
      status: 'cancelled',
      error: reason,
      cancelledAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      leaseOwner: undefined,
      leaseUntil: undefined,
    });
  }

  /** True when a running job's lease is missing or past. */
  isLeaseExpired(job: CaspaJob, nowMs = Date.now()): boolean {
    if (job.status !== 'running') return false;
    if (!job.leaseUntil) return true;
    return Date.parse(job.leaseUntil) <= nowMs;
  }

  /**
   * Claim the oldest queued job (optionally filtered by type) with a lease.
   * Also reclaims running jobs whose lease has expired.
   */
  async claimNextJobWithLease(opts: {
    owner: string;
    leaseMs?: number;
    type?: string;
  }): Promise<CaspaJob | null> {
    const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
    const now = Date.now();
    const leaseUntil = new Date(now + leaseMs).toISOString();
    const jobs = await this.list(opts.type ? { type: opts.type } : undefined);

    // Prefer queued; else reclaim expired leases.
    const candidates = [...jobs]
      .filter((job) => {
        if (opts.type && job.type !== opts.type) return false;
        if (job.status === 'queued') return true;
        if (job.status === 'running' && this.isLeaseExpired(job, now)) return true;
        return false;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const next = candidates[0];
    if (!next) return null;

    // Optimistic check — re-read before write
    const fresh = await this.get(next.id);
    if (!fresh) return null;
    if (fresh.status === 'queued' || (fresh.status === 'running' && this.isLeaseExpired(fresh, now))) {
      return this.patch(fresh.id, {
        status: 'running',
        startedAt: fresh.startedAt ?? new Date(now).toISOString(),
        leaseOwner: opts.owner,
        leaseUntil,
        error: fresh.status === 'running' ? undefined : fresh.error,
      });
    }
    return null;
  }

  async heartbeatLease(
    id: string,
    owner: string,
    leaseMs = DEFAULT_LEASE_MS,
  ): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (job.status !== 'running') return job;
    if (job.leaseOwner && job.leaseOwner !== owner) return null;
    return this.patch(id, {
      leaseOwner: owner,
      leaseUntil: new Date(Date.now() + leaseMs).toISOString(),
    });
  }

  async claimNextJob(): Promise<CaspaJob | null> {
    return this.claimNextJobWithLease({ owner: 'anonymous', leaseMs: DEFAULT_LEASE_MS });
  }

  async recoverStuckJobs(opts?: { type?: string; maxAgeMs?: number }): Promise<number> {
    const jobs = await this.list(opts?.type ? { type: opts.type } : undefined);
    const now = Date.now();
    const maxAgeMs = opts?.maxAgeMs ?? 0;
    let recovered = 0;
    for (const job of jobs) {
      if (job.status !== 'running') continue;
      if (opts?.type && job.type !== opts.type) continue;
      const expired = this.isLeaseExpired(job, now);
      const tooOld =
        maxAgeMs > 0 && job.startedAt
          ? now - Date.parse(job.startedAt) > maxAgeMs
          : false;
      if (!expired && !tooOld) continue;
      await this.patch(job.id, {
        status: 'partial',
        error: 'Lease expired or worker lost — retry to resume.',
        resumeFromStage: job.currentStage,
        leaseOwner: undefined,
        leaseUntil: undefined,
      });
      recovered += 1;
    }
    return recovered;
  }

  async retry(id: string): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (job.status === 'cancelled') return job;
    if (!['failed', 'partial', 'completed'].includes(job.status) && job.status !== 'needs-review') {
      // allow retry of terminal-ish states; leave running alone
      if (job.status === 'running' || job.status === 'queued') return job;
    }
    return this.patch(id, {
      status: 'queued',
      error: undefined,
      retryCount: job.retryCount + 1,
      completedAt: undefined,
      cancelledAt: undefined,
      leaseOwner: undefined,
      leaseUntil: undefined,
      currentStage: undefined,
      stages: job.stages.map((s) => ({
        id: s.id,
        label: s.label,
        status: 'queued' as CaspaJobStatus,
      })),
      result: undefined,
      partialResult: undefined,
      resumeFromStage: undefined,
    });
  }

  async latestForProject(projectId: string): Promise<CaspaJob | null> {
    const jobs = await this.list({ projectId });
    return jobs.find((j) => ['running', 'partial', 'queued', 'needs-review'].includes(j.status)) ?? jobs[0] ?? null;
  }
}

export const caspaJobService = new CaspaJobService();
export { DEFAULT_LEASE_MS };

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
}

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

  async list(opts?: { projectId?: string; userId?: string }): Promise<CaspaJob[]> {
    const files = await listJsonFiles(this.subPath);
    const jobs: CaspaJob[] = [];
    for (const file of files) {
      const job = await readJsonFile<CaspaJob>(this.subPath, file);
      if (!job) continue;
      if (opts?.projectId && job.projectId !== opts.projectId) continue;
      if (opts?.userId && job.userId !== opts.userId) continue;
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
    });
  }

  async fail(id: string, error: string): Promise<CaspaJob | null> {
    return this.patch(id, {
      status: 'partial',
      error,
      resumeFromStage: (await this.get(id))?.currentStage,
    });
  }

  async markFailed(id: string, error: string): Promise<CaspaJob | null> {
    return this.patch(id, {
      status: 'failed',
      error,
      resumeFromStage: (await this.get(id))?.currentStage,
      completedAt: new Date().toISOString(),
    });
  }

  async claimNextJob(): Promise<CaspaJob | null> {
    const jobs = await this.list();
    const next = [...jobs]
      .filter((job) => job.status === 'queued')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return null;
    return this.patch(next.id, {
      status: 'running',
      startedAt: next.startedAt ?? new Date().toISOString(),
    });
  }

  async recoverStuckJobs(): Promise<number> {
    const jobs = await this.list();
    let recovered = 0;
    for (const job of jobs) {
      if (job.status !== 'running') continue;
      await this.patch(job.id, {
        status: 'partial',
        error: 'Server restarted while this job was running — retry to resume.',
        resumeFromStage: job.currentStage,
      });
      recovered += 1;
    }
    return recovered;
  }

  async retry(id: string): Promise<CaspaJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    if (job.status === 'cancelled') return job;
    return this.patch(id, {
      status: 'queued',
      error: undefined,
      retryCount: job.retryCount + 1,
      completedAt: undefined,
    });
  }

  async latestForProject(projectId: string): Promise<CaspaJob | null> {
    const jobs = await this.list({ projectId });
    return jobs.find((j) => ['running', 'partial', 'queued', 'needs-review'].includes(j.status)) ?? jobs[0] ?? null;
  }
}

export const caspaJobService = new CaspaJobService();

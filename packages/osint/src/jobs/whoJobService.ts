import { CaspaJobService, type CaspaJob } from '@ocrowley/jobs';
import { WHO_JOB_STAGES, WHO_JOB_TYPE, type WhoJobPayload } from './whoJobTypes.js';

const jobs = new CaspaJobService();

export function whoJobService(): CaspaJobService {
  return jobs;
}

export async function enqueueWhoJob(payload: WhoJobPayload): Promise<CaspaJob> {
  const q = payload.q.trim();
  if (!q) {
    throw Object.assign(new Error('Missing query'), { statusCode: 400 });
  }
  const caseRef = payload.caseRef.trim();
  if (!caseRef) {
    throw Object.assign(new Error('Case authorization required'), { statusCode: 401 });
  }

  return jobs.create({
    userId: payload.actorId || process.env.OCROWLEY_OSINT_ACTOR || 'local',
    projectId: caseRef,
    type: WHO_JOB_TYPE,
    stages: WHO_JOB_STAGES.map((s) => ({ id: s.id, label: s.label })),
    payload: { ...payload, q, caseRef },
  });
}

export async function getWhoJob(id: string): Promise<CaspaJob | null> {
  const job = await jobs.get(id);
  if (!job || job.type !== WHO_JOB_TYPE) return null;
  return job;
}

export async function listWhoJobs(opts?: {
  caseRef?: string;
  limit?: number;
}): Promise<CaspaJob[]> {
  const all = await jobs.list(
    opts?.caseRef ? { projectId: opts.caseRef } : undefined,
  );
  const filtered = all.filter((j) => j.type === WHO_JOB_TYPE);
  const limit = opts?.limit ?? 40;
  return filtered.slice(0, Math.max(1, limit));
}

export function publicWhoJob(job: CaspaJob) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    caseRef: job.projectId,
    currentStage: job.currentStage,
    stages: job.stages.map((s) => ({
      id: s.id,
      label: s.label,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    })),
    input: {
      q: job.input.q,
      caseRef: job.input.caseRef,
      full: job.input.full,
      deep: job.input.deep,
    },
    result: job.result,
    error: job.error,
    retryCount: job.retryCount,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

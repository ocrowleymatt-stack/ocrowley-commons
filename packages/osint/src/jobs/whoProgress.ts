import { sseBroadcaster } from '@ocrowley/jobs';

export type WhoProgressEvent =
  | 'queued'
  | 'claimed'
  | 'stage'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export function whoJobChannel(jobId: string): string {
  return `who.job.${jobId}`;
}

export function publishWhoProgress(
  jobId: string,
  event: WhoProgressEvent,
  data: Record<string, unknown>,
): void {
  sseBroadcaster.publish(whoJobChannel(jobId), event, {
    jobId,
    at: new Date().toISOString(),
    ...data,
  });
}

export { sseBroadcaster };

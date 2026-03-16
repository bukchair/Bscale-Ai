import type { JobsOptions } from 'bullmq';
import { getActionsQueue, getSyncQueue } from './queues';
import { JOBS, type SyncJobName } from './job-names';

const oneMinute = 60 * 1000;

const stableJobId = (name: string, parts: Array<string | number | undefined>) =>
  `${name}:${parts.map((part) => String(part ?? '')).join(':')}`;

export const enqueueSyncJob = async (
  name: SyncJobName,
  payload: Record<string, unknown>,
  options?: JobsOptions
) => {
  const queue = name === JOBS.ACTION ? getActionsQueue() : getSyncQueue();
  const defaultJobId = stableJobId(name, [
    (payload.userId as string | undefined) || 'global',
    (payload.connectionId as string | undefined) || 'all',
    Math.floor(Date.now() / oneMinute),
  ]);

  return queue.add(name, payload, {
    jobId: options?.jobId || defaultJobId,
    ...options,
  });
};

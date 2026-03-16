import { QueueEvents, Worker } from 'bullmq';
import { prisma } from '@/src/lib/db/prisma';
import { queueDefaults } from '@/src/lib/sync/queue/queues';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import {
  actionPayloadSchema,
  refreshTokensPayloadSchema,
  snapshotDailyPayloadSchema,
  syncAccountsPayloadSchema,
  syncCampaignsPayloadSchema,
  syncMetricsPayloadSchema,
} from '@/src/lib/sync/queue/payloads';
import { processRefreshTokens } from '@/src/lib/sync/jobs/processors/refreshTokens';
import { processSyncAccounts } from '@/src/lib/sync/jobs/processors/syncAccounts';
import { processSyncCampaigns } from '@/src/lib/sync/jobs/processors/syncCampaigns';
import { processSyncMetrics } from '@/src/lib/sync/jobs/processors/syncMetrics';
import { processSnapshotDaily } from '@/src/lib/sync/jobs/processors/snapshotDaily';
import { processAction } from '@/src/lib/sync/jobs/processors/actions';
import { syncEnv } from '@/src/lib/sync/env';
import { syncRepo } from '@/src/lib/sync/repository/syncRepo';

const startRunForJob = async (bullmqJobId: string) => {
  const syncJob = await prisma.syncJob.findFirst({
    where: { bullmqJobId },
    select: { id: true },
  });
  if (!syncJob) return null;
  return syncRepo.startRun(syncJob.id);
};

const finishRunForJob = async (
  bullmqJobId: string,
  status: 'SUCCESS' | 'FAILED',
  result?: Record<string, unknown>,
  errorMessage?: string
) => {
  const syncJob = await prisma.syncJob.findFirst({
    where: { bullmqJobId },
    select: { id: true },
  });
  if (!syncJob) return;
  const run = await prisma.syncRun.findFirst({
    where: { syncJobId: syncJob.id, status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  if (!run) return;
  await syncRepo.finishRun(run.id, status, result, errorMessage);
};

const handleSyncJob = async (name: string, data: unknown) => {
  if (name === JOBS.REFRESH_TOKENS) return processRefreshTokens(refreshTokensPayloadSchema.parse(data));
  if (name === JOBS.SYNC_ACCOUNTS) return processSyncAccounts(syncAccountsPayloadSchema.parse(data));
  if (name === JOBS.SYNC_CAMPAIGNS) return processSyncCampaigns(syncCampaignsPayloadSchema.parse(data));
  if (name === JOBS.SYNC_METRICS) return processSyncMetrics(syncMetricsPayloadSchema.parse(data));
  if (name === JOBS.SNAPSHOT_DAILY) return processSnapshotDaily(snapshotDailyPayloadSchema.parse(data));
  throw new Error(`Unsupported sync job: ${name}`);
};

const syncWorker = new Worker(
  'bscale-sync',
  async (job) => {
    await startRunForJob(job.id || '');
    try {
      const result = await handleSyncJob(job.name, job.data);
      await finishRunForJob(job.id || '', 'SUCCESS', { result } as Record<string, unknown>);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync job failed.';
      await finishRunForJob(job.id || '', 'FAILED', undefined, message);
      throw error;
    }
  },
  {
    connection: queueDefaults.connection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

const actionsWorker = new Worker(
  'bscale-actions',
  async (job) => {
    await startRunForJob(job.id || '');
    try {
      const payload = actionPayloadSchema.parse(job.data);
      const result = await processAction(payload);
      await finishRunForJob(job.id || '', 'SUCCESS', { result } as Record<string, unknown>);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action job failed.';
      await finishRunForJob(job.id || '', 'FAILED', undefined, message);
      throw error;
    }
  },
  {
    connection: queueDefaults.connection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

const syncEvents = new QueueEvents('bscale-sync', { connection: queueDefaults.connection });
const actionsEvents = new QueueEvents('bscale-actions', { connection: queueDefaults.connection });

syncEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[${syncEnv.WORKER_INSTANCE_ID}] sync job failed`, { jobId, failedReason });
});
actionsEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[${syncEnv.WORKER_INSTANCE_ID}] action job failed`, { jobId, failedReason });
});

console.log(`[${syncEnv.WORKER_INSTANCE_ID}] Sync workers started`);

const shutdown = async () => {
  await Promise.allSettled([
    syncWorker.close(),
    actionsWorker.close(),
    syncEvents.close(),
    actionsEvents.close(),
  ]);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { prisma } from '@/src/lib/db/prisma';
import type { Platform, SyncJobType } from '@/src/lib/integrations/core/types';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';

type CreateSyncJobInput = {
  userId: string;
  platform: Platform;
  connectionId: string;
  type: SyncJobType;
  requestedBy: string;
  bullmqJobId?: string;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledFor?: Date;
};

export const syncRepo = {
  async createQueuedJob(input: CreateSyncJobInput) {
    return prisma.syncJob.create({
      data: {
        userId: input.userId,
        platform: input.platform,
        connectionId: input.connectionId,
        type: input.type,
        status: 'QUEUED',
        requestedBy: input.requestedBy,
        bullmqJobId: input.bullmqJobId,
        payload: input.payload ? toPrismaJson(input.payload) : undefined,
        priority: input.priority,
        scheduledFor: input.scheduledFor,
      },
    });
  },

  async startRun(syncJobId: string) {
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: { status: 'RUNNING' },
    });
    return prisma.syncRun.create({
      data: {
        syncJobId,
        status: 'RUNNING',
      },
    });
  },

  async finishRun(syncRunId: string, status: 'SUCCESS' | 'FAILED', result?: Record<string, unknown>, errorMessage?: string) {
    const run = await prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        completedAt: new Date(),
        resultSummary: result ? toPrismaJson(result) : undefined,
        errorMessage: errorMessage || null,
      },
      include: {
        syncJob: true,
      },
    });
    await prisma.syncJob.update({
      where: { id: run.syncJobId },
      data: {
        status,
      },
    });
    if (status === 'FAILED') {
      await prisma.syncErrorLog.create({
        data: {
          userId: run.syncJob.userId,
          platform: run.syncJob.platform,
          connectionId: run.syncJob.connectionId,
          syncJobId: run.syncJob.id,
          syncRunId: run.id,
          category: 'JOB_FAILED',
          message: errorMessage || 'Sync job failed.',
          details: result ? toPrismaJson(result) : undefined,
        },
      });
      return run;
    }

    await prisma.platformConnection.update({
      where: { id: run.syncJob.connectionId },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
    return run;
  },
};

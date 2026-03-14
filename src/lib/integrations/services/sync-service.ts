import { prisma } from '@/src/lib/db/prisma';
import type { Platform, SyncJobType } from '@/src/lib/integrations/core/types';
import { toPrismaJson } from '@/src/lib/integrations/utils/prisma-json';

type StartSyncJobInput = {
  userId: string;
  platform: Platform;
  connectionId: string;
  type: SyncJobType;
  requestedBy: string;
};

type FinishSyncRunInput = {
  syncRunId: string;
  status: 'SUCCESS' | 'FAILED';
  resultSummary?: Record<string, unknown>;
  errorMessage?: string;
};

export const syncService = {
  async startJob(input: StartSyncJobInput) {
    return prisma.$transaction(async (tx) => {
      const job = await tx.syncJob.create({
        data: {
          userId: input.userId,
          platform: input.platform,
          connectionId: input.connectionId,
          type: input.type,
          status: 'RUNNING',
          requestedBy: input.requestedBy,
        },
      });

      const run = await tx.syncRun.create({
        data: {
          syncJobId: job.id,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      return { job, run };
    });
  },

  async finishRun(input: FinishSyncRunInput) {
    await prisma.$transaction(async (tx) => {
      const run = await tx.syncRun.update({
        where: { id: input.syncRunId },
        data: {
          status: input.status,
          completedAt: new Date(),
          errorMessage: input.errorMessage ?? null,
          resultSummary: input.resultSummary ? toPrismaJson(input.resultSummary) : undefined,
        },
      });

      const syncJob = await tx.syncJob.findUnique({
        where: { id: run.syncJobId },
        select: { connectionId: true },
      });
      if (!syncJob) return;

      await tx.syncJob.update({
        where: { id: run.syncJobId },
        data: {
          status: input.status,
        },
      });

      if (input.status === 'SUCCESS') {
        await tx.platformConnection.update({
          where: { id: syncJob.connectionId },
          data: {
            status: 'CONNECTED',
            lastSyncAt: new Date(),
            lastError: null,
          },
        });
      } else {
        await tx.platformConnection.update({
          where: { id: syncJob.connectionId },
          data: {
            status: 'ERROR',
            lastError: input.errorMessage ?? 'Sync failed',
          },
        });
      }
    });
  },

  async historyForConnection(connectionId: string, limit = 15) {
    return prisma.syncRun.findMany({
      where: { syncJob: { connectionId } },
      include: {
        syncJob: {
          select: {
            id: true,
            platform: true,
            type: true,
            requestedBy: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  },
};

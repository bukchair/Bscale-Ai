import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import { syncEnv } from '@/src/lib/sync/env';
import { syncRepo } from '@/src/lib/sync/repository/syncRepo';

export const runtime = 'nodejs';

const platformSupportsCampaigns = (platform: string) =>
  platform === 'GOOGLE_ADS' || platform === 'META' || platform === 'TIKTOK';

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret') || '';
  if (!syncEnv.CRON_SECRET || secret !== syncEnv.CRON_SECRET) {
    return NextResponse.json({ success: false, message: 'Unauthorized cron request.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = String(url.searchParams.get('type') || '').trim();
  if (!type) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing type query param. Expected one of: refreshTokens,syncAccounts,syncCampaigns,syncMetrics,snapshotDaily',
      },
      { status: 400 }
    );
  }

  const enqueued: Array<{ queueJobId: string; syncJobId: string }> = [];

  if (type === 'refreshTokens') {
    const queueJob = await enqueueSyncJob(JOBS.REFRESH_TOKENS, { scope: 'all', force: false });
    enqueued.push({ queueJobId: String(queueJob.id || ''), syncJobId: '' });
    return NextResponse.json({ success: true, enqueuedCount: enqueued.length, enqueued });
  }

  const connections = await prisma.platformConnection.findMany({
    where: {
      status: { in: ['CONNECTED', 'ERROR', 'EXPIRED'] },
    },
    include: {
      connectedAccounts: {
        where: { status: { in: ['ACTIVE', 'DISABLED'] } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const today = new Date();
  const lookbackStart = new Date(today.getTime() - syncEnv.SYNC_METRICS_DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const startDate = toIsoDate(lookbackStart);
  const endDate = toIsoDate(today);

  for (const connection of connections) {
    if (type === 'syncAccounts') {
      const queueJob = await enqueueSyncJob(JOBS.SYNC_ACCOUNTS, {
        userId: connection.userId,
        connectionId: connection.id,
        platform: connection.platform,
        requestedBy: 'cron',
      });
      const syncJob = await syncRepo.createQueuedJob({
        userId: connection.userId,
        platform: connection.platform as any,
        connectionId: connection.id,
        type: 'SYNC_ACCOUNTS',
        requestedBy: 'cron',
        bullmqJobId: queueJob.id || undefined,
        payload: {
          connectionId: connection.id,
          platform: connection.platform,
        },
      });
      enqueued.push({ queueJobId: String(queueJob.id || ''), syncJobId: syncJob.id });
      continue;
    }

    if (!platformSupportsCampaigns(connection.platform)) {
      continue;
    }

    for (const account of connection.connectedAccounts) {
      if (type === 'syncCampaigns') {
        const payload = {
          userId: connection.userId,
          connectionId: connection.id,
          platform: connection.platform,
          connectedAccountId: account.id,
          fullSync: false,
          requestedBy: 'cron',
        };
        const queueJob = await enqueueSyncJob(JOBS.SYNC_CAMPAIGNS, payload);
        const syncJob = await syncRepo.createQueuedJob({
          userId: connection.userId,
          platform: connection.platform as any,
          connectionId: connection.id,
          type: 'SYNC_CAMPAIGNS',
          requestedBy: 'cron',
          bullmqJobId: queueJob.id || undefined,
          payload,
        });
        enqueued.push({ queueJobId: String(queueJob.id || ''), syncJobId: syncJob.id });
      } else if (type === 'syncMetrics') {
        const payload = {
          userId: connection.userId,
          connectionId: connection.id,
          platform: connection.platform,
          connectedAccountId: account.id,
          range: { startDate, endDate },
          granularity: 'day',
          mode: 'byDate',
          requestedBy: 'cron',
        };
        const queueJob = await enqueueSyncJob(JOBS.SYNC_METRICS, payload);
        const syncJob = await syncRepo.createQueuedJob({
          userId: connection.userId,
          platform: connection.platform as any,
          connectionId: connection.id,
          type: 'SYNC_METRICS',
          requestedBy: 'cron',
          bullmqJobId: queueJob.id || undefined,
          payload,
        });
        enqueued.push({ queueJobId: String(queueJob.id || ''), syncJobId: syncJob.id });
      } else if (type === 'snapshotDaily') {
        const payload = {
          userId: connection.userId,
          date: endDate,
        };
        const queueJob = await enqueueSyncJob(JOBS.SNAPSHOT_DAILY, payload);
        const syncJob = await syncRepo.createQueuedJob({
          userId: connection.userId,
          platform: connection.platform as any,
          connectionId: connection.id,
          type: 'SNAPSHOT_DAILY',
          requestedBy: 'cron',
          bullmqJobId: queueJob.id || undefined,
          payload,
        });
        enqueued.push({ queueJobId: String(queueJob.id || ''), syncJobId: syncJob.id });
      }
    }
  }

  return NextResponse.json({
    success: true,
    type,
    enqueuedCount: enqueued.length,
    enqueued,
  });
}

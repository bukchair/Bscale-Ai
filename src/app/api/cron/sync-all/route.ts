import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { syncEnv } from '@/src/lib/sync/env';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';

const AD_PLATFORMS = ['GOOGLE_ADS', 'META', 'TIKTOK'] as const;
const METRIC_PLATFORMS = [...AD_PLATFORMS, 'GA4', 'SEARCH_CONSOLE'] as const;
type MetricPlatform = (typeof METRIC_PLATFORMS)[number];

function isCronAuthorised(request: Request): boolean {
  const secret = syncEnv.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - syncEnv.SYNC_METRICS_DEFAULT_LOOKBACK_DAYS);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/**
 * POST /api/cron/sync-all
 *
 * For every active connection enqueues:
 *   1. SYNC_CAMPAIGNS (ad platforms only)
 *   2. SYNC_METRICS   (all supported platforms)
 *
 * Called by Vercel Cron once per hour.
 */
export async function POST(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const connections = await prisma.platformConnection.findMany({
    where: {
      status: 'CONNECTED',
      platform: { in: METRIC_PLATFORMS as unknown as MetricPlatform[] },
    },
    include: {
      connectedAccounts: {
        where: { status: { not: 'ARCHIVED' } },
        select: { id: true },
      },
    },
  });

  const { startDate, endDate } = defaultDateRange();
  let campaignJobs = 0;
  let metricJobs = 0;

  for (const connection of connections) {
    if (!connection.userId) continue;
    const platform = connection.platform as MetricPlatform;

    for (const account of connection.connectedAccounts) {
      // SYNC_CAMPAIGNS — ad platforms only
      if ((AD_PLATFORMS as readonly string[]).includes(platform)) {
        await enqueueSyncJob(JOBS.SYNC_CAMPAIGNS, {
          userId: connection.userId,
          connectionId: connection.id,
          platform,
          connectedAccountId: account.id,
          fullSync: false,
          requestedBy: 'cron',
        });
        campaignJobs++;
      }

      // SYNC_METRICS — all metric platforms
      await enqueueSyncJob(JOBS.SYNC_METRICS, {
        userId: connection.userId,
        connectionId: connection.id,
        platform,
        connectedAccountId: account.id,
        range: { startDate, endDate },
        granularity: 'day',
        mode: 'byDate',
        requestedBy: 'cron',
      });
      metricJobs++;
    }
  }

  return NextResponse.json({ queued: true, campaignJobs, metricJobs, connections: connections.length }, { status: 202 });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { syncEnv } from '@/src/lib/sync/env';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';

function isCronAuthorised(request: Request): boolean {
  const secret = syncEnv.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/cron/snapshot-daily
 *
 * Enqueues a SNAPSHOT_DAILY job for every user that has at least one
 * active platform connection.  Runs once per day at midnight UTC.
 */
export async function POST(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const date = yesterday();

  const users = await prisma.user.findMany({
    where: {
      platformConnections: {
        some: { status: 'CONNECTED' },
      },
    },
    select: { id: true },
  });

  for (const user of users) {
    await enqueueSyncJob(JOBS.SNAPSHOT_DAILY, { userId: user.id, date });
  }

  return NextResponse.json({ queued: true, date, users: users.length }, { status: 202 });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/prisma';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import { verifyCronRequest } from '@/src/lib/sync/cron-auth';

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
  if (!(await verifyCronRequest(request))) {
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

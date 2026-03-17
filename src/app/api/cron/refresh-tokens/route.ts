import { NextResponse } from 'next/server';
import { syncEnv } from '@/src/lib/sync/env';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';

function isCronAuthorised(request: Request): boolean {
  const secret = syncEnv.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * POST /api/cron/refresh-tokens
 *
 * Enqueues a single REFRESH_TOKENS job that will refresh every connection
 * that is within 10 minutes of token expiry (or has no refresh token).
 * Called by Vercel Cron every 15 minutes.
 */
export async function POST(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const job = await enqueueSyncJob(JOBS.REFRESH_TOKENS, { scope: 'all', force: false });
  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}

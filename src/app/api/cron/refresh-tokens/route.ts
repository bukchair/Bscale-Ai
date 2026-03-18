import { NextResponse } from 'next/server';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import { verifyCronRequest } from '@/src/lib/sync/cron-auth';

/**
 * POST /api/cron/refresh-tokens
 *
 * Enqueues a single REFRESH_TOKENS job that will refresh every connection
 * that is within 10 minutes of token expiry (or has no refresh token).
 * Called by Vercel Cron every 15 minutes.
 */
export async function POST(request: Request) {
  if (!(await verifyCronRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const job = await enqueueSyncJob(JOBS.REFRESH_TOKENS, { scope: 'all', force: false });
  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}

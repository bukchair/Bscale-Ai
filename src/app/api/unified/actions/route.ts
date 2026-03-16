import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import { actionPayloadSchema } from '@/src/lib/sync/queue/payloads';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ success: false, message: 'Invalid payload.' }, { status: 400 });
  }

  const parsed = actionPayloadSchema.safeParse({
    ...body,
    userId: user.id,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const job = await enqueueSyncJob(JOBS.ACTION, parsed.data);
  return NextResponse.json({
    success: true,
    message: 'Action queued.',
    jobId: job.id || null,
  });
}

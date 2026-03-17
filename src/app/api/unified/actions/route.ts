import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { enqueueSyncJob } from '@/src/lib/sync/queue/enqueue';
import { JOBS } from '@/src/lib/sync/queue/job-names';
import { actionPayloadSchema } from '@/src/lib/sync/queue/payloads';

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const parsed = actionPayloadSchema.safeParse({ ...(body as object), userId: user.id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed.', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const job = await enqueueSyncJob(JOBS.ACTION, parsed.data);

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error: unknown) {
    const status = (error as { statusCode?: number })?.statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Failed to enqueue action.';
    return NextResponse.json({ error: message }, { status });
  }
}

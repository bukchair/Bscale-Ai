import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

// POST /api/user/subscription — allows a user to self-activate demo mode
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { mode?: string };
  try {
    body = (await request.json()) as { mode?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.mode !== 'demo') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'demo', plan: 'demo' },
  });

  return NextResponse.json({ success: true });
}

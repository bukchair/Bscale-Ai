import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { Prisma } from '@prisma/client';

export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionStatus: true, plan: true, trialStartedAt: true, trialEndsAt: true, settings: true },
  });

  return NextResponse.json({ settings: dbUser?.settings ?? {}, subscription: {
    subscriptionStatus: dbUser?.subscriptionStatus,
    plan: dbUser?.plan,
    trialStartedAt: dbUser?.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: dbUser?.trialEndsAt?.toISOString() ?? null,
  }});
}

export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { settings: true },
  });

  const currentSettings = (current?.settings ?? {}) as Record<string, unknown>;
  const merged = { ...currentSettings, ...body };

  await prisma.user.update({
    where: { id: user.id },
    data: { settings: merged as Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true, settings: merged });
}

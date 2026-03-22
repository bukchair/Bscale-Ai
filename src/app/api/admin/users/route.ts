import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

// GET /api/admin/users — list all users (admin only)
export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      subscriptionStatus: true,
      plan: true,
      trialStartedAt: true,
      trialEndsAt: true,
      createdAt: true,
      settings: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users: users.map((u) => ({
    uid: u.id,
    email: u.email,
    name: u.name ?? '',
    role: u.role,
    subscriptionStatus: u.subscriptionStatus,
    plan: u.plan,
    trialStartedAt: u.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    sharedAccess: (u.settings as Record<string, unknown> | null)?.sharedAccess ?? [],
  })) });
}

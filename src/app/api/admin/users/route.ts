import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

async function requireAdmin() {
  const user = await requireAuthenticatedUser();
  if (user.role !== 'admin') throw new Error('Forbidden');
  return user;
}

// GET /api/admin/users — list all users (admin only)
export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
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

// POST /api/admin/users — bulk actions (admin only)
// Body: { action: 'restore_all_to_active' }
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const body = (await request.json()) as { action?: string };

  if (body.action === 'restore_all_to_active') {
    const result = await prisma.user.updateMany({
      where: { subscriptionStatus: { in: ['trial', 'demo'] } },
      data: { subscriptionStatus: 'active', plan: 'pro', trialStartedAt: null, trialEndsAt: null },
    });
    return NextResponse.json({ success: true, updated: result.count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

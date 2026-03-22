import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase();
const TRIAL_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Load full user row including subscription fields
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      subscriptionStatus: true,
      plan: true,
      trialStartedAt: true,
      trialEndsAt: true,
      settings: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isAdmin = dbUser.email.toLowerCase() === ADMIN_EMAIL;

  // Auto-provision trial for new users (first call after signup)
  if (!isAdmin && !dbUser.trialStartedAt && dbUser.subscriptionStatus === 'trial') {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS_MS);
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { trialStartedAt: now, trialEndsAt },
    });
    dbUser.trialStartedAt = now;
    dbUser.trialEndsAt = trialEndsAt;
  }

  // Check trial expiry
  if (!isAdmin && dbUser.subscriptionStatus === 'trial' && dbUser.trialEndsAt) {
    if (dbUser.trialEndsAt.getTime() <= Date.now()) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { subscriptionStatus: 'demo', plan: 'demo' },
      });
      dbUser.subscriptionStatus = 'demo';
      dbUser.plan = 'demo';
    }
  }

  // Resolve workspace scope from Prisma SharedAccess
  let ownerUserId = dbUser.id;
  let accessMode: 'owner' | 'shared' = 'owner';
  let sharedRole: string | undefined;
  let ownerName: string | undefined;
  let ownerEmail: string | undefined;

  try {
    const sharedAccess = await prisma.sharedAccess.findFirst({
      where: { invitedEmail: dbUser.email.toLowerCase(), status: 'accepted' },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    if (sharedAccess) {
      ownerUserId = sharedAccess.ownerUserId;
      accessMode = 'shared';
      sharedRole = sharedAccess.role;
      ownerName = sharedAccess.owner.name ?? undefined;
      ownerEmail = sharedAccess.owner.email;
    }
  } catch {
    // fallback to own workspace
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      uid: dbUser.id,
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
      role: isAdmin ? 'admin' : dbUser.role,
      subscriptionStatus: isAdmin ? 'active' : dbUser.subscriptionStatus,
      plan: dbUser.plan,
      trialStartedAt: dbUser.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: dbUser.trialEndsAt?.toISOString() ?? null,
      settings: dbUser.settings ?? {},
    },
    workspace: {
      ownerUid: ownerUserId,
      accessMode,
      sharedRole,
      ownerName,
      ownerEmail,
    },
  });
}

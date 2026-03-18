import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

/**
 * Mirrors a Firestore invitation into the Prisma SharedAccess table.
 * Called client-side from Settings after upsertUserSharedAccess() succeeds.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { inviteToken?: string; invitedEmail?: string; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { inviteToken, invitedEmail, role } = body;
  if (!inviteToken || !invitedEmail) {
    return NextResponse.json({ success: false, error: 'Missing inviteToken or invitedEmail' }, { status: 400 });
  }

  const normalizedEmail = invitedEmail.trim().toLowerCase();
  const normalizedRole = role === 'manager' ? 'manager' : 'viewer';

  await prisma.sharedAccess.upsert({
    where: { inviteToken },
    create: {
      ownerUserId: user.id,
      inviteToken,
      invitedEmail: normalizedEmail,
      role: normalizedRole,
      status: 'pending',
    },
    update: {
      invitedEmail: normalizedEmail,
      role: normalizedRole,
      status: 'pending',
    },
  });

  return NextResponse.json({ success: true });
}

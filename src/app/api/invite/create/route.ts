import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

/**
 * POST /api/invite/create
 * Called by the owner after upsertUserSharedAccess() succeeds in Firebase.
 * Stores the invitation server-side so it can be validated on accept.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as {
      inviteToken?: string;
      invitedEmail?: string;
      role?: string;
    };

    const { inviteToken, invitedEmail, role } = body;
    if (!inviteToken || !invitedEmail) {
      return NextResponse.json(
        { error: 'inviteToken and invitedEmail are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = invitedEmail.trim().toLowerCase();
    const normalizedRole = role === 'manager' ? 'manager' : 'viewer';

    await prisma.workspaceInvitation.upsert({
      where: { inviteToken },
      create: {
        inviteToken,
        ownerUserId: user.id,
        invitedEmail: normalizedEmail,
        role: normalizedRole,
        status: 'pending',
      },
      update: {
        invitedEmail: normalizedEmail,
        role: normalizedRole,
        status: 'pending',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invitation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

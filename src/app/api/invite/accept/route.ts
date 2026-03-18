import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

/**
 * POST /api/invite/accept
 * Called by the invited user after acceptInvitationByToken() succeeds in Firebase.
 * Validates the token server-side and creates the UserWorkspaceAccess grant so
 * all subsequent data queries are routed to the owner's data.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as { token?: string };
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'token is required.' }, { status: 400 });
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { inviteToken: token },
    });

    if (!invitation) {
      // Invitation not found in DB — may have been created before this feature was deployed.
      // Return gracefully so the client doesn't break.
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Security: the accepting user's email must match what the owner invited.
    if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address.' },
        { status: 403 }
      );
    }

    // Guard against self-grant.
    if (user.id === invitation.ownerUserId) {
      return NextResponse.json(
        { error: 'Cannot accept your own invitation.' },
        { status: 400 }
      );
    }

    // Create or update the access grant.
    await prisma.userWorkspaceAccess.upsert({
      where: {
        guestUserId_ownerUserId: {
          guestUserId: user.id,
          ownerUserId: invitation.ownerUserId,
        },
      },
      create: {
        guestUserId: user.id,
        ownerUserId: invitation.ownerUserId,
        role: invitation.role,
      },
      update: {
        role: invitation.role,
        updatedAt: new Date(),
      },
    });

    // Mark invitation accepted.
    await prisma.workspaceInvitation.update({
      where: { inviteToken: token },
      data: { status: 'accepted', updatedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      ownerUserId: invitation.ownerUserId,
      role: invitation.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept invitation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

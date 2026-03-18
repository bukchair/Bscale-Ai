import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

/**
 * DELETE /api/invite/revoke
 * Called by the owner after removeUserSharedAccess() succeeds in Firebase.
 * Removes the WorkspaceInvitation and UserWorkspaceAccess records so the
 * guest immediately loses access to the owner's data.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as { invitedEmail?: string };
    const { invitedEmail } = body;

    if (!invitedEmail) {
      return NextResponse.json({ error: 'invitedEmail is required.' }, { status: 400 });
    }

    const normalizedEmail = invitedEmail.trim().toLowerCase();

    // Delete invitation record (owned by the current user).
    await prisma.workspaceInvitation.deleteMany({
      where: { ownerUserId: user.id, invitedEmail: normalizedEmail },
    });

    // Find the guest Prisma user by email, then delete their access grant.
    const guestUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (guestUser) {
      await prisma.userWorkspaceAccess.deleteMany({
        where: { guestUserId: guestUser.id, ownerUserId: user.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke invitation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

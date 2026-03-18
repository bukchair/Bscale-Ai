import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: string };
    token = typeof body.token === 'string' ? body.token.trim() : undefined;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing invitation token' }, { status: 400 });
  }

  const access = await prisma.sharedAccess.findUnique({ where: { inviteToken: token } });

  if (!access) {
    return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 });
  }

  if (access.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: 'This invitation was sent to a different email address' },
      { status: 403 }
    );
  }

  if (access.status === 'accepted') {
    return NextResponse.json({ success: true, message: 'Already accepted', ownerUserId: access.ownerUserId });
  }

  if (access.status === 'revoked') {
    return NextResponse.json({ success: false, error: 'This invitation has been revoked' }, { status: 410 });
  }

  await prisma.sharedAccess.update({
    where: { inviteToken: token },
    data: {
      status: 'accepted',
      sharedUserId: user.id,
      acceptedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: 'Invitation accepted', ownerUserId: access.ownerUserId });
}

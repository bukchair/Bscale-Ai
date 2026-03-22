import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

// GET /api/sharing — list people I've shared access with (as owner)
export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.sharedAccess.findMany({
    where: { ownerUserId: user.id },
    select: {
      invitedEmail: true,
      role: true,
      status: true,
      inviteToken: true,
      createdAt: true,
      acceptedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ sharedAccess: rows });
}

// POST /api/sharing — invite someone
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string; role?: string };
  try {
    body = (await request.json()) as { email?: string; role?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const role = body.role === 'viewer' ? 'viewer' : 'manager';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 });
  }

  // Upsert: update role if already exists, else create
  const existing = await prisma.sharedAccess.findFirst({
    where: { ownerUserId: user.id, invitedEmail: email },
  });

  let inviteToken: string;

  if (existing) {
    await prisma.sharedAccess.update({
      where: { id: existing.id },
      data: { role, status: 'pending' },
    });
    inviteToken = existing.inviteToken;
  } else {
    inviteToken = crypto.randomUUID();
    await prisma.sharedAccess.create({
      data: {
        ownerUserId: user.id,
        invitedEmail: email,
        role,
        inviteToken,
        status: 'pending',
      },
    });
  }

  return NextResponse.json({ success: true, inviteToken });
}

// DELETE /api/sharing — remove access
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  await prisma.sharedAccess.deleteMany({
    where: { ownerUserId: user.id, invitedEmail: email },
  });

  return NextResponse.json({ success: true });
}

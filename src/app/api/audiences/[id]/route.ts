import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id: _id, userId: _uid, createdAt: _ca, ...allowed } = body;
  void _id; void _uid; void _ca;

  await prisma.audience.updateMany({
    where: { id, userId: user.id },
    data: allowed as Parameters<typeof prisma.audience.updateMany>[0]['data'],
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await prisma.audience.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ success: true });
}

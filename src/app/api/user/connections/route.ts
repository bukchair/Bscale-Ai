import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { Prisma } from '@prisma/client';

// GET /api/user/connections — returns saved connection items for the current user
export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { settings: true },
  });

  const settings = (dbUser?.settings ?? {}) as Record<string, unknown>;
  const connections = (settings.connections as unknown[]) ?? [];

  return NextResponse.json({ connections });
}

// PATCH /api/user/connections — saves connection items
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { connections?: unknown[] };
  try {
    body = (await request.json()) as { connections?: unknown[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.connections)) {
    return NextResponse.json({ error: 'connections must be an array' }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { settings: true },
  });

  const currentSettings = (dbUser?.settings ?? {}) as Record<string, unknown>;
  await prisma.user.update({
    where: { id: user.id },
    data: { settings: { ...currentSettings, connections: body.connections } as Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true });
}

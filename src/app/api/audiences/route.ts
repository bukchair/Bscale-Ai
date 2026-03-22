import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const audiences = await prisma.audience.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ audiences });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const audience = await prisma.audience.create({
    data: {
      userId: user.id,
      name: String(body.name ?? ''),
      platform: String(body.platform ?? 'google'),
      description: body.description ? String(body.description) : null,
      rules: (body.rules as object) ?? [],
      estimatedSize: body.estimatedSize ? Number(body.estimatedSize) : null,
      status: String(body.status ?? 'draft'),
      syncedToPlatform: Boolean(body.syncedToPlatform ?? false),
      externalId: body.externalId ? String(body.externalId) : null,
    },
  });

  return NextResponse.json({ success: true, id: audience.id });
}

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

  const ads = await prisma.savedAd.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ads });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { type?: string; productName?: string; payload?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.type || !body.payload) {
    return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 });
  }

  const ad = await prisma.savedAd.create({
    data: {
      userId: user.id,
      type: body.type,
      productName: body.productName ?? null,
      payload: body.payload,
    },
  });

  return NextResponse.json({ success: true, id: ad.id });
}

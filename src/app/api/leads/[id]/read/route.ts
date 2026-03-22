import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

// POST /api/leads/[id]/read — marks a lead as read by the current user
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.salesLead.findUnique({ where: { id }, select: { readBy: true } });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const readBy = (lead.readBy as Record<string, string> | null) ?? {};
  if (readBy[user.id]) return NextResponse.json({ success: true });

  readBy[user.id] = new Date().toISOString();
  await prisma.salesLead.update({ where: { id }, data: { readBy } });

  return NextResponse.json({ success: true });
}

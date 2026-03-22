import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

function serializeThread(t: {
  id: string; ownerUserId: string; subject: string; status: string;
  createdByName: string | null; createdByEmail: string | null;
  messages: unknown; lastMessageAt: string; lastMessageFrom: string;
  lastMessageText: string; adminSeenAt: string; userSeenAt: string;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: t.id,
    ownerUid: t.ownerUserId,
    docId: t.id,
    kind: 'support_thread',
    subject: t.subject,
    status: t.status,
    createdByName: t.createdByName,
    createdByEmail: t.createdByEmail,
    messages: t.messages,
    lastMessageAt: t.lastMessageAt,
    lastMessageFrom: t.lastMessageFrom,
    lastMessageText: t.lastMessageText,
    adminSeenAt: t.adminSeenAt,
    userSeenAt: t.userSeenAt,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

// GET /api/support — list threads (own for user, all for admin)
export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = user.role === 'admin';
  const threads = isAdmin
    ? await prisma.supportThread.findMany({ orderBy: { updatedAt: 'desc' } })
    : await prisma.supportThread.findMany({
        where: { ownerUserId: user.id },
        orderBy: { updatedAt: 'desc' },
      });

  return NextResponse.json({ threads: threads.map(serializeThread) });
}

// POST /api/support — create new thread
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { subject?: string; firstMessage?: string };
  try {
    body = (await request.json()) as { subject?: string; firstMessage?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const subject = String(body.subject ?? '').trim().slice(0, 180);
  const firstMessage = String(body.firstMessage ?? '').trim().slice(0, 4000);

  if (!subject) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
  if (!firstMessage) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const now = new Date().toISOString();
  const thread = await prisma.supportThread.create({
    data: {
      ownerUserId: user.id,
      subject,
      status: 'waiting-admin',
      createdByName: user.name ?? null,
      createdByEmail: user.email ?? null,
      messages: [{
        id: `msg_${Date.now()}`,
        threadId: 'pending',
        text: firstMessage,
        senderUid: user.id,
        senderRole: 'user',
        senderName: user.name ?? 'User',
        createdAt: now,
      }],
      lastMessageAt: now,
      lastMessageFrom: 'user',
      lastMessageText: firstMessage.slice(0, 300),
      userSeenAt: now,
    },
  });

  return NextResponse.json({ success: true, thread: serializeThread(thread) });
}

import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';

// PATCH /api/support/[id] — send reply, update status, or mark seen
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thread = await prisma.supportThread.findUnique({ where: { id: params.id } });
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.role === 'admin';
  if (!isAdmin && thread.ownerUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { message?: string; status?: string; markSeen?: boolean };
  try {
    body = (await request.json()) as { message?: string; status?: string; markSeen?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const data: Record<string, unknown> = {};

  if (body.message) {
    const text = String(body.message).trim().slice(0, 4000);
    if (text) {
      const senderRole = isAdmin ? 'admin' : 'user';
      const existingMessages = Array.isArray(thread.messages) ? (thread.messages as unknown[]) : [];
      const newMessage = {
        id: `msg_${Date.now()}`,
        threadId: thread.id,
        text,
        senderUid: user.id,
        senderRole,
        senderName: user.name ?? (isAdmin ? 'Admin' : 'User'),
        createdAt: now,
      };
      data.messages = [...existingMessages, newMessage];
      data.lastMessageAt = now;
      data.lastMessageFrom = senderRole;
      data.lastMessageText = text.slice(0, 300);
      data.status = senderRole === 'admin' ? 'waiting-user' : 'waiting-admin';
      data[senderRole === 'admin' ? 'adminSeenAt' : 'userSeenAt'] = now;
    }
  }

  if (body.status && isAdmin) {
    data.status = String(body.status);
    data.updatedAt = now;
  }

  if (body.markSeen) {
    data[isAdmin ? 'adminSeenAt' : 'userSeenAt'] = now;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true });
  }

  await prisma.supportThread.update({
    where: { id: params.id },
    data: data as Parameters<typeof prisma.supportThread.update>[0]['data'],
  });

  return NextResponse.json({ success: true });
}

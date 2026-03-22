import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { prisma } from '@/src/lib/db/prisma';
import { rateLimit } from '@/src/lib/rate-limit';
import { trackEvent } from '@/src/lib/tracking';

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim();
const leadBucket = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 per hour per IP

// POST /api/leads — public, creates a new sales lead
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = rateLimit(`leads:${ip}`, leadBucket);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Too many requests.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON.' }, { status: 400 });
  }

  const safeName = String(body.name ?? '').trim().slice(0, 120);
  if (!safeName) {
    return NextResponse.json({ success: false, message: 'Name is required.' }, { status: 400 });
  }

  const lead = await prisma.salesLead.create({
    data: {
      name: safeName,
      email: String(body.email ?? '').trim().slice(0, 200) || null,
      phone: String(body.phone ?? '').trim().slice(0, 80) || null,
      website: String(body.website ?? '').trim().slice(0, 500) || null,
      sourcePath: String(body.sourcePath ?? '/').trim().slice(0, 300) || null,
      message: String(body.message ?? '').trim().slice(0, 4000) || null,
      assignedAdminEmail: (String(body.assignedAdminEmail ?? '') || ADMIN_EMAIL).trim().slice(0, 200) || null,
      status: 'new',
      readBy: {},
    },
  });

  trackEvent('bscale_lead_submit', {
    source: lead.sourcePath || 'unknown',
    has_email: Boolean(lead.email),
    has_phone: Boolean(lead.phone),
  });

  return NextResponse.json({ success: true, id: lead.id });
}

// GET /api/leads — admin only, returns all leads
export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const leads = await prisma.salesLead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ leads });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/src/lib/db/prisma';
import { rateLimit } from '@/src/lib/rate-limit';
import {
  buildConfirmUrl,
  generateSignupToken,
  hashSignupToken,
  INVITE_TTL_MS,
  normalizeSignupEmail,
  sendSignupInviteEmail,
} from '@/src/lib/auth/email-signup-server';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional().nullable(),
  locale: z.enum(['he', 'en']).optional(),
});

const ipBucket = { limit: 20, windowMs: 60 * 60 * 1000 };
const emailBucket = { limit: 4, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlIp = rateLimit(`email-signup-req-ip:${ip}`, ipBucket);
  if (!rlIp.allowed) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid email or name.' }, { status: 400 });
  }

  const email = normalizeSignupEmail(parsed.data.email);
  const rlEmail = rateLimit(`email-signup-req-em:${email}`, emailBucket);
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { success: false, message: 'Too many requests for this address. Try again later.' },
      { status: 429 }
    );
  }

  const genericOk = {
    success: true,
    message:
      parsed.data.locale === 'he'
        ? 'אם כתובת המייל זמינה להרשמה, נשלח אליך קישור לאישור.'
        : 'If this email can be registered, we sent a confirmation link.',
  };

  try {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      return NextResponse.json(genericOk);
    }

    await prisma.emailSignupInvite.deleteMany({
      where: { email, usedAt: null },
    });

    const rawToken = generateSignupToken();
    const tokenHash = hashSignupToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await prisma.emailSignupInvite.create({
      data: {
        tokenHash,
        email,
        name: parsed.data.name?.trim() || null,
        expiresAt,
      },
    });

    const confirmUrl = buildConfirmUrl(rawToken);
    await sendSignupInviteEmail({
      toEmail: email,
      name: parsed.data.name,
      confirmUrl,
      isHebrew: parsed.data.locale === 'he',
    });

    return NextResponse.json(genericOk);
  } catch (err) {
    console.error('[email-signup/request]', err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : 'Registration email could not be sent. Please try again later.',
      },
      { status: 500 }
    );
  }
}

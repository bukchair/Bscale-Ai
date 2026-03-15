import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

type SendBody = {
  to?: string;
  subject?: string;
  body?: string;
};

const toErrorMessage = (status: number, raw: string, parsed: unknown) => {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const rootError = obj.error;
    if (rootError && typeof rootError === 'object') {
      const msg = (rootError as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    const msg = obj.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (raw.trim()) return `Gmail send failed (${status}): ${raw.slice(0, 240)}`;
  return `Gmail send failed (${status}).`;
};

const toBase64Url = (input: string) =>
  Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(user.id, 'GMAIL', {
      allowGoogleAdsFallback: true,
    });
    const payload = (await request.json().catch(() => ({}))) as SendBody;

    if (!payload.to || !payload.subject || !payload.body) {
      return NextResponse.json(
        { message: 'Missing to/subject/body in Gmail send request.' },
        { status: 400 }
      );
    }

    const mime = [
      `To: ${payload.to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: =?utf-8?B?${Buffer.from(payload.subject).toString('base64')}?=`,
      '',
      payload.body,
    ].join('\n');

    const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: toBase64Url(mime) }),
    });

    const raw = await response.text();
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: toErrorMessage(response.status, raw, parsed) },
        { status: response.status }
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to send Gmail message for this user.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { rateLimit } from '@/src/lib/rate-limit';

// 20 AI requests per user per minute
const AI_RATE_LIMIT = { limit: 20, windowMs: 60_000 };

type ProxyBody = {
  provider?: string;
  apiKey?: string;
  prompt?: string;
};

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requireAuthenticatedUser>>;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(user.id, AI_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Too many requests. Please wait before sending more AI prompts.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(AI_RATE_LIMIT.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      }
    );
  }

  let body: ProxyBody;
  try {
    body = (await request.json()) as ProxyBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, apiKey, prompt } = body;
  if (!provider || !apiKey || !prompt) {
    return NextResponse.json({ message: 'Missing provider, apiKey, or prompt' }, { status: 400 });
  }

  if (provider === 'claude') {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { error?: { message?: string } } | null)?.error?.message || res.statusText;
        return NextResponse.json({ message }, { status: res.status });
      }
      return NextResponse.json(data, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Claude API request failed.' },
        { status: 500 }
      );
    }
  }

  if (provider === 'openai') {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 4096,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { error?: { message?: string } } | null)?.error?.message || res.statusText;
        return NextResponse.json({ message }, { status: res.status });
      }
      return NextResponse.json(data, { status: 200 });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'OpenAI API request failed.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: `Unsupported AI provider: ${provider}` }, { status: 400 });
}

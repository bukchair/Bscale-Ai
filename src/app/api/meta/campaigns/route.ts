import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const upstream = new URL('/api/connections/meta/campaigns', url.origin);
  const adAccountId = url.searchParams.get('ad_account_id');
  if (adAccountId) {
    upstream.searchParams.set('ad_account_id', adAccountId);
  }

  const response = await fetch(upstream.toString(), {
    method: 'GET',
    headers: {
      authorization: request.headers.get('authorization') || '',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text || 'Unexpected Meta proxy response.' };
  }
  return NextResponse.json(parsed, { status: response.status });
}

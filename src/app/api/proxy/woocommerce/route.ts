import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';

type WooBody = {
  url?: string;
  key?: string;
  secret?: string;
  endpoint?: string;
  method?: string;
  data?: unknown;
};

async function tryFetch(
  targetUrl: string,
  key: string,
  secret: string,
  method: string,
  bodyData?: unknown,
  authMode: 'query' | 'header' | 'both' = 'query'
): Promise<Response> {
  const urlObj = new URL(targetUrl);
  if (authMode === 'query' || authMode === 'both') {
    urlObj.searchParams.append('consumer_key', key);
    urlObj.searchParams.append('consumer_secret', secret);
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; BScale/1.0)',
    Accept: 'application/json',
  };
  if (authMode === 'header' || authMode === 'both') {
    headers.Authorization = `Basic ${auth}`;
  }
  if (method === 'PUT' || method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  const options: RequestInit = { method, headers, redirect: 'follow' };
  if ((method === 'PUT' || method === 'POST') && bodyData !== undefined) {
    options.body = JSON.stringify(bodyData);
  }
  return fetch(urlObj.toString(), options);
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: WooBody;
  try {
    body = (await request.json()) as WooBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, key, secret, endpoint, method = 'GET', data } = body;
  if (!url || !key || !secret) {
    return NextResponse.json({ message: 'Missing credentials' }, { status: 400 });
  }

  try {
    let formattedUrl = String(url).trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const baseUrl = formattedUrl.endsWith('/') ? formattedUrl.slice(0, -1) : formattedUrl;
    const endpointPath = endpoint || 'system_status';

    const routeCandidates = [
      `${baseUrl}/wp-json/wc/v3/${endpointPath}`,
      `${baseUrl}/index.php/wp-json/wc/v3/${endpointPath}`,
      `${baseUrl}/wc-api/v3/${endpointPath}`,
    ];
    // Try header auth first to avoid exposing credentials in URL logs/history.
    const authModes: Array<'header' | 'query' | 'both'> = ['header', 'query', 'both'];

    let lastStatus = 500;
    let lastPayload: unknown = null;
    const tried = new Set<string>();

    for (const route of routeCandidates) {
      for (const authMode of authModes) {
        const keyForDedup = `${route}::${authMode}`;
        if (tried.has(keyForDedup)) continue;
        tried.add(keyForDedup);

        const response = await tryFetch(route, key, secret, method, data, authMode);
        const text = await response.text();
        lastStatus = response.status || 500;

        if (!text) {
          lastPayload = {
            message:
              response.status === 409
                ? 'החנות החזירה Conflict (409). ייתכן שיש חסימה או מפתח REST לא תקף.'
                : `החנות החזירה תשובה ריקה (סטטוס ${response.status}).`,
            code: 'empty_response',
          };
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          lastPayload = {
            message: `The store returned a non-JSON response (${response.status}).`,
            code: 'invalid_response',
          };
          continue;
        }

        if (response.ok) {
          return NextResponse.json(parsed, { status: 200 });
        }

        lastPayload = parsed;
      }
    }

    if (lastPayload && typeof lastPayload === 'object') {
      return NextResponse.json(lastPayload, { status: lastStatus });
    }

    return NextResponse.json(
      {
        message: `WooCommerce API Error: ${lastStatus}`,
        code: 'woocommerce_error',
      },
      { status: lastStatus }
    );
  } catch {
    return NextResponse.json(
      {
        message:
          'Failed to connect to WooCommerce store. Please check the URL and that the store is accessible.',
        code: 'connection_failed',
      },
      { status: 500 }
    );
  }
}

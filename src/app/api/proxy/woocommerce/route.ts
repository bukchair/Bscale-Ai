import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';

/** Blocks SSRF by rejecting private/loopback/link-local IP ranges and hostnames. */
function isPrivateHost(hostname: string): boolean {
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      (a === 169 && b === 254) ||
      a === 0 ||
      a >= 224
    );
  }
  const h = hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '[::1]';
}

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
  bodyData?: unknown
): Promise<Response> {
  const urlObj = new URL(targetUrl);

  // Credentials are sent via Basic Auth header only — never as URL query params
  // so they don't appear in server access logs or CDN request logs.
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; BScale/1.0)',
    Accept: 'application/json',
    Authorization: `Basic ${auth}`,
  };
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

    let parsedHost: URL;
    try {
      parsedHost = new URL(formattedUrl);
    } catch {
      return NextResponse.json({ message: 'Invalid store URL.' }, { status: 400 });
    }
    if (isPrivateHost(parsedHost.hostname)) {
      return NextResponse.json({ message: 'Invalid store URL.' }, { status: 400 });
    }

    const baseUrl = formattedUrl.endsWith('/') ? formattedUrl.slice(0, -1) : formattedUrl;
    const rawEndpoint = endpoint || 'system_status';
    // Guard against path traversal (e.g. "../../wp-login.php").
    if (!/^[a-zA-Z0-9_/-]+$/.test(rawEndpoint) || rawEndpoint.includes('..')) {
      return NextResponse.json({ message: 'Invalid endpoint path.' }, { status: 400 });
    }
    const endpointPath = rawEndpoint.replace(/^\/+/, '');

    const routeCandidates = [
      `${baseUrl}/wp-json/wc/v3/${endpointPath}`,
      `${baseUrl}/index.php/wp-json/wc/v3/${endpointPath}`,
      `${baseUrl}/wc-api/v3/${endpointPath}`,
    ];

    let lastStatus = 500;
    let lastPayload: unknown = null;

    for (const route of routeCandidates) {
        const response = await tryFetch(route, key, secret, method, data);
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

import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

const SEARCH_CONSOLE_API = 'https://searchconsole.googleapis.com/webmasters/v3';
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  if (raw.trim()) return `Search Console request failed (${status}): ${raw.slice(0, 240)}`;
  return `Search Console request failed (${status}).`;
};

const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      user.id,
      'SEARCH_CONSOLE',
      { allowGoogleAdsFallback: true }
    );
    const url = new URL(request.url);
    const querySiteUrl = (url.searchParams.get('site_url') || '').trim();
    const startDateParam = normalizeDateParam(url.searchParams.get('start_date'));
    const endDateParam = normalizeDateParam(url.searchParams.get('end_date'));
    const fallbackSiteUrl =
      connection.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
      connection.connectedAccounts[0]?.externalAccountId ||
      '';
    let siteUrl = (querySiteUrl || fallbackSiteUrl).trim();

    if (!siteUrl) {
      const discoverResponse = await fetch(`${SEARCH_CONSOLE_API}/sites`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      });
      const discoverRaw = await discoverResponse.text();
      let discoverParsed: unknown = {};
      try {
        discoverParsed = discoverRaw ? JSON.parse(discoverRaw) : {};
      } catch {
        discoverParsed = null;
      }
      if (discoverResponse.ok) {
        const firstSite =
          discoverParsed && typeof discoverParsed === 'object'
            ? ((discoverParsed as { siteEntry?: Array<{ siteUrl?: string }> }).siteEntry?.[0]?.siteUrl || '')
            : '';
        siteUrl = String(firstSite || '').trim();
      }
    }

    if (!siteUrl) {
      return NextResponse.json(
        { message: 'Missing site_url for Search Console query. Select a site in integrations.' },
        { status: 400 }
      );
    }

    const encodedSite = encodeURIComponent(siteUrl);
    const response = await fetch(
      `${SEARCH_CONSOLE_API}/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDateParam || dateDaysAgo(30),
          endDate: endDateParam || dateDaysAgo(1),
          dimensions: ['query'],
          rowLimit: 50,
        }),
      }
    );

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
      {
        message:
          error instanceof Error ? error.message : 'Failed to load Search Console data for this user.',
      },
      { status: 500 }
    );
  }
}

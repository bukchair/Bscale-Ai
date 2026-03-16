import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

import { toApiErrorMessage as toErrorMessage, normalizeDateParam } from '@/src/lib/utils/api-request-utils';
import { GSC_API_BASE as SEARCH_CONSOLE_API } from '@/src/lib/constants/api-urls';
const isValidSearchConsoleSite = (value: string) =>
  /^https?:\/\/.+/i.test(value) || /^sc-domain:.+/i.test(value);

const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { connection, accessToken, resolvedPlatform } = await googleLegacyBridge.getConnectionWithAccessToken(
      user.id,
      'SEARCH_CONSOLE',
      { allowGoogleAdsFallback: true }
    );
    const url = new URL(request.url);
    const querySiteUrlRaw = (url.searchParams.get('site_url') || '').trim();
    const querySiteUrl = isValidSearchConsoleSite(querySiteUrlRaw) ? querySiteUrlRaw : '';
    const startDateParam = normalizeDateParam(url.searchParams.get('start_date'));
    const endDateParam = normalizeDateParam(url.searchParams.get('end_date'));
    const fallbackSiteRaw =
      resolvedPlatform === 'SEARCH_CONSOLE'
        ? connection.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
          connection.connectedAccounts[0]?.externalAccountId ||
          ''
        : '';
    const fallbackSiteUrl = isValidSearchConsoleSite(String(fallbackSiteRaw || '').trim())
      ? String(fallbackSiteRaw || '').trim()
      : '';
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

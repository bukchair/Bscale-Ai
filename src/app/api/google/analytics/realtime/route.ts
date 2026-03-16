import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { GA4_DATA_API, GA4_ADMIN_API, GA4_MAX_PROPERTY_DISCOVERY_CANDIDATES } from '@/src/lib/constants/api-urls';
import { toApiErrorMessage } from '@/src/lib/utils/api-request-utils';

const normalizePropertyId = (value: string) => value.replace(/^properties\//, '').trim();
const isNumericPropertyId = (value: string) => /^\d+$/.test(value);

const toErrorMessage = toApiErrorMessage;

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { connection, accessToken, resolvedPlatform } = await googleLegacyBridge.getConnectionWithAccessToken(user.id, 'GA4', {
      allowGoogleAdsFallback: true,
    });
    const url = new URL(request.url);
    const queryPropertyIdRaw = url.searchParams.get('property_id') || '';
    const queryPropertyId = normalizePropertyId(queryPropertyIdRaw);

    const fallbackPropertyId =
      resolvedPlatform === 'GA4'
        ? connection.connectedAccounts.find(
            (account: { isSelected?: boolean; status?: string }) =>
              account.isSelected && account.status !== 'ARCHIVED'
          )?.externalAccountId ||
          connection.connectedAccounts.find(
            (account: { status?: string }) => account.status !== 'ARCHIVED'
          )?.externalAccountId ||
          ''
        : '';

    let propertyId = normalizePropertyId(queryPropertyId || fallbackPropertyId);

    if (!isNumericPropertyId(propertyId)) {
      const discoverResponse = await fetch(`${GA4_ADMIN_API}/accountSummaries?pageSize=200`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      });
      if (discoverResponse.ok) {
        const discoverParsed = await discoverResponse.json().catch(() => ({}));
        const summaries =
          (discoverParsed as { accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string }> }> })
            .accountSummaries ?? [];
        for (const summary of summaries) {
          for (const property of summary.propertySummaries ?? []) {
            const normalized = normalizePropertyId(String(property.property || ''));
            if (isNumericPropertyId(normalized)) {
              propertyId = normalized;
              break;
            }
          }
          if (isNumericPropertyId(propertyId)) break;
        }
      }
    }

    if (!isNumericPropertyId(propertyId)) {
      return NextResponse.json(
        { message: 'Missing GA4 property ID. Configure a GA4 property in your Google connection.' },
        { status: 400 }
      );
    }

    // Fetch both realtime top pages and 24h user count in parallel
    const [realtimeRes, users24hRes] = await Promise.all([
      fetch(`${GA4_DATA_API}/properties/${propertyId}:runRealtimeReport`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dimensions: [
            { name: 'unifiedScreenName' },
            { name: 'pagePathPlusQueryString' },
          ],
          metrics: [{ name: 'screenPageViews' }],
          limit: 7,
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        }),
      }),
      fetch(`${GA4_DATA_API}/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
          metrics: [{ name: 'totalUsers' }],
          metricAggregations: ['TOTAL'],
        }),
      }),
    ]);

    const realtimeRaw = await realtimeRes.text();
    const users24hRaw = await users24hRes.text();

    let realtimeParsed: any = {};
    let users24hParsed: any = {};
    try { realtimeParsed = realtimeRaw ? JSON.parse(realtimeRaw) : {}; } catch { realtimeParsed = {}; }
    try { users24hParsed = users24hRaw ? JSON.parse(users24hRaw) : {}; } catch { users24hParsed = {}; }

    if (!realtimeRes.ok) {
      return NextResponse.json(
        { message: toErrorMessage(realtimeRes.status, realtimeRaw, realtimeParsed) },
        { status: realtimeRes.status }
      );
    }

    // Parse top pages from realtime report
    const rows: Array<{ title: string; path: string; views: number }> = [];
    for (const row of realtimeParsed.rows ?? []) {
      const dims = row.dimensionValues ?? [];
      const mets = row.metricValues ?? [];
      rows.push({
        title: dims[0]?.value || '',
        path: dims[1]?.value || '',
        views: parseInt(mets[0]?.value || '0', 10),
      });
    }

    // Parse 24h totalUsers
    let users24h = 0;
    const totals = users24hParsed.totals ?? [];
    if (totals.length > 0) {
      users24h = parseInt(totals[0]?.metricValues?.[0]?.value || '0', 10);
    }

    return NextResponse.json({ topPages: rows, users24h }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to load GA4 realtime data.' },
      { status: 500 }
    );
  }
}

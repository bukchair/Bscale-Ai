import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { GA4_DATA_API, GA4_ADMIN_API, GA4_MAX_PROPERTY_DISCOVERY_CANDIDATES } from '@/src/lib/constants/api-urls';
import { toApiErrorMessage } from '@/src/lib/utils/api-request-utils';

const normalizePropertyId = (value: string) => value.replace(/^properties\//, '').trim();
const isNumericPropertyId = (value: string) => /^\d+$/.test(value);

const toErrorMessage = toApiErrorMessage;

type Ga4RunPayload = {
  realtimeRes: Response;
  users24hRes: Response;
  realtimeRaw: string;
  users24hRaw: string;
  realtimeParsed: Record<string, unknown>;
  users24hParsed: Record<string, unknown>;
};

const discoverNumericPropertyId = async (
  accessToken: string,
  options?: { exclude?: string[] }
): Promise<string> => {
  const exclude = new Set((options?.exclude || []).map((item) => normalizePropertyId(item)));
  const discoverResponse = await fetch(
    `${GA4_ADMIN_API}/accountSummaries?pageSize=${GA4_MAX_PROPERTY_DISCOVERY_CANDIDATES}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
    }
  );
  if (!discoverResponse.ok) return '';
  const discoverParsed = await discoverResponse.json().catch(() => ({}));
  const summaries =
    (
      discoverParsed as {
        accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string }> }>;
      }
    ).accountSummaries ?? [];

  for (const summary of summaries) {
    for (const property of summary.propertySummaries ?? []) {
      const normalized = normalizePropertyId(String(property.property || ''));
      if (isNumericPropertyId(normalized) && !exclude.has(normalized)) {
        return normalized;
      }
    }
  }
  return '';
};

const runGa4Reports = async (
  propertyId: string,
  accessToken: string
): Promise<Ga4RunPayload> => {
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
  const realtimeParsed = (realtimeRaw ? JSON.parse(realtimeRaw) : {}) as Record<string, unknown>;
  const users24hParsed = (users24hRaw ? JSON.parse(users24hRaw) : {}) as Record<string, unknown>;
  return {
    realtimeRes,
    users24hRes,
    realtimeRaw,
    users24hRaw,
    realtimeParsed,
    users24hParsed,
  };
};

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
      propertyId = await discoverNumericPropertyId(accessToken);
    }

    if (!isNumericPropertyId(propertyId)) {
      return NextResponse.json(
        { message: 'Missing GA4 property ID. Configure a GA4 property in your Google connection.' },
        { status: 400 }
      );
    }

    let runPayload: Ga4RunPayload;
    try {
      runPayload = await runGa4Reports(propertyId, accessToken);
    } catch {
      return NextResponse.json({ message: 'Failed to parse GA4 response payload.' }, { status: 502 });
    }

    // If caller provided a numeric property that fails with 400/403, retry once using auto-discovery.
    if (
      !runPayload.realtimeRes.ok &&
      (runPayload.realtimeRes.status === 400 || runPayload.realtimeRes.status === 403)
    ) {
      const fallbackPropertyId = await discoverNumericPropertyId(accessToken, { exclude: [propertyId] });
      if (isNumericPropertyId(fallbackPropertyId) && fallbackPropertyId !== propertyId) {
        propertyId = fallbackPropertyId;
        try {
          runPayload = await runGa4Reports(propertyId, accessToken);
        } catch {
          return NextResponse.json({ message: 'Failed to parse GA4 response payload.' }, { status: 502 });
        }
      }
    }

    if (!runPayload.realtimeRes.ok) {
      return NextResponse.json(
        {
          message: toErrorMessage(
            runPayload.realtimeRes.status,
            runPayload.realtimeRaw,
            runPayload.realtimeParsed
          ),
        },
        { status: runPayload.realtimeRes.status }
      );
    }

    // Parse top pages from realtime report
    const rows: Array<{ title: string; path: string; views: number }> = [];
    for (const row of (runPayload.realtimeParsed.rows as Array<Record<string, any>> | undefined) ?? []) {
      const dims = row?.dimensionValues ?? [];
      const mets = row?.metricValues ?? [];
      rows.push({
        title: dims[0]?.value || '',
        path: dims[1]?.value || '',
        views: parseInt(mets[0]?.value || '0', 10),
      });
    }

    // Parse 24h totalUsers
    let users24h = 0;
    const totals =
      (runPayload.users24hParsed.totals as Array<{ metricValues?: Array<{ value?: string }> }> | undefined) ??
      [];
    if (totals.length > 0) {
      users24h = parseInt(totals[0]?.metricValues?.[0]?.value || '0', 10);
    }

    return NextResponse.json({ topPages: rows, users24h }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to load GA4 realtime data.' },
      { status: httpStatusFromError(error) }
    );
  }
}

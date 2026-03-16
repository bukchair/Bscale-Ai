import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { GA4_DATA_API, GA4_ADMIN_API, GA4_MAX_PROPERTY_DISCOVERY_CANDIDATES } from '@/src/lib/constants/api-urls';
const normalizePropertyId = (value: string) => value.replace(/^properties\//, '').trim();
const normalizeMeasurementId = (value: string) => String(value || '').trim().toUpperCase();
const isNumericPropertyId = (value: string) => /^\d+$/.test(value);
const isMeasurementId = (value: string) => /^G-[A-Z0-9]+$/.test(value);
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

const extractPropertyIdsFromSummaries = (parsed: unknown): string[] => {
  if (!parsed || typeof parsed !== 'object') return [];
  const summaries =
    (parsed as { accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string }> }> })
      .accountSummaries ?? [];
  const ids: string[] = [];
  for (const summary of summaries) {
    for (const property of summary.propertySummaries ?? []) {
      const normalized = normalizePropertyId(String(property.property || ''));
      if (isNumericPropertyId(normalized)) ids.push(normalized);
    }
  }
  return [...new Set(ids)];
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
  if (raw.trim()) return `GA4 request failed (${status}): ${raw.slice(0, 240)}`;
  return `GA4 request failed (${status}).`;
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
    const queryMeasurementId = normalizeMeasurementId(queryPropertyIdRaw);
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));
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
    let accountSummariesStatus: number | null = null;
    let accountSummariesError: string | null = null;
    let cachedPropertyIds: string[] | null = null;

    const getDiscoverablePropertyIds = async () => {
      if (cachedPropertyIds) {
        return { propertyIds: cachedPropertyIds, status: accountSummariesStatus, error: accountSummariesError };
      }
      const discoverResponse = await fetch(`${GA4_ADMIN_API}/accountSummaries?pageSize=200`, {
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

      accountSummariesStatus = discoverResponse.status;
      if (!discoverResponse.ok) {
        accountSummariesError = toErrorMessage(discoverResponse.status, discoverRaw, discoverParsed);
        cachedPropertyIds = [];
        return { propertyIds: cachedPropertyIds, status: accountSummariesStatus, error: accountSummariesError };
      }

      cachedPropertyIds = extractPropertyIdsFromSummaries(discoverParsed);
      return { propertyIds: cachedPropertyIds, status: accountSummariesStatus, error: null };
    };

    // Accept Measurement ID (G-XXXX) input by resolving it to a GA4 numeric property ID.
    if (!isNumericPropertyId(propertyId) && isMeasurementId(queryMeasurementId)) {
      const discovered = await getDiscoverablePropertyIds();
      const candidates = discovered.propertyIds.slice(0, GA4_MAX_PROPERTY_DISCOVERY_CANDIDATES);
      for (const candidatePropertyId of candidates) {
        const streamsResponse = await fetch(
          `${GA4_ADMIN_API}/properties/${candidatePropertyId}/dataStreams?pageSize=200`,
          {
            method: 'GET',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
          }
        );
        if (!streamsResponse.ok) continue;
        const streamsRaw = await streamsResponse.text();
        let streamsParsed: unknown = {};
        try {
          streamsParsed = streamsRaw ? JSON.parse(streamsRaw) : {};
        } catch {
          streamsParsed = null;
        }
        const dataStreams =
          streamsParsed && typeof streamsParsed === 'object'
            ? ((streamsParsed as { dataStreams?: Array<{ webStreamData?: { measurementId?: string } }> })
                .dataStreams ?? [])
            : [];
        const hasMatchingMeasurementId = dataStreams.some(
          (stream) => normalizeMeasurementId(stream.webStreamData?.measurementId || '') === queryMeasurementId
        );
        if (hasMatchingMeasurementId) {
          propertyId = candidatePropertyId;
          break;
        }
      }
    }

    if (!isNumericPropertyId(propertyId)) {
      const discovered = await getDiscoverablePropertyIds();
      propertyId = discovered.propertyIds[0] || '';
    }

    if (!isNumericPropertyId(propertyId)) {
      if (accountSummariesStatus === 403) {
        return NextResponse.json(
          {
            message:
              accountSummariesError ||
              'Google connection is missing GA4 permission (analytics.readonly). Reconnect Google and approve Analytics access.',
          },
          { status: 403 }
        );
      }
      if (isMeasurementId(queryMeasurementId)) {
        return NextResponse.json(
          {
            message:
              'The GA4 value you entered looks like a Measurement ID (G-XXXX). This endpoint needs a GA4 Property ID (digits), or a Google connection with GA4 permission to auto-discover it.',
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          message:
            'Missing property_id for GA4 report. Use a GA4 Property ID (digits only), not Measurement ID (G-XXXX).',
        },
        { status: 400 }
      );
    }

    const response = await fetch(`${GA4_DATA_API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [
          {
            startDate: startDate || '30daysAgo',
            endDate: endDate || 'today',
          },
        ],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        metricAggregations: ['TOTAL'],
      }),
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
      { message: error instanceof Error ? error.message : 'Failed to load GA4 report for this user.' },
      { status: 500 }
    );
  }
}

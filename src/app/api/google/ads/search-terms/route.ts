import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v22';
const normalizeCustomerId = (value: string) => value.replace(/\D/g, '');
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};
const normalizeMatchType = (value: unknown): 'BROAD' | 'PHRASE' | 'EXACT' => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'BROAD' || normalized === 'EXACT') return normalized;
  return 'PHRASE';
};
const normalizeKeywordTerm = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
const normalizeCampaignId = (value: unknown) => normalizeCustomerId(String(value || ''));

type GoogleAdsContext = {
  accessToken: string;
  customerId: string;
  loginCustomerId?: string;
};

const resolveGoogleAdsContext = async (
  request: Request,
  overrides?: { customerId?: string; loginCustomerId?: string }
): Promise<GoogleAdsContext> => {
  if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is missing.');
  }

  const user = await requireAuthenticatedUser();
  const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
    user.id,
    'GOOGLE_ADS'
  );
  const url = new URL(request.url);
  const queryCustomerId = normalizeCustomerId(
    overrides?.customerId || url.searchParams.get('customer_id') || ''
  );
  const fallbackCustomerId = googleLegacyBridge.pickSelectedAccountId(connection);
  const customerId = queryCustomerId || fallbackCustomerId;
  if (!customerId) {
    throw new Error('Missing customer_id for Google Ads search terms.');
  }

  const queryLoginCustomerId = normalizeCustomerId(
    overrides?.loginCustomerId || url.searchParams.get('login_customer_id') || ''
  );
  const loginCustomerId =
    queryLoginCustomerId || googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;

  return {
    accessToken,
    customerId,
    loginCustomerId,
  };
};

const parseJsonResponse = async (response: Response) => {
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = null;
  }
  return {
    raw,
    parsed,
  };
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
  if (raw.trim()) return `Google Ads search terms request failed (${status}): ${raw.slice(0, 240)}`;
  return `Google Ads search terms request failed (${status}).`;
};

export async function GET(request: Request) {
  try {
    const { accessToken, customerId, loginCustomerId } = await resolveGoogleAdsContext(request);
    const url = new URL(request.url);
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));
    const dateFilter =
      startDate && endDate ? `\n              AND segments.date BETWEEN '${startDate}' AND '${endDate}'` : '';

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `
          SELECT
            search_term_view.search_term,
            campaign.id,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.ctr,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM search_term_view
          WHERE metrics.impressions > 0${dateFilter}
          ORDER BY metrics.clicks DESC
          LIMIT 500
        `,
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
      {
        message:
          error instanceof Error ? error.message : 'Failed to load Google Ads search terms for this user.',
      },
      { status: 500 }
    );
  }
}

type NegativeKeywordOperationInput = {
  term?: string;
  campaignId?: string;
  campaignName?: string;
  matchType?: 'BROAD' | 'PHRASE' | 'EXACT';
};

type NegativeKeywordRequestBody = {
  customerId?: string;
  loginCustomerId?: string;
  items?: NegativeKeywordOperationInput[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as NegativeKeywordRequestBody;
    const { accessToken, customerId, loginCustomerId } = await resolveGoogleAdsContext(request, {
      customerId: body.customerId,
      loginCustomerId: body.loginCustomerId,
    });

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) {
      return NextResponse.json({ message: 'No negative keyword items provided.' }, { status: 400 });
    }

    const dedup = new Map<string, { term: string; campaignId: string; campaignName: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }>();
    const skipped: Array<{ term: string; campaignId?: string; reason: string }> = [];

    rawItems.slice(0, 100).forEach((item) => {
      const term = normalizeKeywordTerm(item?.term);
      const campaignId = normalizeCampaignId(item?.campaignId);
      const matchType = normalizeMatchType(item?.matchType);
      const campaignName = String(item?.campaignName || '').trim();

      if (!term) {
        skipped.push({ term: '', campaignId, reason: 'Missing keyword term.' });
        return;
      }
      if (!campaignId) {
        skipped.push({ term, reason: 'Missing campaign id.' });
        return;
      }

      const dedupKey = `${campaignId}::${matchType}::${term.toLowerCase()}`;
      if (dedup.has(dedupKey)) return;
      dedup.set(dedupKey, {
        term,
        campaignId,
        campaignName,
        matchType,
      });
    });

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const applied: Array<{ term: string; campaignId: string; campaignName: string; matchType: string; resourceName?: string }> = [];
    const failed: Array<{ term: string; campaignId: string; campaignName: string; matchType: string; message: string }> = [];

    for (const item of dedup.values()) {
      const response = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignCriteria:mutate`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            operations: [
              {
                create: {
                  campaign: `customers/${customerId}/campaigns/${item.campaignId}`,
                  negative: true,
                  keyword: {
                    text: item.term,
                    matchType: item.matchType,
                  },
                },
              },
            ],
          }),
        }
      );

      const { raw, parsed } = await parseJsonResponse(response);
      if (!response.ok) {
        failed.push({
          term: item.term,
          campaignId: item.campaignId,
          campaignName: item.campaignName,
          matchType: item.matchType,
          message: toErrorMessage(response.status, raw, parsed),
        });
        continue;
      }

      const resourceName = Array.isArray((parsed as any)?.results)
        ? String((parsed as any).results[0]?.resourceName || '')
        : '';
      applied.push({
        term: item.term,
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        matchType: item.matchType,
        resourceName: resourceName || undefined,
      });
    }

    return NextResponse.json(
      {
        success: applied.length > 0,
        summary: {
          requested: rawItems.length,
          deduplicated: dedup.size,
          applied: applied.length,
          failed: failed.length,
          skipped: skipped.length,
        },
        applied,
        failed,
        skipped,
        customerId,
      },
      { status: applied.length > 0 ? 200 : 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to apply negative keywords in Google Ads.',
      },
      { status: 500 }
    );
  }
}

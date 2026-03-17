import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { GOOGLE_ADS_API_BASE } from '@/src/lib/constants/api-urls';
import { toApiErrorMessage as toErrorMessage, normalizeDateParam, normalizeCustomerId } from '@/src/lib/utils/api-request-utils';

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      user.id,
      'GOOGLE_ADS'
    );

    const url = new URL(request.url);
    const queryCustomerId = normalizeCustomerId(url.searchParams.get('customer_id') || '');
    const fallbackCustomerId = googleLegacyBridge.pickSelectedAccountId(connection);
    const customerId = queryCustomerId || fallbackCustomerId;
    if (!customerId) {
      return NextResponse.json({ message: 'Missing customer_id for Google Ads campaigns.' }, { status: 400 });
    }

    const queryLoginCustomerId = normalizeCustomerId(url.searchParams.get('login_customer_id') || '');
    const loginCustomerId =
      queryLoginCustomerId || googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));
    // Dates are validated above against /^\d{4}-\d{2}-\d{2}$/ — no injection risk.
    const dateFilter =
      startDate && endDate ? `\n              AND segments.date BETWEEN '${startDate}' AND '${endDate}'` : '';

    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              campaign.advertising_channel_type,
              campaign.advertising_channel_sub_type,
              campaign.bidding_strategy_type,
              campaign.start_date,
              campaign.end_date,
              campaign.serving_status,
              campaign_budget.amount_micros,
              campaign_budget.period,
              metrics.cost_micros,
              metrics.impressions,
              metrics.clicks,
              metrics.ctr,
              metrics.average_cpc,
              metrics.cost_per_conversion,
              metrics.average_cpm,
              metrics.conversions,
              metrics.conversions_value,
              metrics.search_impression_share,
              metrics.search_top_impression_share,
              metrics.absolute_top_impression_percentage
            FROM campaign
            WHERE campaign.status != 'REMOVED'${dateFilter}
            LIMIT 200
          `,
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
      console.error(
        `[Google Ads Campaigns] API error customer=${customerId} status=${response.status} message=${toErrorMessage(response.status, raw, parsed)}`
      );
      return NextResponse.json(
        { message: toErrorMessage(response.status, raw, parsed) },
        { status: response.status }
      );
    }

    // Server-side diagnostics — visible in Cloud Run logs.
    const results = (parsed as { results?: unknown[] })?.results ?? [];
    const totalImpressions = results.reduce((sum: number, row: unknown) => {
      const r = row as { metrics?: { impressions?: string } };
      return sum + parseInt(r?.metrics?.impressions ?? '0', 10);
    }, 0);
    console.log(
      `[Google Ads Campaigns] customer=${customerId} campaigns=${results.length} totalImpressions=${totalImpressions} dateRange=${startDate || 'none'}→${endDate || 'none'}`
    );
    if (results.length > 0 && totalImpressions === 0) {
      console.warn(
        `[Google Ads Campaigns] All ${results.length} campaign(s) returned 0 impressions for ${startDate}→${endDate}. ` +
          'Possible causes: no delivery, campaigns paused, or date range has no data.'
      );
    }
    if (results.length === 0) {
      console.warn(
        `[Google Ads Campaigns] Zero campaigns returned for customer=${customerId} dateRange=${startDate || 'none'}→${endDate || 'none'}`
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Failed to load Google Ads campaigns for this user.',
      },
      { status: 500 }
    );
  }
}

import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { fetchWithRetry } from '@/src/lib/sync/jobs/http-retry';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v22';

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const googleAdsConnector = {
  async fetchCampaigns(connectionId: string, userId: string, customerId: string) {
    const connection = await connectionService.getByIdAndUser(connectionId, userId);
    if (!connection) return [];
    const accessToken = await tokenService.getAccessToken(connectionId, userId);
    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetchWithRetry(
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
              campaign.start_date,
              campaign.end_date
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            LIMIT 500
          `,
        }),
      }
    );
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const rows = Array.isArray(payload?.results) ? (payload.results as Record<string, unknown>[]) : [];
    return rows.map((row) => {
      const campaign = row?.campaign as Record<string, unknown> | undefined;
      return {
        id: String(campaign?.id || ''),
        campaignId: String(campaign?.id || ''),
        name: String(campaign?.name || ''),
        status: String(campaign?.status || ''),
        objective: String(campaign?.advertisingChannelType || ''),
        startDate: String(campaign?.startDate || ''),
        endDate: String(campaign?.endDate || ''),
      };
    });
  },

  async fetchCampaignMetricsByDay(
    connectionId: string,
    userId: string,
    customerId: string,
    startDate: string,
    endDate: string
  ) {
    const connection = await connectionService.getByIdAndUser(connectionId, userId);
    if (!connection) return [];
    const accessToken = await tokenService.getAccessToken(connectionId, userId);
    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    const response = await fetchWithRetry(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            SELECT
              campaign.id,
              segments.date,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value
            FROM campaign
            WHERE campaign.status != 'REMOVED'
              AND segments.date BETWEEN '${startDate}' AND '${endDate}'
            LIMIT 10000
          `,
        }),
      }
    );
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const rows = Array.isArray(payload?.results) ? (payload.results as Record<string, unknown>[]) : [];
    return rows.map((row) => {
      const campaign = row?.campaign as Record<string, unknown> | undefined;
      const segments = row?.segments as Record<string, unknown> | undefined;
      const metrics = row?.metrics as Record<string, unknown> | undefined;
      return {
        campaignId: String(campaign?.id || ''),
        date: String(segments?.date || ''),
        impressions: Math.round(toNumber(metrics?.impressions)),
        clicks: Math.round(toNumber(metrics?.clicks)),
        spend: toNumber(metrics?.costMicros) / 1_000_000,
        conversions: toNumber(metrics?.conversions),
        revenue: toNumber(metrics?.conversionsValue),
      };
    });
  },
};

import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { BaseGoogleProvider } from '@/src/lib/integrations/providers/google-shared/provider-base';
import type { DiscoveredAccount, ProviderCapability, TestResult } from '@/src/lib/integrations/core/types';
import { ExternalApiError, NoAccountsFoundError, ProviderConfigError } from '@/src/lib/integrations/core/errors';

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v18';

type SearchStreamChunk = {
  results?: Array<Record<string, unknown>>;
};

export class GoogleAdsProvider extends BaseGoogleProvider {
  readonly platform = 'GOOGLE_ADS' as const;
  readonly oauthScopes = ['https://www.googleapis.com/auth/adwords'] as const;
  readonly capabilities: readonly ProviderCapability[] = [
    'ACCOUNT_DISCOVERY',
    'REPORTING_TEST',
    'MULTI_ACCOUNT',
    'TOKEN_REFRESH',
  ] as const;

  private async requestAds<T>(input: {
    connectionId: string;
    path: string;
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    loginCustomerId?: string | null;
  }): Promise<T> {
    const accessToken = await this.getValidAccessToken(input.connectionId);
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };

    const loginCustomerId = input.loginCustomerId || integrationsEnv.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId.replace(/-/g, '');
    }

    const response = await fetch(`${GOOGLE_ADS_API_BASE}${input.path}`, {
      method: input.method ?? 'POST',
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
    });

    const payload = await response.text();
    let parsed: unknown;
    try {
      parsed = payload ? (JSON.parse(payload) as unknown) : {};
    } catch {
      throw new ExternalApiError('Google Ads API returned non-JSON response.');
    }

    if (!response.ok) {
      throw new ExternalApiError('Google Ads request failed.', {
        status: response.status,
        response: parsed,
      });
    }

    return parsed as T;
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
      throw new ProviderConfigError('Missing Google Ads developer token.');
    }

    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { metadata: true },
    });

    const loginCustomerId =
      typeof connection?.metadata === 'object' && connection.metadata
        ? (connection.metadata as Record<string, unknown>).loginCustomerId
        : null;

    const accessible = await this.requestAds<{ resourceNames?: string[] }>({
      connectionId,
      path: '/customers:listAccessibleCustomers',
      method: 'GET',
      loginCustomerId: typeof loginCustomerId === 'string' ? loginCustomerId : null,
    });

    const customerIds = (accessible.resourceNames ?? [])
      .map((resourceName) => resourceName.replace('customers/', '').trim())
      .filter(Boolean);

    if (!customerIds.length) {
      throw new NoAccountsFoundError('No Google Ads customer accounts were accessible.');
    }

    const discovered = await Promise.all(
      customerIds.map(async (customerId): Promise<DiscoveredAccount> => {
        const rows = await this.requestAds<SearchStreamChunk[]>({
          connectionId,
          path: `/customers/${customerId}/googleAds:searchStream`,
          body: {
            query:
              'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1',
          },
          loginCustomerId: typeof loginCustomerId === 'string' ? loginCustomerId : null,
        });

        const customer = rows?.[0]?.results?.[0]?.customer as
          | { id?: string; descriptiveName?: string; currencyCode?: string; timeZone?: string }
          | undefined;

        return {
          externalAccountId: customer?.id ?? customerId,
          name: customer?.descriptiveName || `Google Ads ${customerId}`,
          currency: customer?.currencyCode ?? null,
          timezone: customer?.timeZone ?? null,
          status: 'active',
          metadata: {
            loginCustomerId: loginCustomerId || null,
          },
        };
      })
    );

    return discovered;
  }

  async testConnection(connectionId: string, accountId?: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) {
      throw new ExternalApiError('Google Ads connection not found.');
    }

    const chosen =
      accountId ||
      connection.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
      connection.connectedAccounts[0]?.externalAccountId;

    if (!chosen) {
      throw new NoAccountsFoundError('No selected Google Ads account is available for test.');
    }

    const chunks = await this.requestAds<SearchStreamChunk[]>({
      connectionId,
      path: `/customers/${chosen}/googleAds:searchStream`,
      body: {
        query:
          'SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros FROM campaign WHERE segments.date DURING LAST_7_DAYS LIMIT 20',
      },
    });

    const campaigns = chunks.flatMap((chunk) => chunk.results ?? []) as Array<{
      metrics?: Record<string, string | number | undefined>;
    }>;
    const summary = campaigns.reduce<{
      rows: number;
      impressions: number;
      clicks: number;
      costMicros: number;
    }>(
      (acc, item) => {
        const metrics = item.metrics ?? {};
        acc.rows += 1;
        acc.impressions += Number(metrics.impressions ?? 0);
        acc.clicks += Number(metrics.clicks ?? 0);
        acc.costMicros += Number(metrics.costMicros ?? 0);
        return acc;
      },
      { rows: 0, impressions: 0, clicks: 0, costMicros: 0 }
    );

    return {
      ok: true,
      message: 'Google Ads connection is valid.',
      summary: {
        accountId: chosen,
        campaignsSampled: summary.rows,
        impressions: summary.impressions,
        clicks: summary.clicks,
        spend: summary.costMicros / 1_000_000,
      },
    };
  }
}

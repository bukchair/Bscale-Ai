import { prisma } from '@/src/lib/db/prisma';
import { BaseGoogleProvider } from '@/src/lib/integrations/providers/google-shared/provider-base';
import type { DiscoveredAccount, ProviderCapability, TestResult } from '@/src/lib/integrations/core/types';
import { ExternalApiError, NoAccountsFoundError, PlatformPermissionError } from '@/src/lib/integrations/core/errors';

const SEARCH_CONSOLE_API = 'https://searchconsole.googleapis.com/webmasters/v3';

type SiteListResponse = {
  siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
};

type SearchAnalyticsResponse = {
  rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
};

const isoDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

export class SearchConsoleProvider extends BaseGoogleProvider {
  readonly platform = 'SEARCH_CONSOLE' as const;
  readonly oauthScopes = ['https://www.googleapis.com/auth/webmasters.readonly'] as const;
  readonly capabilities: readonly ProviderCapability[] = [
    'ACCOUNT_DISCOVERY',
    'REPORTING_TEST',
    'MULTI_ACCOUNT',
    'TOKEN_REFRESH',
  ] as const;

  private async requestSc<T>(connectionId: string, url: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.getValidAccessToken(connectionId);
    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      if (response.status === 403) {
        throw new PlatformPermissionError('Search Console permission is insufficient.');
      }
      throw new ExternalApiError('Search Console API request failed.', {
        status: response.status,
        response: parsed,
      });
    }
    return parsed as T;
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    const sites = await this.requestSc<SiteListResponse>(connectionId, `${SEARCH_CONSOLE_API}/sites`);
    const discovered = (sites.siteEntry ?? [])
      .filter((entry) => Boolean(entry.siteUrl))
      .map<DiscoveredAccount>((entry) => ({
        externalAccountId: entry.siteUrl as string,
        name: entry.siteUrl as string,
        status: 'active',
        metadata: {
          permissionLevel: entry.permissionLevel ?? 'unknown',
        },
      }));

    if (!discovered.length) {
      throw new NoAccountsFoundError('No Search Console verified properties were found.');
    }

    return discovered;
  }

  async testConnection(connectionId: string, accountId?: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) {
      throw new ExternalApiError('Search Console connection not found.');
    }

    const siteUrl =
      accountId ||
      connection.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
      connection.connectedAccounts[0]?.externalAccountId;

    if (!siteUrl) {
      throw new NoAccountsFoundError('No Search Console property is selected.');
    }

    const encodedSite = encodeURIComponent(siteUrl);
    const report = await this.requestSc<SearchAnalyticsResponse>(
      connectionId,
      `${SEARCH_CONSOLE_API}/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: isoDate(7),
          endDate: isoDate(1),
          dimensions: ['query', 'page'],
          rowLimit: 10,
          startRow: 0,
        }),
      }
    );

    const rows = report.rows ?? [];
    return {
      ok: true,
      message: 'Search Console connection is valid.',
      summary: {
        siteUrl,
        topRows: rows.map((row) => ({
          query: row.keys?.[0] ?? '',
          page: row.keys?.[1] ?? '',
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: row.ctr ?? 0,
          position: row.position ?? 0,
        })),
      },
    };
  }
}

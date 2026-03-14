import { prisma } from '@/src/lib/db/prisma';
import { BaseGoogleProvider } from '@/src/lib/integrations/providers/google-shared/provider-base';
import type { DiscoveredAccount, ProviderCapability, TestResult } from '@/src/lib/integrations/core/types';
import { ExternalApiError, NoAccountsFoundError, PlatformPermissionError } from '@/src/lib/integrations/core/errors';

const GA4_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';
const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

type AccountSummariesResponse = {
  accountSummaries?: Array<{
    name?: string;
    displayName?: string;
    propertySummaries?: Array<{ property?: string; displayName?: string }>;
  }>;
};

const normalizePropertyId = (value: string): string => {
  const cleaned = value.trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('properties/')) return cleaned.replace('properties/', '');
  return cleaned;
};

export class Ga4Provider extends BaseGoogleProvider {
  readonly platform = 'GA4' as const;
  readonly oauthScopes = ['https://www.googleapis.com/auth/analytics.readonly'] as const;
  readonly capabilities: readonly ProviderCapability[] = [
    'ACCOUNT_DISCOVERY',
    'REPORTING_TEST',
    'MULTI_ACCOUNT',
    'TOKEN_REFRESH',
  ] as const;

  private async requestGa4<T>(connectionId: string, url: string, init?: RequestInit): Promise<T> {
    const accessToken = await this.getValidAccessToken(connectionId);
    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!response.ok) {
      if (response.status === 403) {
        throw new PlatformPermissionError('GA4 permissions are insufficient for this action.');
      }
      throw new ExternalApiError('GA4 API request failed.', { status: response.status, response: parsed });
    }
    return parsed as T;
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    const summaries = await this.requestGa4<AccountSummariesResponse>(
      connectionId,
      `${GA4_ADMIN_API}/accountSummaries?pageSize=200`
    );

    const discovered: DiscoveredAccount[] = [];
    for (const summary of summaries.accountSummaries ?? []) {
      const parentName = summary.displayName || summary.name || 'GA4 Account';
      for (const property of summary.propertySummaries ?? []) {
        const propertyResource = property.property || '';
        const propertyId = normalizePropertyId(propertyResource);
        if (!propertyId) continue;
        discovered.push({
          externalAccountId: propertyId,
          externalParentId: summary.name ?? null,
          name: property.displayName || `${parentName} - ${propertyId}`,
          status: 'active',
          metadata: {
            propertyResource,
            parentAccount: parentName,
          },
        });
      }
    }

    if (!discovered.length) {
      throw new NoAccountsFoundError('No GA4 properties were found for this user.');
    }

    return discovered;
  }

  async testConnection(connectionId: string, accountId?: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) {
      throw new ExternalApiError('GA4 connection not found.');
    }

    const propertyId =
      normalizePropertyId(
        accountId ||
          connection.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
          connection.connectedAccounts[0]?.externalAccountId ||
          ''
      ) || '';

    if (!/^\d+$/.test(propertyId)) {
      throw new NoAccountsFoundError('A valid GA4 property ID is required for test run.');
    }

    const report = await this.requestGa4<{
      rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
      rowCount?: number;
    }>(connectionId, `${GA4_DATA_API}/properties/${propertyId}:runReport`, {
      method: 'POST',
      body: JSON.stringify({
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        limit: 7,
      }),
    });

    const rows = report.rows ?? [];
    const totals = rows.reduce(
      (acc, row) => {
        acc.activeUsers += Number(row.metricValues?.[0]?.value ?? 0);
        acc.sessions += Number(row.metricValues?.[1]?.value ?? 0);
        return acc;
      },
      { activeUsers: 0, sessions: 0 }
    );

    return {
      ok: true,
      message: 'GA4 connection is valid.',
      summary: {
        propertyId,
        rowCount: report.rowCount ?? rows.length,
        activeUsers: totals.activeUsers,
        sessions: totals.sessions,
      },
    };
  }
}

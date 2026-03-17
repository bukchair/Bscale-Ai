import { prisma } from '@/src/lib/db/prisma';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { issueOAuthState, consumeOAuthState } from '@/src/lib/integrations/utils/oauth-state';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import type {
  CallbackParams,
  CallbackResult,
  DiscoveredAccount,
  Platform,
  ProviderCapability,
  ProviderTokenSet,
  TestResult,
} from '@/src/lib/integrations/core/types';
import type { IntegrationProvider, ProviderContext, RefreshTokenContext } from '@/src/lib/integrations/core/interfaces';
import {
  ExternalApiError,
  NoAccountsFoundError,
  PlatformPermissionError,
  ProviderConfigError,
  TokenRefreshError,
  UnsupportedCapabilityError,
} from '@/src/lib/integrations/core/errors';
import { toRoutePlatform } from '@/src/lib/integrations/utils/platform-utils';
import { auditService } from '@/src/lib/integrations/services/audit-service';

const TIKTOK_AUTH_URL = 'https://ads.tiktok.com/marketing_api/auth';
const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

type TikTokEnvelope<T> = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
};

type TikTokTokenData = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  advertiser_ids?: string[];
  open_id?: string;
  scope?: string;
};

export class TikTokProvider implements IntegrationProvider {
  readonly platform: Platform = 'TIKTOK';
  readonly oauthScopes = ['user.info.basic', 'ad.account.read', 'report.read'] as const;
  private readonly baseCapabilities: readonly ProviderCapability[] = [
    'ACCOUNT_DISCOVERY',
    'MULTI_ACCOUNT',
    'TOKEN_REFRESH',
  ] as const;

  private get callbackUrl(): string {
    return `${integrationsEnv.APP_BASE_URL}/api/connections/${toRoutePlatform(this.platform)}/callback`;
  }

  supports(capability: ProviderCapability): boolean {
    if (capability === 'REPORTING_TEST') {
      return Boolean(integrationsEnv.TIKTOK_REPORTING_ENABLED);
    }
    return this.baseCapabilities.includes(capability);
  }

  async getAuthorizationUrl(context: ProviderContext): Promise<string> {
    if (!integrationsEnv.TIKTOK_APP_ID || !integrationsEnv.TIKTOK_CLIENT_SECRET) {
      throw new ProviderConfigError('TikTok client credentials are missing.');
    }

    const issued = await issueOAuthState(context.userId, this.platform, '/connections');
    const url = new URL(TIKTOK_AUTH_URL);
    url.searchParams.set('app_id', integrationsEnv.TIKTOK_APP_ID);
    url.searchParams.set('state', issued.state);
    url.searchParams.set('redirect_uri', this.callbackUrl);
    url.searchParams.set('scope', this.oauthScopes.join(','));
    return url.toString();
  }

  async handleCallback(context: ProviderContext, params: CallbackParams): Promise<CallbackResult> {
    if (params.error) {
      throw new ExternalApiError(`TikTok OAuth error: ${params.error}`);
    }
    if (!params.code || !params.state) {
      throw new ExternalApiError('TikTok OAuth callback is missing code or state.');
    }

    await consumeOAuthState(context.userId, this.platform, params.state);
    const tokenSet = await this.exchangeCode(params.code);
    const connection = await connectionService.ensurePendingConnection(context.userId, this.platform);
    await tokenService.saveTokenSet(context.userId, connection.id, tokenSet);
    return {
      connectionId: connection.id,
      status: 'CONNECTED',
    };
  }

  async refreshToken(context: RefreshTokenContext): Promise<ProviderTokenSet> {
    const refreshToken = await tokenService.getRefreshToken(context.connectionId);
    const response = await fetch(`${TIKTOK_API_BASE}/oauth2/refresh_token/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        app_id: integrationsEnv.TIKTOK_APP_ID,
        secret: integrationsEnv.TIKTOK_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    const envelope = (await response.json()) as TikTokEnvelope<TikTokTokenData>;
    if (!response.ok || envelope.code !== 0 || !envelope.data?.access_token) {
      throw new TokenRefreshError(
        envelope.message ||
          'TikTok refresh failed. Verify app approval and refresh token validity.'
      );
    }

    return {
      accessToken: envelope.data.access_token,
      refreshToken: envelope.data.refresh_token || refreshToken,
      tokenType: 'bearer',
      scopes: envelope.data.scope ? envelope.data.scope.split(',') : [...this.oauthScopes],
      expiresAt: envelope.data.expires_in
        ? new Date(Date.now() + envelope.data.expires_in * 1000)
        : undefined,
      externalUserId: envelope.data.open_id,
      metadata: {
        advertiserIds: envelope.data.advertiser_ids ?? [],
      },
    };
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    const { accessToken } = await this.getValidAccessToken(connectionId);
    const url = new URL(`${TIKTOK_API_BASE}/oauth2/advertiser/get/`);
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    const envelope = (await response.json()) as TikTokEnvelope<{
      list?: Array<{ advertiser_id?: string; advertiser_name?: string; status?: string }>;
      advertiser_ids?: string[];
    }>;

    if (!response.ok || envelope.code !== 0) {
      throw this.mapTikTokError(
        envelope,
        'Unable to discover TikTok advertisers. The app may require additional approvals.'
      );
    }

    const fromList = (envelope.data?.list ?? [])
      .filter((item) => item.advertiser_id)
      .map<DiscoveredAccount>((item) => ({
        externalAccountId: String(item.advertiser_id),
        name: item.advertiser_name || `TikTok Advertiser ${item.advertiser_id}`,
        status: item.status || 'active',
      }));

    const fallbackIds = (envelope.data?.advertiser_ids ?? []).map<DiscoveredAccount>((advertiserId) => ({
      externalAccountId: String(advertiserId),
      name: `TikTok Advertiser ${advertiserId}`,
      status: 'active',
    }));

    const merged = [...fromList, ...fallbackIds].filter(
      (item, index, array) => array.findIndex((v) => v.externalAccountId === item.externalAccountId) === index
    );

    if (!merged.length) {
      throw new NoAccountsFoundError(
        'No TikTok advertisers found. Ensure your app has ads account read permission and is approved.'
      );
    }

    return merged;
  }

  async testConnection(connectionId: string, accountId?: string): Promise<TestResult> {
    if (!this.supports('REPORTING_TEST')) {
      throw new UnsupportedCapabilityError(
        'REPORTING_TEST (set TIKTOK_REPORTING_ENABLED=true after app review approval)'
      );
    }

    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) {
      throw new ExternalApiError('TikTok connection not found.');
    }

    const advertiserId =
      accountId ||
      connection.connectedAccounts.find((a) => a.isSelected)?.externalAccountId ||
      connection.connectedAccounts[0]?.externalAccountId;
    if (!advertiserId) {
      throw new NoAccountsFoundError('No selected TikTok advertiser account.');
    }

    const { accessToken } = await this.getValidAccessToken(connectionId);
    const response = await fetch(`${TIKTOK_API_BASE}/report/integrated/get/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        data_level: 'AUCTION_AD',
        dimensions: ['campaign_id'],
        metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc'],
        start_date: this.dateDaysAgo(7),
        end_date: this.dateDaysAgo(1),
        page: 1,
        page_size: 10,
      }),
    });

    const envelope = (await response.json()) as TikTokEnvelope<{
      list?: Array<Record<string, string | number>>;
      page_info?: { total_number?: number };
    }>;

    if (!response.ok || envelope.code !== 0) {
      throw this.mapTikTokError(
        envelope,
        'TikTok reporting test failed. This usually means missing app review or reporting scope.'
      );
    }

    return {
      ok: true,
      message: 'TikTok connection is valid.',
      summary: {
        advertiserId,
        rows: envelope.data?.list ?? [],
        totalRows: envelope.data?.page_info?.total_number ?? 0,
      },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { userId: true },
    });
    if (!connection) return;
    await connectionService.disconnect(connection.userId, this.platform);
  }

  private async exchangeCode(code: string): Promise<ProviderTokenSet> {
    const response = await fetch(`${TIKTOK_API_BASE}/oauth2/access_token/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        app_id: integrationsEnv.TIKTOK_APP_ID,
        secret: integrationsEnv.TIKTOK_CLIENT_SECRET,
        auth_code: code,
      }),
    });

    const envelope = (await response.json()) as TikTokEnvelope<TikTokTokenData>;
    if (!response.ok || envelope.code !== 0 || !envelope.data?.access_token) {
      throw this.mapTikTokError(
        envelope,
        'TikTok token exchange failed. Confirm callback URI, app mode, and required approvals.'
      );
    }

    return {
      accessToken: envelope.data.access_token,
      refreshToken: envelope.data.refresh_token,
      tokenType: 'bearer',
      scopes: envelope.data.scope ? envelope.data.scope.split(',') : [...this.oauthScopes],
      expiresAt: envelope.data.expires_in
        ? new Date(Date.now() + envelope.data.expires_in * 1000)
        : undefined,
      externalUserId: envelope.data.open_id,
      metadata: {
        advertiserIds: envelope.data.advertiser_ids ?? [],
      },
    };
  }

  private async getValidAccessToken(connectionId: string): Promise<{ accessToken: string }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { userId: true, tokenExpiresAt: true },
    });
    if (!connection) throw new ExternalApiError('TikTok connection not found.');

    const expiresSoon =
      !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() <= Date.now() + 60_000;
    if (expiresSoon) {
      try {
        const refreshed = await this.refreshToken({
          connectionId,
          encryptedRefreshToken: null,
        });
        await tokenService.saveTokenSet(connection.userId, connectionId, refreshed);
      } catch (error) {
        await auditService.log({
          userId: connection.userId,
          action: 'refresh_failed',
          platform: this.platform,
          connectionId,
          details: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    }

    return {
      accessToken: await tokenService.getAccessToken(connectionId),
    };
  }

  private mapTikTokError<T>(envelope: TikTokEnvelope<T>, fallback: string) {
    const message = envelope.message || fallback;
    if (String(envelope.code) === '40100' || String(envelope.code) === '40103') {
      return new PlatformPermissionError(message);
    }
    return new ExternalApiError(message, {
      code: envelope.code,
      requestId: envelope.request_id,
    });
  }

  private dateDaysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }
}

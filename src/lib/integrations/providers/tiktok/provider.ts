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
import { TIKTOK_API_BASE } from '@/src/lib/constants/api-urls';

const TIKTOK_AUTH_URL = 'https://ads.tiktok.com/marketing_api/auth';

/** TikTok returns scope as either a comma-separated string or a string array. */
const parseTikTokScope = (scope: string | string[] | undefined, fallback: readonly string[]): string[] => {
  if (!scope) return [...fallback];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return scope.split(',').map((s) => s.trim()).filter(Boolean);
};

type TikTokEnvelope<T> = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
};

type TikTokTokenData = {
  access_token?: string;
  refresh_token?: string;
  // TikTok Business API v1.3 uses access_token_expire_in; some older responses used expires_in.
  access_token_expire_in?: number;
  expires_in?: number;
  refresh_token_expire_in?: number;
  refresh_expires_in?: number;
  advertiser_ids?: string[];
  open_id?: string;
  scope?: string | string[];
};

export class TikTokProvider implements IntegrationProvider {
  readonly platform: Platform = 'TIKTOK';
  readonly oauthScopes = ['user.info.basic', 'ad.account.read', 'ad.account.update', 'report.read'] as const;
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
    const refreshToken = await tokenService.getRefreshToken(context.connectionId, context.userId);
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
      scopes: parseTikTokScope(envelope.data.scope, this.oauthScopes),
      expiresAt: (() => {
        const ei = envelope.data.access_token_expire_in ?? envelope.data.expires_in;
        return ei ? new Date(Date.now() + ei * 1000) : undefined;
      })(),
      externalUserId: envelope.data.open_id,
      metadata: {
        advertiserIds: envelope.data.advertiser_ids ?? [],
      },
    };
  }

  async discoverAccounts(connectionId: string, userId: string): Promise<DiscoveredAccount[]> {
    // Load advertiser_ids saved during token exchange as a fallback source.
    const conn = await prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
      select: { metadata: true },
    });
    const rawMeta = (conn?.metadata as Record<string, unknown> | null) ?? {};
    const metadataIds: string[] = Array.isArray(rawMeta.advertiserIds)
      ? (rawMeta.advertiserIds as unknown[]).map(String).filter(Boolean)
      : [];

    const { accessToken } = await this.getValidAccessToken(connectionId, userId);
    const url = new URL(`${TIKTOK_API_BASE}/oauth2/advertiser/get/`);
    url.searchParams.set('app_id', integrationsEnv.TIKTOK_APP_ID ?? '');
    url.searchParams.set('secret', integrationsEnv.TIKTOK_CLIENT_SECRET ?? '');

    const response = await fetch(url, {
      headers: { 'Access-Token': accessToken },
    });
    const envelope = (await response.json()) as TikTokEnvelope<{
      list?: Array<{ advertiser_id?: string; advertiser_name?: string; status?: string }>;
      advertiser_ids?: string[];
    }>;

    if (!response.ok || envelope.code !== 0) {
      // Fall back to metadata IDs saved during OAuth token exchange.
      if (metadataIds.length) {
        return metadataIds.map((id) => ({
          externalAccountId: id,
          name: `TikTok Advertiser ${id}`,
          status: 'active',
        }));
      }
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

    const merged = [...fromList, ...fallbackIds, ...metadataIds.map((id) => ({
      externalAccountId: id,
      name: `TikTok Advertiser ${id}`,
      status: 'active' as const,
    }))].filter(
      (item, index, array) => array.findIndex((v) => v.externalAccountId === item.externalAccountId) === index
    );

    if (!merged.length) {
      throw new NoAccountsFoundError(
        'No TikTok advertisers found. Ensure your app has ads account read permission and is approved.'
      );
    }

    return merged;
  }

  async getAccessTokenForConnection(connectionId: string, userId: string): Promise<string> {
    const { accessToken } = await this.getValidAccessToken(connectionId, userId);
    return accessToken;
  }

  async testConnection(connectionId: string, userId: string, accountId?: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
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

    // If reporting scope isn't approved yet, do a lightweight advertiser list ping instead.
    if (!this.supports('REPORTING_TEST')) {
      const { accessToken } = await this.getValidAccessToken(connectionId, userId);
      const url = new URL(`${TIKTOK_API_BASE}/oauth2/advertiser/get/`);
      url.searchParams.set('app_id', integrationsEnv.TIKTOK_APP_ID ?? '');
      url.searchParams.set('secret', integrationsEnv.TIKTOK_CLIENT_SECRET ?? '');
      const response = await fetch(url, {
        headers: { 'Access-Token': accessToken },
      });
      const envelope = (await response.json()) as TikTokEnvelope<{
        list?: Array<{ advertiser_id?: string; advertiser_name?: string; status?: string }>;
        advertiser_ids?: string[];
      }>;
      if (!response.ok || envelope.code !== 0) {
        throw this.mapTikTokError(envelope, 'TikTok connection test failed. Please reconnect your account.');
      }
      return {
        ok: true,
        message: 'TikTok connection is valid.',
        summary: { advertiserId, accounts: envelope.data?.list ?? envelope.data?.advertiser_ids ?? [] },
      };
    }

    const { accessToken } = await this.getValidAccessToken(connectionId, userId);
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

  async disconnect(connectionId: string, userId: string): Promise<void> {
    const connection = await prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
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

    const expireIn = envelope.data.access_token_expire_in ?? envelope.data.expires_in;
    return {
      accessToken: envelope.data.access_token,
      refreshToken: envelope.data.refresh_token,
      tokenType: 'bearer',
      scopes: parseTikTokScope(envelope.data.scope, this.oauthScopes),
      expiresAt: expireIn ? new Date(Date.now() + expireIn * 1000) : undefined,
      externalUserId: envelope.data.open_id,
      metadata: {
        advertiserIds: envelope.data.advertiser_ids ?? [],
      },
    };
  }

  private async getValidAccessToken(connectionId: string, userId: string): Promise<{ accessToken: string }> {
    const connection = await prisma.platformConnection.findFirst({
      where: { id: connectionId, userId },
      select: { userId: true, tokenExpiresAt: true, encryptedRefreshToken: true },
    });
    if (!connection) throw new ExternalApiError('TikTok connection not found.');

    // Only consider the token expired when we have a known expiry time that is approaching.
    // A null tokenExpiresAt means expiry was not provided by TikTok; assume the token is still valid.
    const expiresSoon =
      connection.tokenExpiresAt !== null &&
      connection.tokenExpiresAt.getTime() <= Date.now() + 60_000;
    if (expiresSoon) {
      // If there is no refresh token stored, we cannot silently refresh.
      // Mark the connection as EXPIRED so the UI surfaces a reconnect prompt.
      if (!connection.encryptedRefreshToken) {
        await prisma.platformConnection.updateMany({
          where: { id: connectionId, userId: connection.userId },
          data: { status: 'EXPIRED', lastError: 'TikTok session expired. Please reconnect to continue.' },
        });
        throw new TokenRefreshError('TikTok session expired. Please reconnect to continue.');
      }

      try {
        const refreshed = await this.refreshToken({
          connectionId,
          userId: connection.userId,
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
      accessToken: await tokenService.getAccessToken(connectionId, connection.userId),
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

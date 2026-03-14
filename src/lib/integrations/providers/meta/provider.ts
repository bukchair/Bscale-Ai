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
} from '@/src/lib/integrations/core/errors';
import { toRoutePlatform } from '@/src/lib/integrations/utils/platform-utils';
import { auditService } from '@/src/lib/integrations/services/audit-service';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_AUTH_BASE = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

export class MetaProvider implements IntegrationProvider {
  readonly platform: Platform = 'META';
  readonly oauthScopes = [
    'ads_read',
    'ads_management',
    'business_management',
  ] as const;
  private readonly capabilities: readonly ProviderCapability[] = [
    'ACCOUNT_DISCOVERY',
    'REPORTING_TEST',
    'BUSINESS_MANAGER',
    'MULTI_ACCOUNT',
    'TOKEN_REFRESH',
  ] as const;

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }

  private get callbackUrl(): string {
    return `${integrationsEnv.APP_BASE_URL}/api/connections/${toRoutePlatform(this.platform)}/callback`;
  }

  async getAuthorizationUrl(context: ProviderContext): Promise<string> {
    if (!integrationsEnv.META_APP_ID || !integrationsEnv.META_APP_SECRET) {
      throw new ProviderConfigError('Meta app credentials are missing.');
    }

    const issued = await issueOAuthState(context.userId, this.platform, '/dashboard/connections');
    const url = new URL(META_AUTH_BASE);
    url.searchParams.set('client_id', integrationsEnv.META_APP_ID);
    url.searchParams.set('redirect_uri', this.callbackUrl);
    url.searchParams.set('state', issued.state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.oauthScopes.join(','));
    return url.toString();
  }

  async handleCallback(context: ProviderContext, params: CallbackParams): Promise<CallbackResult> {
    if (params.error) {
      throw new ExternalApiError(`Meta OAuth error: ${params.error}`);
    }
    if (!params.code || !params.state) {
      throw new ExternalApiError('Meta OAuth callback is missing code or state.');
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
    const refreshSource = context.encryptedRefreshToken
      ? await tokenService.getRefreshToken(context.connectionId)
      : await tokenService.getAccessToken(context.connectionId);

    const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', integrationsEnv.META_APP_ID);
    url.searchParams.set('client_secret', integrationsEnv.META_APP_SECRET);
    url.searchParams.set('fb_exchange_token', refreshSource);

    const response = await fetch(url);
    const parsed = (await response.json()) as MetaTokenResponse & { error?: { message?: string } };
    if (!response.ok || !parsed.access_token) {
      throw new TokenRefreshError(parsed.error?.message || 'Failed to refresh Meta access token.');
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.access_token,
      tokenType: parsed.token_type || 'bearer',
      scopes: [...this.oauthScopes],
      expiresAt: parsed.expires_in ? new Date(Date.now() + parsed.expires_in * 1000) : undefined,
    };
  }

  private async getValidAccessToken(connectionId: string): Promise<{ accessToken: string; connectionUserId: string }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { userId: true, tokenExpiresAt: true, status: true },
    });
    if (!connection) {
      throw new ExternalApiError('Meta connection not found.');
    }

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
          platform: this.platform,
          connectionId,
          action: 'refresh_failed',
          details: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    }

    return {
      accessToken: await tokenService.getAccessToken(connectionId),
      connectionUserId: connection.userId,
    };
  }

  async discoverAccounts(connectionId: string): Promise<DiscoveredAccount[]> {
    const { accessToken } = await this.getValidAccessToken(connectionId);
    const url = new URL(`${META_GRAPH_BASE}/me/adaccounts`);
    url.searchParams.set(
      'fields',
      'id,account_id,name,currency,timezone_name,account_status,business{id,name}'
    );
    url.searchParams.set('limit', '200');
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    const parsed = (await response.json()) as {
      data?: Array<{
        id?: string;
        account_id?: string;
        name?: string;
        currency?: string;
        timezone_name?: string;
        account_status?: number;
        business?: { id?: string; name?: string };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message = parsed.error?.message || 'Meta account discovery failed.';
      if (response.status === 403) {
        throw new PlatformPermissionError(message);
      }
      throw new ExternalApiError(message);
    }

    const discovered = (parsed.data ?? [])
      .filter((item) => item.account_id)
      .map<DiscoveredAccount>((item) => ({
        externalAccountId: String(item.account_id),
        externalParentId: item.business?.id || null,
        name: item.name || `Meta Account ${item.account_id}`,
        currency: item.currency || null,
        timezone: item.timezone_name || null,
        status: item.account_status === 1 ? 'active' : 'disabled',
        metadata: {
          graphAccountId: item.id ?? null,
          businessName: item.business?.name ?? null,
        },
      }));

    if (!discovered.length) {
      throw new NoAccountsFoundError('No Meta ad accounts found.');
    }
    return discovered;
  }

  async testConnection(connectionId: string, accountId?: string): Promise<TestResult> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      include: { connectedAccounts: true },
    });
    if (!connection) throw new ExternalApiError('Meta connection not found.');

    const selectedAccountId =
      accountId ||
      connection.connectedAccounts.find((a) => a.isSelected)?.externalAccountId ||
      connection.connectedAccounts[0]?.externalAccountId;
    if (!selectedAccountId) {
      throw new NoAccountsFoundError('No selected Meta ad account.');
    }

    const { accessToken } = await this.getValidAccessToken(connectionId);
    const accountResource = selectedAccountId.startsWith('act_')
      ? selectedAccountId
      : `act_${selectedAccountId}`;
    const url = new URL(`${META_GRAPH_BASE}/${accountResource}/insights`);
    url.searchParams.set('date_preset', 'last_7d');
    url.searchParams.set('fields', 'spend,impressions,clicks,ctr,cpc');
    url.searchParams.set('limit', '1');
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url);
    const parsed = (await response.json()) as {
      data?: Array<{
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const message = parsed.error?.message || 'Meta insights test failed.';
      if (response.status === 403) throw new PlatformPermissionError(message);
      throw new ExternalApiError(message);
    }

    const first = parsed.data?.[0];
    return {
      ok: true,
      message: 'Meta connection is valid.',
      summary: {
        accountId: selectedAccountId,
        spend: Number(first?.spend ?? 0),
        impressions: Number(first?.impressions ?? 0),
        clicks: Number(first?.clicks ?? 0),
        ctr: Number(first?.ctr ?? 0),
        cpc: Number(first?.cpc ?? 0),
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
    const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('client_id', integrationsEnv.META_APP_ID);
    url.searchParams.set('client_secret', integrationsEnv.META_APP_SECRET);
    url.searchParams.set('redirect_uri', this.callbackUrl);
    url.searchParams.set('code', code);

    const response = await fetch(url);
    const parsed = (await response.json()) as MetaTokenResponse & { error?: { message?: string } };
    if (!response.ok || !parsed.access_token) {
      throw new ExternalApiError(parsed.error?.message || 'Meta token exchange failed.');
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.access_token,
      tokenType: parsed.token_type || 'bearer',
      scopes: [...this.oauthScopes],
      expiresAt: parsed.expires_in ? new Date(Date.now() + parsed.expires_in * 1000) : undefined,
    };
  }
}

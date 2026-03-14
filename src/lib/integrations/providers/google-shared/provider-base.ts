import { prisma } from '@/src/lib/db/prisma';
import { tokenService } from '@/src/lib/integrations/services/token-service';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { consumeOAuthState } from '@/src/lib/integrations/utils/oauth-state';
import { hasRequiredScopes } from '@/src/lib/integrations/utils/scope-utils';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCodeForTokenSet,
  refreshGoogleTokenSet,
} from '@/src/lib/integrations/providers/google-shared/oauth';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { MissingScopesError, TokenRefreshError } from '@/src/lib/integrations/core/errors';
import type {
  CallbackParams,
  CallbackResult,
  Platform,
  ProviderCapability,
  ProviderTokenSet,
} from '@/src/lib/integrations/core/types';
import { toRoutePlatform } from '@/src/lib/integrations/utils/platform-utils';
import type { ProviderContext, RefreshTokenContext } from '@/src/lib/integrations/core/interfaces';
import { auditService } from '@/src/lib/integrations/services/audit-service';

export abstract class BaseGoogleProvider {
  abstract readonly platform: Platform;
  abstract readonly oauthScopes: readonly string[];
  abstract readonly capabilities: readonly ProviderCapability[];

  protected get callbackUrl() {
    const slug = toRoutePlatform(this.platform);
    return `${integrationsEnv.APP_BASE_URL}/api/connections/${slug}/callback`;
  }

  supports(capability: ProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async getAuthorizationUrl(input: ProviderContext): Promise<string> {
    return buildGoogleAuthorizationUrl({
      userId: input.userId,
      platform: this.platform,
      scopes: this.oauthScopes,
      redirectPath: input.redirectPath,
      callbackUrl: this.callbackUrl,
    });
  }

  async handleCallback(context: ProviderContext, params: CallbackParams): Promise<CallbackResult> {
    if (params.error) {
      throw new Error(`${params.error}: ${params.errorDescription ?? 'OAuth callback failed.'}`);
    }
    if (!params.code || !params.state) {
      throw new Error('Missing OAuth callback code or state.');
    }

    const { codeVerifier } = await consumeOAuthState(context.userId, this.platform, params.state);
    const tokenSet = await exchangeGoogleCodeForTokenSet({
      code: params.code,
      codeVerifier,
      callbackUrl: this.callbackUrl,
    });

    const { ok, missingScopes } = hasRequiredScopes(tokenSet.scopes, this.oauthScopes);
    if (!ok) {
      throw new MissingScopesError(missingScopes);
    }

    const connection = await connectionService.ensurePendingConnection(context.userId, this.platform);
    await tokenService.saveTokenSet(context.userId, connection.id, tokenSet);

    return {
      connectionId: connection.id,
      status: 'CONNECTED',
    };
  }

  async refreshToken(context: RefreshTokenContext): Promise<ProviderTokenSet> {
    const refreshToken = await tokenService.getRefreshToken(context.connectionId);
    const tokenSet = await refreshGoogleTokenSet({ refreshToken });
    if (!tokenSet.accessToken) {
      throw new TokenRefreshError();
    }
    return tokenSet;
  }

  protected async getValidAccessToken(connectionId: string): Promise<string> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        userId: true,
        tokenExpiresAt: true,
      },
    });

    if (!connection) {
      throw new Error('Platform connection was not found.');
    }

    const expiresSoon =
      !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

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

    return tokenService.getAccessToken(connectionId);
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { userId: true },
    });
    if (!connection) return;
    await connectionService.disconnect(connection.userId, this.platform);
  }
}

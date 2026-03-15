import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { GoogleAdsProvider } from '@/src/lib/integrations/providers/google-ads/provider';
import { Ga4Provider } from '@/src/lib/integrations/providers/ga4/provider';
import { SearchConsoleProvider } from '@/src/lib/integrations/providers/search-console/provider';
import { GmailProvider } from '@/src/lib/integrations/providers/gmail/provider';
import { integrationsEnv } from '@/src/lib/env/integrations-env';

type BridgePlatform = 'GOOGLE_ADS' | 'GA4' | 'SEARCH_CONSOLE' | 'GMAIL';

type BridgeConnection = {
  id: string;
  metadata: unknown;
  connectedAccounts: Array<{ externalAccountId: string; isSelected: boolean; status?: string }>;
};

const providers = {
  GOOGLE_ADS: new GoogleAdsProvider(),
  GA4: new Ga4Provider(),
  SEARCH_CONSOLE: new SearchConsoleProvider(),
  GMAIL: new GmailProvider(),
} as const;

const normalizeCustomerId = (value: string) => value.replace(/\D/g, '');

export const googleLegacyBridge = {
  async getConnectionWithAccessToken(
    userId: string,
    platform: BridgePlatform,
    options?: { allowGoogleAdsFallback?: boolean }
  ) {
    const primaryConnection = (await connectionService.getByUserPlatform(
      userId,
      platform
    )) as BridgeConnection | null;

    if (primaryConnection) {
      const provider = providers[platform];
      const accessToken = await provider.getAccessTokenForConnection(primaryConnection.id);
      return { connection: primaryConnection, accessToken, resolvedPlatform: platform as BridgePlatform };
    }

    if (options?.allowGoogleAdsFallback && platform !== 'GOOGLE_ADS') {
      const fallbackConnection = (await connectionService.getByUserPlatform(
        userId,
        'GOOGLE_ADS'
      )) as BridgeConnection | null;
      if (fallbackConnection) {
        const accessToken = await providers.GOOGLE_ADS.getAccessTokenForConnection(fallbackConnection.id);
        return {
          connection: fallbackConnection,
          accessToken,
          resolvedPlatform: 'GOOGLE_ADS' as BridgePlatform,
        };
      }
    }

    throw new Error(`No ${platform} connection is available for this user.`);
  },

  getLoginCustomerId(metadata: unknown): string | null {
    if (metadata && typeof metadata === 'object') {
      const candidate = (metadata as Record<string, unknown>).loginCustomerId;
      if (typeof candidate === 'string' && candidate.trim()) {
        return normalizeCustomerId(candidate);
      }
    }
    if (integrationsEnv.GOOGLE_ADS_MANAGER_CUSTOMER_ID) {
      return normalizeCustomerId(integrationsEnv.GOOGLE_ADS_MANAGER_CUSTOMER_ID);
    }
    return null;
  },

  pickSelectedAccountId(connection: BridgeConnection): string | null {
    const selected =
      connection.connectedAccounts.find(
        (account) => account.isSelected && account.status !== 'ARCHIVED'
      )?.externalAccountId ||
      connection.connectedAccounts.find((account) => account.status !== 'ARCHIVED')?.externalAccountId;
    return selected ? normalizeCustomerId(selected) : null;
  },
};

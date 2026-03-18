import type {
  CallbackParams,
  CallbackResult,
  DiscoveredAccount,
  Platform,
  ProviderCapability,
  ProviderTokenSet,
  TestResult,
} from './types';

export interface ProviderContext {
  userId: string;
  connectionId?: string;
  redirectPath?: string;
}

export interface RefreshTokenContext {
  connectionId: string;
  /** The user who owns this connection.  Required so token-service calls can
   *  verify ownership and prevent cross-tenant token access. */
  userId: string;
  encryptedRefreshToken: string | null;
}

export interface IntegrationProvider {
  readonly platform: Platform;
  readonly oauthScopes: readonly string[];
  supports(capability: ProviderCapability): boolean;
  getAuthorizationUrl(context: ProviderContext): Promise<string>;
  handleCallback(context: ProviderContext, params: CallbackParams): Promise<CallbackResult>;
  refreshToken(context: RefreshTokenContext): Promise<ProviderTokenSet>;
  discoverAccounts(connectionId: string, userId: string): Promise<DiscoveredAccount[]>;
  testConnection(connectionId: string, userId: string, accountId?: string): Promise<TestResult>;
  disconnect(connectionId: string, userId: string): Promise<void>;
}

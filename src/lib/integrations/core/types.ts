export const SUPPORTED_PLATFORMS = [
  'GOOGLE_ADS',
  'GA4',
  'SEARCH_CONSOLE',
  'GMAIL',
  'META',
  'TIKTOK',
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export const CONNECTION_STATUSES = [
  'CONNECTED',
  'ERROR',
  'EXPIRED',
  'DISCONNECTED',
  'PENDING',
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const PROVIDER_CAPABILITIES = [
  'ACCOUNT_DISCOVERY',
  'REPORTING_TEST',
  'SEND_EMAIL',
  'BUSINESS_MANAGER',
  'MULTI_ACCOUNT',
  'TOKEN_REFRESH',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export type SyncJobType = 'DISCOVER' | 'TEST' | 'MANUAL_SYNC' | 'REFRESH';
export type SyncJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'PROVIDER_CONFIG_ERROR'
  | 'STATE_MISMATCH'
  | 'MISSING_SCOPES'
  | 'TOKEN_REFRESH_FAILED'
  | 'PERMISSION_DENIED'
  | 'NO_ACCOUNTS'
  | 'UNSUPPORTED_CAPABILITY'
  | 'EXTERNAL_API_ERROR'
  | 'INTERNAL_ERROR';

export type ApiResponse<T> =
  | {
      success: true;
      message: string;
      data: T;
    }
  | {
      success: false;
      errorCode: ApiErrorCode;
      message: string;
      data?: never;
    };

export type OAuthStartResult = {
  authorizationUrl: string;
};

export type CallbackParams = {
  state: string;
  code?: string | null;
  error?: string | null;
  errorDescription?: string | null;
};

export type CallbackResult = {
  connectionId: string;
  status: ConnectionStatus;
};

export type DiscoveredAccount = {
  externalAccountId: string;
  externalParentId?: string | null;
  name: string;
  currency?: string | null;
  timezone?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type TestResult = {
  ok: boolean;
  message: string;
  summary?: Record<string, unknown>;
};

export type ProviderTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scopes?: string[];
  externalUserId?: string;
  externalBusinessId?: string;
  metadata?: Record<string, unknown>;
};

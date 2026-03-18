import type { ApiErrorCode } from './types';

export class IntegrationError extends Error {
  public readonly errorCode: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    errorCode: ApiErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IntegrationError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class OAuthStateMismatchError extends IntegrationError {
  constructor(message = 'OAuth state validation failed.') {
    super('STATE_MISMATCH', message, 400);
    this.name = 'OAuthStateMismatchError';
  }
}

export class MissingScopesError extends IntegrationError {
  constructor(missingScopes: string[]) {
    super('MISSING_SCOPES', 'Required OAuth scopes are missing.', 403, { missingScopes });
    this.name = 'MissingScopesError';
  }
}

export class TokenRefreshError extends IntegrationError {
  constructor(message = 'Failed to refresh access token.') {
    super('TOKEN_REFRESH_FAILED', message, 401);
    this.name = 'TokenRefreshError';
  }
}

export class ProviderConfigError extends IntegrationError {
  constructor(message = 'Provider configuration is missing or invalid.') {
    super('PROVIDER_CONFIG_ERROR', message, 500);
    this.name = 'ProviderConfigError';
  }
}

export class PlatformPermissionError extends IntegrationError {
  constructor(message = 'Platform permission denied.') {
    super('PERMISSION_DENIED', message, 403);
    this.name = 'PlatformPermissionError';
  }
}

export class NoAccountsFoundError extends IntegrationError {
  constructor(message = 'No accounts were found for this connection.') {
    super('NO_ACCOUNTS', message, 404);
    this.name = 'NoAccountsFoundError';
  }
}

export class UnsupportedCapabilityError extends IntegrationError {
  constructor(capability: string, userMessage?: string) {
    super(
      'UNSUPPORTED_CAPABILITY',
      userMessage ?? `Provider does not support requested capability: ${capability}`,
      400,
      { capability }
    );
    this.name = 'UnsupportedCapabilityError';
  }
}

export class ExternalApiError extends IntegrationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('EXTERNAL_API_ERROR', message, 502, details);
    this.name = 'ExternalApiError';
  }
}

export const httpStatusFromError = (error: unknown): number => {
  if (error instanceof IntegrationError) return error.statusCode;
  return 500;
};

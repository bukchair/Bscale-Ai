import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { ExternalApiError } from '@/src/lib/integrations/core/errors';
import { issueOAuthState } from '@/src/lib/integrations/utils/oauth-state';
import type { Platform, ProviderTokenSet } from '@/src/lib/integrations/core/types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

const decodeJwtPayload = (token: string | undefined): Record<string, unknown> | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const exchangeToken = async (payload: URLSearchParams): Promise<GoogleTokenResponse> => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const raw = await response.text();
  let parsed: GoogleTokenResponse | { error?: string; error_description?: string };
  try {
    parsed = JSON.parse(raw) as GoogleTokenResponse | { error?: string; error_description?: string };
  } catch {
    throw new ExternalApiError('Google token exchange failed with non-JSON response.');
  }

  if (!response.ok || !('access_token' in parsed)) {
    throw new ExternalApiError('Google token exchange failed.', {
      status: response.status,
      error: (parsed as { error?: string }).error,
      errorDescription: (parsed as { error_description?: string }).error_description,
    });
  }

  return parsed;
};

export const buildGoogleAuthorizationUrl = async (input: {
  userId: string;
  platform: Platform;
  scopes: readonly string[];
  redirectPath?: string;
  callbackUrl: string;
}) => {
  const stateData = await issueOAuthState(input.userId, input.platform, input.redirectPath);
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', integrationsEnv.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', input.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', input.scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', stateData.state);
  url.searchParams.set('code_challenge', stateData.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

export const exchangeGoogleCodeForTokenSet = async (input: {
  code: string;
  codeVerifier: string;
  callbackUrl: string;
}): Promise<ProviderTokenSet> => {
  const body = new URLSearchParams({
    code: input.code,
    client_id: integrationsEnv.GOOGLE_CLIENT_ID,
    client_secret: integrationsEnv.GOOGLE_CLIENT_SECRET,
    redirect_uri: input.callbackUrl,
    grant_type: 'authorization_code',
    code_verifier: input.codeVerifier,
  });

  const tokenResponse = await exchangeToken(body);
  const idPayload = decodeJwtPayload(tokenResponse.id_token);
  const scopes = tokenResponse.scope ? tokenResponse.scope.split(' ') : [];

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type,
    scopes,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
    externalUserId: idPayload?.sub ? String(idPayload.sub) : undefined,
    metadata: {
      idTokenIssuedAt: idPayload?.iat ?? null,
      idTokenAudience: idPayload?.aud ?? null,
    },
  };
};

export const refreshGoogleTokenSet = async (input: {
  refreshToken: string;
}): Promise<ProviderTokenSet> => {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: integrationsEnv.GOOGLE_CLIENT_ID,
    client_secret: integrationsEnv.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const tokenResponse = await exchangeToken(body);
  const scopes = tokenResponse.scope ? tokenResponse.scope.split(' ') : [];
  return {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type,
    scopes,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
  };
};

/**
 * Managed API client — all fetch calls to /api/connections/*.
 * Accepts ownerUid as a parameter so it can be used outside React state.
 */

import {
  parseManagedPayload,
  type ManagedApiConnection,
  type ManagedPlatformSlug,
  type ManagedPayload,
} from './managedApiHelpers';

// ── Auth helpers ─────────────────────────────────────────────────────────────

// Session is cookie-based; no Firebase token needed.
export const waitForCurrentUser = async () => null;

export const buildWorkspaceHeaders = (_dataOwnerUid: string | null): Record<string, string> => {
  // Workspace is resolved server-side via the session cookie.
  return {};
};

// ── Session bootstrap ─────────────────────────────────────────────────────────

export const ensureManagedApiSession = async () => {
  // Session is maintained via httpOnly cookie — no bootstrap needed.
};

// ── Connections fetch ─────────────────────────────────────────────────────────

export const fetchManagedConnections = async (
  dataOwnerUid: string | null
): Promise<ManagedApiConnection[] | null> => {
  await ensureManagedApiSession();
  const response = await fetch('/api/connections', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: buildWorkspaceHeaders(dataOwnerUid),
  });
  const text = await response.text();
  const payload = parseManagedPayload(text);
  if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.connections)) return null;
  return payload.data.connections as ManagedApiConnection[];
};

// ── Account discovery ─────────────────────────────────────────────────────────

export const autoDiscoverAndSelectManagedAccounts = async (
  platformSlug: 'google-ads' | 'meta' | 'tiktok'
): Promise<void> => {
  await ensureManagedApiSession();
  const discoverResponse = await fetch(`/api/connections/${platformSlug}/accounts`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
  });
  const discoverPayload = parseManagedPayload(await discoverResponse.text());
  if (!discoverResponse.ok || !discoverPayload?.success) return;

  const accounts = Array.isArray(discoverPayload.data?.accounts) ? discoverPayload.data.accounts : [];
  const accountIds = (accounts as { externalAccountId?: string }[])
    .map((a) => String(a.externalAccountId || '').trim())
    .filter(Boolean);
  if (!accountIds.length) return;

  await fetch(`/api/connections/${platformSlug}/select-accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountIds }),
    credentials: 'include',
  });
};

// ── Test connection ───────────────────────────────────────────────────────────

export const postManagedTest = async (
  platformSlug: 'google-ads' | 'meta' | 'tiktok',
  accountId?: string
): Promise<{ success: boolean; message: string }> => {
  await ensureManagedApiSession();
  await autoDiscoverAndSelectManagedAccounts(platformSlug);

  const response = await fetch(`/api/connections/${platformSlug}/test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId }),
    credentials: 'include',
  });
  const payload = parseManagedPayload(await response.text());

  if (!response.ok || !payload?.success) {
    return { success: false, message: payload?.message || `Managed test failed (${response.status}).` };
  }
  return { success: true, message: payload.message || 'Connection test succeeded.' };
};

// ── Disconnect ────────────────────────────────────────────────────────────────

export const disconnectManagedConnection = async (
  platformSlug: ManagedPlatformSlug,
  options?: { skipBootstrap?: boolean }
): Promise<void> => {
  if (!options?.skipBootstrap) await ensureManagedApiSession();

  const runRequest = async () => {
    let response = await fetch(`/api/connections/${platformSlug}/disconnect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    });
    // Defensive fallback for edge proxy/method rewrite issues.
    if (response.status === 405) {
      response = await fetch(`/api/connections/${platformSlug}/disconnect`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
        credentials: 'include',
      });
    }
    const text = await response.text();
    return { response, payload: parseManagedPayload(text), text };
  };

  let { response, payload, text } = await runRequest();

  // Session may expire between calls; retry once after re-bootstrap.
  if (response.status === 401 || response.status === 403) {
    await ensureManagedApiSession();
    ({ response, payload, text } = await runRequest());
  }

  if (!response.ok || !payload?.success) {
    const fallbackMessage = text ? text.slice(0, 180) : `Failed to disconnect ${platformSlug}.`;
    throw new Error(payload?.message || fallbackMessage);
  }
};

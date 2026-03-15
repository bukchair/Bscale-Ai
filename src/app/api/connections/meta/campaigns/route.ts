import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

const getClampedDateRange = (url: URL) => {
  const todayIso = new Date().toISOString().split('T')[0];
  const rawStart = normalizeDateParam(url.searchParams.get('start_date'));
  const rawEnd = normalizeDateParam(url.searchParams.get('end_date'));
  if (!rawStart || !rawEnd) {
    return { startDate: '', endDate: '' };
  }
  const clampedStart = rawStart > todayIso ? todayIso : rawStart;
  const clampedEnd = rawEnd > todayIso ? todayIso : rawEnd;
  if (clampedStart <= clampedEnd) {
    return { startDate: clampedStart, endDate: clampedEnd };
  }
  return { startDate: clampedEnd, endDate: clampedStart };
};

const normalizeMetaAccountId = (value: string) => {
  const trimmed = String(value || '').replace(/^act_/i, '').trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly || trimmed;
};

const toAccountResource = (value: string) => {
  const normalized = normalizeMetaAccountId(value);
  if (!normalized) return '';
  return `act_${normalized}`;
};

const pickSelectedAccountId = (
  connection: Awaited<ReturnType<typeof connectionService.getByUserPlatform>>
) =>
  connection?.connectedAccounts.find(
    (account) => account.isSelected && account.status !== 'ARCHIVED'
  )?.externalAccountId ||
  connection?.connectedAccounts.find((account) => account.status !== 'ARCHIVED')?.externalAccountId ||
  '';

const isKnownManagedAccount = (
  connection: Awaited<ReturnType<typeof connectionService.getByUserPlatform>>,
  candidateAccountId: string
) => {
  const normalizedCandidate = normalizeMetaAccountId(candidateAccountId);
  if (!normalizedCandidate) return false;
  return (connection?.connectedAccounts || []).some(
    (account) =>
      account.status !== 'ARCHIVED' &&
      normalizeMetaAccountId(account.externalAccountId) === normalizedCandidate
  );
};

const isRecoverableAccountError = (status: number, message: string) => {
  if (status !== 400 && status !== 403) return false;
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('unsupported get request') ||
    normalized.includes('does not exist') ||
    normalized.includes('unknown path components') ||
    normalized.includes('cannot access ad account') ||
    normalized.includes('permission') ||
    normalized.includes('no permission') ||
    normalized.includes('invalid parameter')
  );
};

const extractErrorMessage = (status: number, parsed: unknown) => {
  if (!parsed || typeof parsed !== 'object') return `Meta API request failed (${status}).`;
  const objectPayload = parsed as { error?: { message?: string }; message?: string };
  return objectPayload.error?.message || objectPayload.message || `Meta API request failed (${status}).`;
};

const getBearerToken = (request: Request): string => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedAccountId = (url.searchParams.get('ad_account_id') || '').trim();
    const { startDate, endDate } = getClampedDateRange(url);

    let accessToken = getBearerToken(request);
    let resolvedAccountId = requestedAccountId;
    let managedConnection:
      | Awaited<ReturnType<typeof connectionService.getByUserPlatform>>
      | null = null;
    let managedUserId = '';

    // Use managed server token when client token is missing or intentionally masked.
    if (!accessToken || accessToken === 'server-managed') {
      const user = await requireAuthenticatedUser();
      managedUserId = user.id;
      managedConnection = await connectionService.getByUserPlatform(user.id, 'META');
      if (!managedConnection) {
        return NextResponse.json({ message: 'Meta connection is not available for this user.' }, { status: 400 });
      }
      if (resolvedAccountId && !isKnownManagedAccount(managedConnection, resolvedAccountId)) {
        // Ignore stale/foreign account IDs coming from client state.
        resolvedAccountId = '';
      }
      if (!resolvedAccountId) {
        resolvedAccountId = pickSelectedAccountId(managedConnection);
      }
      accessToken = await new MetaProvider().getAccessTokenForConnection(managedConnection.id);
    }

    // Fallback: if connected account wasn't selected/saved, auto-discover and select first.
    if (!resolvedAccountId && managedConnection && managedUserId) {
      try {
        const discovered = await new MetaProvider().discoverAccounts(managedConnection.id);
        if (discovered.length > 0) {
          await connectionService.saveDiscoveredAccounts(managedUserId, managedConnection.id, 'META', discovered);
          await connectionService.setSelectedAccounts(managedUserId, managedConnection.id, [
            discovered[0].externalAccountId,
          ]);
          resolvedAccountId = discovered[0].externalAccountId;
        }
      } catch {
        // Keep fallback flow below for token-only mode.
      }
    }

    // Token-only mode fallback: discover first ad account directly from Meta API.
    if (!resolvedAccountId && accessToken && accessToken !== 'server-managed') {
      try {
        const discoverUrl = new URL(`${META_GRAPH_BASE}/me/adaccounts`);
        discoverUrl.searchParams.set('fields', 'account_id');
        discoverUrl.searchParams.set('limit', '1');
        discoverUrl.searchParams.set('access_token', accessToken);
        const discoverResponse = await fetch(discoverUrl.toString());
        const discoverPayload = (await discoverResponse.json().catch(() => null)) as
          | { data?: Array<{ account_id?: string }> }
          | null;
        resolvedAccountId = String(discoverPayload?.data?.[0]?.account_id || '').trim();
      } catch {
        // If discovery fails, we return explicit error below.
      }
    }

    if (!resolvedAccountId) {
      return NextResponse.json(
        { message: 'Meta account not selected. Reconnect Meta and select an ad account.' },
        { status: 400 }
      );
    }

    const loadCampaigns = async (accountId: string, includeDateRange = true) => {
      const resource = toAccountResource(accountId);
      const graphUrl = new URL(`${META_GRAPH_BASE}/${resource}/campaigns`);
      graphUrl.searchParams.set(
        'fields',
        'id,name,status,objective,start_time,stop_time,insights{spend,inline_link_click_ctr,purchase_roas,roas,actions,action_values}'
      );
      graphUrl.searchParams.set(
        'effective_status',
        JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'WITH_ISSUES', 'DELETED'])
      );
      graphUrl.searchParams.set('limit', '200');
      if (includeDateRange && startDate && endDate) {
        graphUrl.searchParams.set(
          'time_range',
          JSON.stringify({
            since: startDate,
            until: endDate,
          })
        );
      }
      graphUrl.searchParams.set('access_token', accessToken);

      const response = await fetch(graphUrl.toString());
      const raw = await response.text();
      let parsed: unknown = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { message: raw || 'Meta API returned non-JSON response.' };
      }
      return { response, parsed };
    };

    let result = await loadCampaigns(resolvedAccountId, true);
    let response = result.response;
    let parsed = result.parsed;

    // If Meta rejects date filters for the selected account/currency timezone combo, retry once without time_range.
    if (!response.ok && startDate && endDate) {
      const firstErrorMessage = extractErrorMessage(response.status, parsed);
      if (firstErrorMessage.toLowerCase().includes('invalid parameter')) {
        result = await loadCampaigns(resolvedAccountId, false);
        response = result.response;
        parsed = result.parsed;
      }
    }

    // If the account id sent by client is stale/invalid, auto-fallback to a valid managed account.
    if (managedConnection && managedUserId && !response.ok) {
      const firstErrorMessage = extractErrorMessage(response.status, parsed);
      if (isRecoverableAccountError(response.status, firstErrorMessage)) {
        let fallbackAccountId = pickSelectedAccountId(managedConnection);
        if (
          normalizeMetaAccountId(fallbackAccountId) === normalizeMetaAccountId(resolvedAccountId)
        ) {
          fallbackAccountId =
            managedConnection.connectedAccounts.find(
              (account) =>
                account.status !== 'ARCHIVED' &&
                normalizeMetaAccountId(account.externalAccountId) !==
                  normalizeMetaAccountId(resolvedAccountId)
            )?.externalAccountId || '';
        }

        if (!fallbackAccountId) {
          try {
            const discovered = await new MetaProvider().discoverAccounts(managedConnection.id);
            if (discovered.length > 0) {
              await connectionService.saveDiscoveredAccounts(
                managedUserId,
                managedConnection.id,
                'META',
                discovered
              );
              await connectionService.setSelectedAccounts(managedUserId, managedConnection.id, [
                discovered[0].externalAccountId,
              ]);
              fallbackAccountId = discovered[0].externalAccountId;
            }
          } catch {
            // Keep original response if fallback discovery fails.
          }
        }

        if (
          fallbackAccountId &&
          normalizeMetaAccountId(fallbackAccountId) !== normalizeMetaAccountId(resolvedAccountId)
        ) {
          resolvedAccountId = fallbackAccountId;
          result = await loadCampaigns(resolvedAccountId, true);
          response = result.response;
          parsed = result.parsed;
          if (!response.ok && startDate && endDate) {
            const fallbackMessage = extractErrorMessage(response.status, parsed);
            if (fallbackMessage.toLowerCase().includes('invalid parameter')) {
              result = await loadCampaigns(resolvedAccountId, false);
              response = result.response;
              parsed = result.parsed;
            }
          }
        }
      }
    }

    if (!response.ok) {
      const message = extractErrorMessage(response.status, parsed);
      return NextResponse.json({ message }, { status: response.status });
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch Meta campaigns.' },
      { status: 500 }
    );
  }
}

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

const toAccountResource = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
};

const pickSelectedAccountId = (
  connection: Awaited<ReturnType<typeof connectionService.getByUserPlatform>>
) =>
  connection?.connectedAccounts.find((account) => account.isSelected)?.externalAccountId ||
  connection?.connectedAccounts[0]?.externalAccountId ||
  '';

const getBearerToken = (request: Request): string => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedAccountId = (url.searchParams.get('ad_account_id') || '').trim();
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));

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

    const accountResource = toAccountResource(resolvedAccountId);
    const graphUrl = new URL(`${META_GRAPH_BASE}/${accountResource}/campaigns`);
    graphUrl.searchParams.set(
      'fields',
      'id,name,status,objective,start_time,stop_time,insights{spend,inline_link_click_ctr,purchase_roas,roas,actions,action_values}'
    );
    if (startDate && endDate) {
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

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object'
          ? ((parsed as { error?: { message?: string }; message?: string }).error?.message ||
              (parsed as { message?: string }).message ||
              `Meta API request failed (${response.status}).`)
          : `Meta API request failed (${response.status}).`;
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

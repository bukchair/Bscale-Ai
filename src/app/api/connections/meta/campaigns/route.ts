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

    // Use managed server token when client token is missing or intentionally masked.
    if (!accessToken || accessToken === 'server-managed') {
      const user = await requireAuthenticatedUser();
      const connection = await connectionService.getByUserPlatform(user.id, 'META');
      if (!connection) {
        return NextResponse.json({ message: 'Meta connection is not available for this user.' }, { status: 400 });
      }
      if (!resolvedAccountId) {
        resolvedAccountId = pickSelectedAccountId(connection);
      }
      accessToken = await new MetaProvider().getAccessTokenForConnection(connection.id);
    }

    if (!resolvedAccountId) {
      return NextResponse.json({ message: 'Missing Meta ad account ID.' }, { status: 400 });
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

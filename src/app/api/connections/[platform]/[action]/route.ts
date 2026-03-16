import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { integrationOrchestrator } from '@/src/lib/integrations/services/integration-orchestrator';
import { parsePlatformParam, toRoutePlatform } from '@/src/lib/integrations/utils/platform-utils';
import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { ok, toErrorResponse } from '@/src/lib/integrations/utils/api-response';
import {
  selectAccountsSchema,
  syncSchema,
  testConnectionSchema,
} from '@/src/lib/integrations/core/dtos';
import { GMAIL_API_BASE, META_GRAPH_BASE } from '@/src/lib/constants/api-urls';
import { normalizeMetaAccountId, toMetaAccountResource } from '@/src/lib/integrations/utils/meta-utils';

type RouteContext = {
  params: Promise<{ platform: string; action: string }>;
};

const toBase64Url = (input: string) =>
  Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const toErrorMessage = (status: number, raw: string, parsed: unknown) => {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const rootError = obj.error;
    if (rootError && typeof rootError === 'object') {
      const msg = (rootError as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    const msg = obj.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (raw.trim()) return `Gmail send failed (${status}): ${raw.slice(0, 240)}`;
  return `Gmail send failed (${status}).`;
};

const pushUniqueAccount = (
  map: Map<string, { id: string; name: string }>,
  candidate: { id?: string; name?: string },
  fallbackPrefix: string
) => {
  const id = String(candidate?.id || '').trim();
  if (!id) return;
  if (map.has(id)) return;
  map.set(id, {
    id,
    name: String(candidate?.name || `${fallbackPrefix} ${id}`).trim(),
  });
};

const fetchMetaGraph = async <T>(path: string) => {
  const response = await fetch(`${META_GRAPH_BASE}${path}`);
  const parsed = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
  };
};

const handleMetaAssets = async (userId: string) => {
  const connection = await connectionService.getByUserPlatform(userId, 'META');
  if (!connection) {
    return NextResponse.json(
      { success: false, message: 'Meta connection is not available for this user.' },
      { status: 400 }
    );
  }

  const accessToken = await new MetaProvider().getAccessTokenForConnection(connection.id);
  const warnings: string[] = [];

  let adAccounts = connection.connectedAccounts
    .filter((account) => account.status !== 'ARCHIVED')
    .map((account) => ({
      id: normalizeMetaAccountId(account.externalAccountId),
      name: account.name || `Ad account ${account.externalAccountId}`,
      isSelected: account.isSelected,
    }));

  if (!adAccounts.length) {
    try {
      const discovered = await new MetaProvider().discoverAccounts(connection.id);
      if (discovered.length > 0) {
        await connectionService.saveDiscoveredAccounts(userId, connection.id, 'META', discovered);
        await connectionService.setSelectedAccounts(userId, connection.id, [discovered[0].externalAccountId]);
        adAccounts = discovered.map((account, index) => ({
          id: normalizeMetaAccountId(account.externalAccountId),
          name: account.name || `Ad account ${account.externalAccountId}`,
          isSelected: index === 0,
        }));
      }
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : 'Failed to auto-discover Meta ad accounts.'
      );
    }
  }

  const businessResponse = await fetchMetaGraph<{ data?: Array<{ id?: string; name?: string }> }>(
    `/me/businesses?fields=id,name&limit=200&access_token=${encodeURIComponent(accessToken)}`
  );
  const businesses = (businessResponse.data?.data || [])
    .filter((item) => item?.id)
    .map((item) => ({
      id: String(item.id).trim(),
      name: String(item.name || item.id).trim(),
    }));
  if (!businessResponse.ok) {
    warnings.push(
      businessResponse.data?.error?.message ||
        `Failed to load Meta businesses (${businessResponse.status}).`
    );
  }

  const messageAccountsMap = new Map<string, { id: string; name: string }>();
  const messageResponse = await fetchMetaGraph<{ data?: Array<{ id?: string; name?: string }> }>(
    `/me/accounts?fields=id,name&limit=200&access_token=${encodeURIComponent(accessToken)}`
  );
  for (const account of messageResponse.data?.data || []) {
    pushUniqueAccount(messageAccountsMap, account, 'Page');
  }
  if (!messageResponse.ok) {
    warnings.push(
      messageResponse.data?.error?.message ||
        `Failed to load Meta messaging accounts (${messageResponse.status}).`
    );
  }

  for (const business of businesses) {
    const businessPages = await fetchMetaGraph<{ data?: Array<{ id?: string; name?: string }> }>(
      `/${encodeURIComponent(business.id)}/owned_pages?fields=id,name&limit=200&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (businessPages.ok) {
      for (const page of businessPages.data?.data || []) {
        pushUniqueAccount(messageAccountsMap, page, 'Page');
      }
    }
  }

  const messageAccounts = Array.from(messageAccountsMap.values());

  const accountIdsForPixels = adAccounts.map((account) => account.id).filter(Boolean);
  const pixelsMap = new Map<string, { id: string; name: string; adAccountId: string }>();
  for (const accountId of accountIdsForPixels) {
    const accountResource = toMetaAccountResource(accountId);
    if (!accountResource) continue;
    const pixelResponse = await fetchMetaGraph<{ data?: Array<{ id?: string; name?: string }> }>(
      `/${accountResource}/adspixels?fields=id,name&limit=200&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!pixelResponse.ok) continue;
    for (const pixel of pixelResponse.data?.data || []) {
      const pixelId = String(pixel?.id || '').trim();
      if (!pixelId) continue;
      pixelsMap.set(`${accountId}:${pixelId}`, {
        id: pixelId,
        name: String(pixel?.name || pixelId).trim(),
        adAccountId: accountId,
      });
    }
  }
  const selectedAdAccount = adAccounts.find((account) => account.isSelected)?.id || adAccounts[0]?.id || '';
  const pixels = Array.from(pixelsMap.values());

  return ok('Meta assets loaded successfully.', {
    adAccounts,
    businesses,
    messageAccounts,
    pixels,
    warnings,
    defaultAdAccountId: selectedAdAccount,
    defaultBusinessId: businesses[0]?.id || '',
    defaultMessageAccountId: messageAccounts[0]?.id || '',
    defaultPixelId:
      pixels.find((pixel) => pixel.adAccountId === selectedAdAccount)?.id || pixels[0]?.id || '',
  });
};

const handleTikTokCampaigns = async (request: Request) => {
  const url = new URL(request.url);
  const advertiserId = (url.searchParams.get('advertiser_id') || '').trim();
  const startDateParam = (url.searchParams.get('start_date') || '').trim();
  const endDateParam = (url.searchParams.get('end_date') || '').trim();
  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !advertiserId) {
    return NextResponse.json({ message: 'Missing access token or advertiser ID' }, { status: 400 });
  }

  const campaignUrl = `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${encodeURIComponent(advertiserId)}`;
  const campaignsResponse = await fetch(campaignUrl, {
    headers: {
      'Access-Token': accessToken,
    },
  });
  const campaignsData = (await campaignsResponse.json()) as Record<string, unknown>;
  if (!campaignsResponse.ok) {
    return NextResponse.json(
      {
        message: (campaignsData?.message as string | undefined) || 'TikTok API error',
      },
      { status: campaignsResponse.status }
    );
  }
  const campaignData = campaignsData?.data as { list?: unknown[] } | undefined;
  const list = Array.isArray(campaignData?.list) ? campaignData.list : [];
  const campaignIds = list
    .map((campaign) => {
      const row = campaign as Record<string, unknown>;
      const id = row?.campaign_id ?? row?.id;
      return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
    })
    .filter(Boolean);

  if (!campaignIds.length) return NextResponse.json(campaignsData, { status: 200 });

  const endDate = endDateParam ? new Date(`${endDateParam}T23:59:59.999Z`) : new Date();
  const startDate = startDateParam
    ? new Date(`${startDateParam}T00:00:00.000Z`)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const asDate = (value: Date) => value.toISOString().slice(0, 10);
  const reportPayload = {
    advertiser_id: advertiserId,
    service_type: 'AUCTION',
    report_type: 'BASIC',
    data_level: 'AUCTION_CAMPAIGN',
    dimensions: ['campaign_id'],
    metrics: ['spend', 'conversions', 'conversion_value'],
    start_date: asDate(startDate),
    end_date: asDate(endDate),
    page: 1,
    page_size: 1000,
    filtering: [{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: campaignIds }],
  };
  const statsByCampaignId: Record<string, { spend: number; conversions: number; conversionValue: number }> = {};
  const reportEndpoints = [
    'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
    'https://business-api.tiktok.com/open_api/v1.3/reports/integrated/get/',
  ];
  for (const endpoint of reportEndpoints) {
    try {
      const reportResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportPayload),
      });
      const reportData = (await reportResponse.json()) as Record<string, unknown>;
      if (!reportResponse.ok || reportData?.code !== 0) continue;
      const reportRowsData = reportData?.data as { list?: unknown[] } | unknown[] | undefined;
      const rows = Array.isArray((reportRowsData as { list?: unknown[] })?.list)
        ? ((reportRowsData as { list?: unknown[] }).list as unknown[])
        : Array.isArray(reportRowsData)
        ? reportRowsData
        : [];
      rows.forEach((row) => {
        const item = row as Record<string, unknown>;
        const dimensions = (item?.dimensions || item?.dimension || {}) as Record<string, unknown>;
        const metrics = (item?.metrics || {}) as Record<string, unknown>;
        const campaignId = String(dimensions?.campaign_id || item?.campaign_id || item?.campaignId || '');
        if (!campaignId) return;
        statsByCampaignId[campaignId] = {
          spend: parseFloat(String(metrics?.spend ?? item?.spend ?? 0)) || 0,
          conversions: parseFloat(String(metrics?.conversions ?? item?.conversions ?? 0)) || 0,
          conversionValue:
            parseFloat(
              String(metrics?.conversion_value ?? metrics?.convert_value ?? item?.conversion_value ?? item?.convert_value ?? 0)
            ) || 0,
        };
      });
      break;
    } catch {
      continue;
    }
  }
  const mergedList = list.map((campaign) => {
    const row = campaign as Record<string, unknown>;
    const campaignId = String(row?.campaign_id || row?.id || '');
    const stats = statsByCampaignId[campaignId];
    if (!stats) return campaign;
    return {
      ...row,
      stats: {
        ...((row?.stats as Record<string, unknown>) || {}),
        spend: stats.spend,
        conversions: stats.conversions,
        conversion_value: stats.conversionValue,
      },
    };
  });
  return NextResponse.json(
    {
      ...campaignsData,
      data: {
        ...(campaignData || {}),
        list: mergedList,
      },
    },
    { status: 200 }
  );
};

const handleGoogleGmailSend = async (request: Request, userId: string) => {
  const payload = (await request.json().catch(() => ({}))) as { to?: string; subject?: string; body?: string };
  if (!payload.to || !payload.subject || !payload.body) {
    return NextResponse.json({ message: 'Missing to/subject/body in Gmail send request.' }, { status: 400 });
  }
  const { accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(userId, 'GMAIL', {
    allowGoogleAdsFallback: true,
  });
  const mime = [
    `To: ${payload.to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${Buffer.from(payload.subject).toString('base64')}?=`,
    '',
    payload.body,
  ].join('\n');
  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    return NextResponse.json(
      { message: toErrorMessage(response.status, raw, parsed) },
      { status: response.status }
    );
  }
  return NextResponse.json(parsed, { status: 200 });
};

const runAction = async (request: Request, context: RouteContext) => {
  const user = await requireAuthenticatedUser();
  const { platform: platformParam, action } = await context.params;

  if (platformParam === 'meta' && action === 'assets' && request.method === 'GET') {
    return handleMetaAssets(user.id);
  }
  if (platformParam === 'tiktok' && action === 'campaigns' && request.method === 'GET') {
    return handleTikTokCampaigns(request);
  }
  if (platformParam === 'google' && action === 'gmail-send' && request.method === 'POST') {
    return handleGoogleGmailSend(request, user.id);
  }

  const platform = parsePlatformParam(platformParam);
  if (action === 'start' && (request.method === 'POST' || request.method === 'GET')) {
    const data = await integrationOrchestrator.startConnection(user.id, platform);
    return ok('Connection flow started.', data);
  }
  if (action === 'callback' && request.method === 'GET') {
    const url = new URL(request.url);
    const result = await integrationOrchestrator.handleCallback(user.id, platform, {
      state: url.searchParams.get('state'),
      code: url.searchParams.get('code'),
      error: url.searchParams.get('error'),
      error_description: url.searchParams.get('error_description'),
    });
    const redirect = new URL('/connections', integrationsEnv.APP_BASE_URL);
    redirect.searchParams.set('platform', toRoutePlatform(platform));
    redirect.searchParams.set('status', result.status.toLowerCase());
    redirect.searchParams.set('connected', '1');
    return NextResponse.redirect(redirect);
  }
  if (action === 'accounts' && request.method === 'GET') {
    const accounts = await integrationOrchestrator.discoverAccounts(user.id, platform);
    return ok('Accounts discovered successfully.', { accounts });
  }
  if (action === 'test' && request.method === 'POST') {
    const payload = testConnectionSchema.parse(await request.json().catch(() => ({})));
    const result = await integrationOrchestrator.testConnection(user.id, platform, payload.accountId);
    return ok('Connection test completed.', result);
  }
  if (action === 'sync' && request.method === 'POST') {
    const payload = syncSchema.parse(await request.json().catch(() => ({})));
    const result = await integrationOrchestrator.syncNow(
      user.id,
      platform,
      payload.accountId,
      payload.forceRefresh
    );
    return ok('Manual sync completed.', result);
  }
  if (action === 'select-accounts' && request.method === 'POST') {
    const payload = selectAccountsSchema.parse(await request.json());
    await integrationOrchestrator.selectAccounts(user.id, platform, payload.accountIds);
    return ok('Selected accounts were updated.', { selectedAccountIds: payload.accountIds });
  }
  if (action === 'disconnect' && (request.method === 'POST' || request.method === 'GET')) {
    await integrationOrchestrator.disconnect(user.id, platform);
    return ok('Platform disconnected successfully.', { disconnected: true });
  }

  return NextResponse.json({ message: 'Unsupported action.' }, { status: 404 });
};

export async function GET(request: Request, context: RouteContext) {
  try {
    return await runAction(request, context);
  } catch (error) {
    if (error instanceof Error && String(error.message || '').toLowerCase().includes('callback')) {
      const redirect = new URL('/connections', integrationsEnv.APP_BASE_URL);
      redirect.searchParams.set('connected', '0');
      redirect.searchParams.set('error', error.message);
      return NextResponse.redirect(redirect);
    }
    return toErrorResponse(error, 'Failed to execute action.');
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    return await runAction(request, context);
  } catch (error) {
    return toErrorResponse(error, 'Failed to execute action.');
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      allow: 'GET, POST, OPTIONS',
    },
  });
}

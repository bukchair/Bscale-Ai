import { NextResponse } from 'next/server';

const getBearerToken = (request: Request): string => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDateParam = (value: string | null) => {
  const trimmed = (value || '').trim();
  return DATE_PARAM_REGEX.test(trimmed) ? trimmed : '';
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const advertiserId = (url.searchParams.get('advertiser_id') || '').trim();
    const startDateParam = normalizeDateParam(url.searchParams.get('start_date'));
    const endDateParam = normalizeDateParam(url.searchParams.get('end_date'));
    const accessToken = getBearerToken(request);

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
          message:
            (campaignsData?.message as string | undefined) || 'TikTok API error',
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

    if (!campaignIds.length) {
      return NextResponse.json(campaignsData, { status: 200 });
    }

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
          const campaignId = String(
            dimensions?.campaign_id || item?.campaign_id || item?.campaignId || ''
          );
          if (!campaignId) return;
          statsByCampaignId[campaignId] = {
            spend: parseFloat(String(metrics?.spend ?? item?.spend ?? 0)) || 0,
            conversions: parseFloat(String(metrics?.conversions ?? item?.conversions ?? 0)) || 0,
            conversionValue:
              parseFloat(
                String(
                  metrics?.conversion_value ??
                    metrics?.convert_value ??
                    item?.conversion_value ??
                    item?.convert_value ??
                    0
                )
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
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch TikTok campaigns' },
      { status: 500 }
    );
  }
}

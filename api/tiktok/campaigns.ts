/**
 * Vercel Serverless: GET /api/tiktok/campaigns
 * Fetches TikTok ad campaigns. Query: advertiser_id. Header: Authorization: Bearer <token>
 * (TikTok API expects Access-Token header; we accept Bearer and forward as Access-Token.)
 */

export default async function handler(
  req: { method?: string; query?: { advertiser_id?: string }; headers?: { authorization?: string } },
  res: { status: (n: number) => { json: (o: object) => void }; json: (o: object) => void }
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = req.headers?.authorization;
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const advertiserId = req.query?.advertiser_id;

  if (!accessToken || !advertiserId) {
    return res.status(400).json({ message: 'Missing access token or advertiser ID' });
  }

  try {
    const campaignUrl = `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${encodeURIComponent(advertiserId)}`;
    const campaignsResponse = await fetch(campaignUrl, {
      headers: {
        'Access-Token': accessToken,
      },
    });

    const campaignsData = await campaignsResponse.json();
    if (!campaignsResponse.ok) {
      return res.status(campaignsResponse.status).json({ message: campaignsData.message || 'TikTok API error' });
    }

    const list = Array.isArray(campaignsData?.data?.list) ? campaignsData.data.list : [];
    const campaignIds = list.map((c: any) => String(c?.campaign_id || c?.id || '')).filter(Boolean);

    const buildMergedPayload = (statsByCampaignId: Record<string, { spend: number; conversions: number; conversionValue: number }>) => {
      const mergedList = list.map((campaign: any) => {
        const campaignId = String(campaign?.campaign_id || campaign?.id || '');
        const stats = statsByCampaignId[campaignId];
        if (!stats) return campaign;
        return {
          ...campaign,
          stats: {
            ...(campaign.stats || {}),
            spend: stats.spend,
            conversions: stats.conversions,
            conversion_value: stats.conversionValue,
          },
        };
      });

      return {
        ...campaignsData,
        data: {
          ...(campaignsData?.data || {}),
          list: mergedList,
        },
      };
    };

    if (!campaignIds.length) {
      return res.status(200).json(campaignsData);
    }

    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const asDate = (d: Date) => d.toISOString().slice(0, 10);
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
        const reportData = await reportResponse.json();
        if (!reportResponse.ok || reportData?.code !== 0) continue;

        const rows = Array.isArray(reportData?.data?.list)
          ? reportData.data.list
          : Array.isArray(reportData?.data)
          ? reportData.data
          : [];

        rows.forEach((row: any) => {
          const dimensions = row?.dimensions || row?.dimension || {};
          const metrics = row?.metrics || {};
          const campaignId = String(
            dimensions?.campaign_id || row?.campaign_id || row?.campaignId || ''
          );
          if (!campaignId) return;
          statsByCampaignId[campaignId] = {
            spend: parseFloat(metrics?.spend || row?.spend || 0) || 0,
            conversions: parseFloat(metrics?.conversions || row?.conversions || 0) || 0,
            conversionValue:
              parseFloat(metrics?.conversion_value || metrics?.convert_value || row?.conversion_value || row?.convert_value || 0) || 0,
          };
        });
        break;
      } catch {
        continue;
      }
    }

    return res.status(200).json(buildMergedPayload(statsByCampaignId));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch TikTok campaigns';
    return res.status(500).json({ message });
  }
}

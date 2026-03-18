import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/src/lib/auth/session';
import { httpStatusFromError } from '@/src/lib/integrations/core/errors';
import { connectionService } from '@/src/lib/integrations/services/connection-service';
import { MetaProvider } from '@/src/lib/integrations/providers/meta/provider';
import { META_GRAPH_BASE } from '@/src/lib/constants/api-urls';
import { normalizeMetaAccountId, toMetaAccountResource } from '@/src/lib/integrations/utils/meta-utils';
import { normalizeDateParam } from '@/src/lib/utils/api-request-utils';

const getBearerToken = (request: Request): string => {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

const extractErrorMessage = (status: number, parsed: unknown) => {
  if (!parsed || typeof parsed !== 'object') return `Meta API request failed (${status}).`;
  const obj = parsed as { error?: { message?: string }; message?: string };
  return obj.error?.message || obj.message || `Meta API request failed (${status}).`;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignIds = (url.searchParams.get('campaign_ids') || '').split(',').map(s => s.trim()).filter(Boolean);
    const adAccountId = (url.searchParams.get('ad_account_id') || '').trim();
    const startDate = normalizeDateParam(url.searchParams.get('start_date'));
    const endDate = normalizeDateParam(url.searchParams.get('end_date'));

    let accessToken = getBearerToken(request);
    let resolvedAccountId = adAccountId;

    if (!accessToken || accessToken === 'server-managed') {
      const user = await requireAuthenticatedUser();
      const managedConnection = await connectionService.getByUserPlatform(user.id, 'META');
      if (!managedConnection) {
        return NextResponse.json({ message: 'Meta connection not available.' }, { status: 400 });
      }
      accessToken = await new MetaProvider().getAccessTokenForConnection(managedConnection.id, user.id);
      if (!resolvedAccountId) {
        resolvedAccountId =
          managedConnection.connectedAccounts.find((a) => a.isSelected && a.status !== 'ARCHIVED')?.externalAccountId ||
          managedConnection.connectedAccounts.find((a) => a.status !== 'ARCHIVED')?.externalAccountId ||
          '';
      }
    }

    if (!resolvedAccountId && !campaignIds.length) {
      return NextResponse.json({ message: 'Missing ad_account_id or campaign_ids.' }, { status: 400 });
    }

    const insightsFields =
      'spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,purchase_roas,actions,action_values,unique_clicks,unique_ctr';
    const timeRangeParam = startDate && endDate
      ? JSON.stringify({ since: startDate, until: endDate })
      : null;

    const fetchAdsets = async (source: 'account' | 'campaign', sourceId: string) => {
      const resource =
        source === 'account'
          ? `${toMetaAccountResource(sourceId)}/adsets`
          : `${sourceId}/adsets`;
      const fieldsVariants = [
        `id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,bid_strategy,optimization_goal,billing_event,targeting,start_time,end_time,insights{${insightsFields}}`,
        `id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,insights{spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,purchase_roas,actions,action_values}`,
        `id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,insights{spend,impressions,clicks}`,
        `id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget`,
      ];

      for (const fields of fieldsVariants) {
        const graphUrl = new URL(`${META_GRAPH_BASE}/${resource}`);
        graphUrl.searchParams.set('fields', fields);
        graphUrl.searchParams.set('limit', '500');
        if (timeRangeParam) {
          graphUrl.searchParams.set('time_range', timeRangeParam);
        }
        if (campaignIds.length) {
          graphUrl.searchParams.set(
            'filtering',
            JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }])
          );
        }
        const response = await fetch(graphUrl.toString(), {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        const raw = await response.text();
        let parsed: unknown = {};
        try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

        if (response.ok) {
          return (parsed as { data?: unknown[] }).data || [];
        }
        const message = extractErrorMessage(response.status, parsed).toLowerCase();
        const isFieldError =
          message.includes('invalid parameter') ||
          message.includes('nonexisting field') ||
          message.includes('nonexistent field') ||
          message.includes('unsupported') ||
          message.includes('unknown field');
        if (!isFieldError) break;
      }
      return [];
    };

    let adsets: unknown[] = [];

    if (campaignIds.length > 0) {
      // Fetch adsets filtered by campaign IDs via account endpoint (most efficient)
      adsets = await fetchAdsets('account', resolvedAccountId || campaignIds[0]);
      // If that returns nothing and we have campaign IDs, try per-campaign
      if (adsets.length === 0) {
        for (const campaignId of campaignIds.slice(0, 10)) {
          const rows = await fetchAdsets('campaign', campaignId);
          adsets = [...adsets, ...rows];
        }
      }
    } else if (resolvedAccountId) {
      adsets = await fetchAdsets('account', resolvedAccountId);
    }

    // Map adsets to a clean format with flattened insights
    const mapped = (adsets as any[]).map((a) => {
      const insights = a.insights?.data?.[0] || {};
      const spend = parseFloat(insights.spend || 0) || 0;
      const impressions = parseFloat(insights.impressions || 0) || 0;
      const clicks = parseFloat(insights.clicks || 0) || 0;
      const reach = parseFloat(insights.reach || 0) || 0;
      const ctr = parseFloat(insights.ctr || 0) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
      const cpc = parseFloat(insights.cpc || 0) || (clicks > 0 ? spend / clicks : 0);
      const cpm = parseFloat(insights.cpm || 0) || (impressions > 0 ? (spend / impressions) * 1000 : 0);
      const frequency = parseFloat(insights.frequency || 0) || (reach > 0 ? impressions / reach : 0);
      const uniqueClicks = parseFloat(insights.unique_clicks || 0) || 0;
      const uniqueCtr = parseFloat(insights.unique_ctr || 0) || 0;
      const actions = Array.isArray(insights.actions) ? insights.actions : [];
      const actionValues = Array.isArray(insights.action_values) ? insights.action_values : [];
      const purchaseTypes = new Set(['purchase', 'offsite_conversion.purchase', 'omni_purchase', 'onsite_conversion.purchase']);
      const conversions = actions.reduce((sum: number, action: any) => {
        if (!purchaseTypes.has(String(action?.action_type || ''))) return sum;
        return sum + (parseFloat(action?.value || 0) || 0);
      }, 0);
      const conversionValue = actionValues.reduce((sum: number, action: any) => {
        if (!purchaseTypes.has(String(action?.action_type || ''))) return sum;
        return sum + (parseFloat(action?.value || 0) || 0);
      }, 0);
      const roasFromInsight =
        Array.isArray(insights.purchase_roas) && insights.purchase_roas[0]?.value != null
          ? parseFloat(insights.purchase_roas[0].value || 0)
          : 0;
      const roas = roasFromInsight > 0 ? roasFromInsight : spend > 0 ? conversionValue / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      return {
        id: a.id,
        name: a.name,
        status: a.effective_status || a.status,
        campaignId: a.campaign_id,
        dailyBudget: parseFloat(a.daily_budget || 0) / 100 || 0,
        lifetimeBudget: parseFloat(a.lifetime_budget || 0) / 100 || 0,
        optimizationGoal: a.optimization_goal || '',
        bidStrategy: a.bid_strategy || '',
        billingEvent: a.billing_event || '',
        startTime: a.start_time || '',
        endTime: a.end_time || '',
        spend,
        impressions,
        clicks,
        reach,
        ctr,
        cpc,
        cpm,
        frequency,
        uniqueClicks,
        uniqueCtr,
        conversions,
        conversionValue,
        roas,
        cpa,
      };
    });

    return NextResponse.json({ data: mapped }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to fetch Meta adsets.' },
      { status: httpStatusFromError(error) }
    );
  }
}

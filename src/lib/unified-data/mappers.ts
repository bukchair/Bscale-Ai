import {
  createEmptyUnifiedDataLayer,
  type UnifiedBudgetSnapshot,
  type UnifiedCampaign,
  type UnifiedDataLayer,
  type UnifiedDateRange,
  type UnifiedEntityStatus,
  type UnifiedPlatform,
} from './types';

type MapContext = {
  accountExternalId?: string;
  accountName?: string;
  currency?: string;
  timezone?: string;
  dateRange?: UnifiedDateRange;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toStringSafe = (value: unknown): string => String(value ?? '').trim();

const normalizeStatus = (value: unknown): UnifiedEntityStatus => {
  const raw = toStringSafe(value).toLowerCase();
  if (!raw) return 'UNKNOWN';
  if (raw.includes('removed') || raw.includes('archived') || raw.includes('deleted')) return 'REMOVED';
  if (raw.includes('draft')) return 'DRAFT';
  if (raw.includes('pending') || raw.includes('review') || raw.includes('learning')) return 'PENDING';
  if (raw.includes('pause') || raw.includes('disable')) return 'PAUSED';
  if (raw.includes('active') || raw.includes('enable') || raw.includes('serving')) return 'ACTIVE';
  return 'UNKNOWN';
};

const toUiStatus = (status: UnifiedEntityStatus): string => {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'REMOVED') return 'Removed';
  if (status === 'PENDING') return 'Pending';
  if (status === 'DRAFT') return 'Draft';
  return 'Unknown';
};

const platformKey = (platform: UnifiedPlatform) => platform.toLowerCase();

const createAccountId = (platform: UnifiedPlatform, externalId: string) =>
  `${platformKey(platform)}:account:${externalId || 'unknown'}`;

const createCampaignId = (platform: UnifiedPlatform, externalCampaignId: string) =>
  `${platformKey(platform)}:campaign:${externalCampaignId || 'unknown'}`;

const createAggregateAdGroupId = (campaignId: string) => `${campaignId}:adgroup:aggregate`;
const createAggregateAdId = (campaignId: string) => `${campaignId}:ad:aggregate`;

const mergeById = <T extends { id: string }>(rows: T[]): T[] => {
  const map = new Map<string, T>();
  rows.forEach((row) => map.set(row.id, row));
  return [...map.values()];
};

const mapCampaignRows = (
  platform: UnifiedPlatform,
  rows: Record<string, unknown>[],
  context: MapContext = {}
): UnifiedDataLayer => {
  const output = createEmptyUnifiedDataLayer();
  const accountSeen = new Set<string>();

  rows.forEach((rawRow, index: number) => {
    const row = rawRow ?? {};
    const externalCampaignId =
      toStringSafe(row.campaignId) || toStringSafe(row.id) || `${platformKey(platform)}-campaign-${index}`;
    const accountExternalId =
      toStringSafe(context.accountExternalId) ||
      toStringSafe(row.accountId) ||
      toStringSafe(row.advertiserId) ||
      'unknown';
    const accountId = createAccountId(platform, accountExternalId);
    const campaignId = createCampaignId(platform, externalCampaignId);
    const budgetId = `${campaignId}:budget`;
    const adGroupId = createAggregateAdGroupId(campaignId);
    const adId = createAggregateAdId(campaignId);
    const status = normalizeStatus(row.status);

    if (!accountSeen.has(accountId)) {
      accountSeen.add(accountId);
      output.accounts.push({
        id: accountId,
        platform,
        externalId: accountExternalId,
        name: toStringSafe(context.accountName) || accountExternalId,
        currency: toStringSafe(context.currency) || toStringSafe(row.currency) || undefined,
        timezone: toStringSafe(context.timezone) || undefined,
        status,
      });
    }

    const campaignName =
      toStringSafe(row.name) ||
      toStringSafe(row.campaignName) ||
      `${platform} Campaign ${externalCampaignId}`;
    const objective =
      toStringSafe(row.objective) ||
      toStringSafe(row.advertisingChannelType) ||
      toStringSafe(row.campaignType);
    const channelType =
      toStringSafe(row.advertisingChannelSubType) ||
      toStringSafe(row.advertisingChannelType) ||
      toStringSafe(row.campaignType);

    const campaign: UnifiedCampaign = {
      id: campaignId,
      platform,
      externalId: externalCampaignId,
      accountId,
      name: campaignName,
      status,
      objective: objective || undefined,
      channelType: channelType || undefined,
      startDate: toStringSafe(row.startDate) || toStringSafe(row.startTime) || undefined,
      endDate: toStringSafe(row.endDate) || toStringSafe(row.stopTime) || undefined,
      budgetId,
      adGroupIds: [adGroupId],
      adIds: [adId],
      providerData: row,
    };
    output.campaigns.push(campaign);

    output.adGroups.push({
      id: adGroupId,
      platform,
      externalId: `${externalCampaignId}:aggregate`,
      accountId,
      campaignId,
      name: `${campaignName} / Aggregate group`,
      status,
      isAggregate: true,
    });

    output.ads.push({
      id: adId,
      platform,
      externalId: `${externalCampaignId}:aggregate`,
      accountId,
      campaignId,
      adGroupId,
      name: `${campaignName} / Aggregate ad`,
      status,
      isAggregate: true,
    });

    const impressions = toNumber(row.impressions);
    const clicks = toNumber(row.clicks);
    const reach = toNumber(row.reach);
    const spend = toNumber(row.spend);
    const conversions = toNumber(row.conversions);
    const conversionValue = toNumber(row.conversionValue);
    const ctr = toNumber(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
    const cpc = toNumber(row.cpc) || (clicks > 0 ? spend / clicks : 0);
    const cpm = toNumber(row.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0);
    const frequency = toNumber(row.frequency) || (reach > 0 ? impressions / reach : 0);
    const roas = toNumber(row.roas) || (spend > 0 ? conversionValue / spend : 0);
    const cpa = toNumber(row.cpa) || (conversions > 0 ? spend / conversions : 0);

    output.metrics.push({
      id: `${campaignId}:metrics`,
      platform,
      entityType: 'campaign',
      entityId: campaignId,
      dateRange: context.dateRange,
      impressions,
      clicks,
      reach,
      frequency,
      spend,
      ctr,
      cpc,
      cpm,
      roas,
      cpa,
    });

    output.conversions.push({
      id: `${campaignId}:conversions`,
      platform,
      entityType: 'campaign',
      entityId: campaignId,
      dateRange: context.dateRange,
      count: conversions,
      value: conversionValue,
    });

    const dailyAmount = toNumber(row.dailyBudget) || toNumber(row.budget);
    const lifetimeAmount = toNumber(row.lifetimeBudget);
    const budget: UnifiedBudgetSnapshot = {
      id: budgetId,
      platform,
      entityType: 'campaign',
      entityId: campaignId,
      dailyAmount: dailyAmount > 0 ? dailyAmount : undefined,
      lifetimeAmount: lifetimeAmount > 0 ? lifetimeAmount : undefined,
      currency: toStringSafe(context.currency) || toStringSafe(row.currency) || undefined,
      period: toStringSafe(row.budgetPeriod) || undefined,
    };
    if (budget.dailyAmount || budget.lifetimeAmount) {
      output.budgets.push(budget);
    }
  });

  output.generatedAt = new Date().toISOString();
  output.accounts = mergeById(output.accounts);
  output.campaigns = mergeById(output.campaigns);
  output.adGroups = mergeById(output.adGroups);
  output.ads = mergeById(output.ads);
  output.metrics = mergeById(output.metrics);
  output.conversions = mergeById(output.conversions);
  output.budgets = mergeById(output.budgets);
  return output;
};

export const mapGoogleCampaignRowsToUnifiedLayer = (
  rows: Record<string, unknown>[],
  context: MapContext = {}
): UnifiedDataLayer => mapCampaignRows('Google', rows, context);

export const mapMetaCampaignRowsToUnifiedLayer = (
  rows: Record<string, unknown>[],
  context: MapContext = {}
): UnifiedDataLayer => mapCampaignRows('Meta', rows, context);

export const mapTikTokCampaignRowsToUnifiedLayer = (
  rows: Record<string, unknown>[],
  context: MapContext = {}
): UnifiedDataLayer => mapCampaignRows('TikTok', rows, context);

export const mergeUnifiedDataLayers = (layers: UnifiedDataLayer[]): UnifiedDataLayer => {
  const merged = createEmptyUnifiedDataLayer();
  layers.forEach((layer) => {
    if (!layer) return;
    merged.accounts.push(...(layer.accounts || []));
    merged.campaigns.push(...(layer.campaigns || []));
    merged.adGroups.push(...(layer.adGroups || []));
    merged.ads.push(...(layer.ads || []));
    merged.metrics.push(...(layer.metrics || []));
    merged.conversions.push(...(layer.conversions || []));
    merged.budgets.push(...(layer.budgets || []));
  });

  merged.generatedAt = new Date().toISOString();
  merged.accounts = mergeById(merged.accounts);
  merged.campaigns = mergeById(merged.campaigns);
  merged.adGroups = mergeById(merged.adGroups);
  merged.ads = mergeById(merged.ads);
  merged.metrics = mergeById(merged.metrics);
  merged.conversions = mergeById(merged.conversions);
  merged.budgets = mergeById(merged.budgets);
  return merged;
};

export const replaceUnifiedPlatformSlice = (
  base: UnifiedDataLayer,
  platform: UnifiedPlatform,
  incoming: UnifiedDataLayer
): UnifiedDataLayer => {
  const withoutPlatform: UnifiedDataLayer = {
    generatedAt: base.generatedAt,
    accounts: base.accounts.filter((row) => row.platform !== platform),
    campaigns: base.campaigns.filter((row) => row.platform !== platform),
    adGroups: base.adGroups.filter((row) => row.platform !== platform),
    ads: base.ads.filter((row) => row.platform !== platform),
    metrics: base.metrics.filter((row) => row.platform !== platform),
    conversions: base.conversions.filter((row) => row.platform !== platform),
    budgets: base.budgets.filter((row) => row.platform !== platform),
  };
  return mergeUnifiedDataLayers([withoutPlatform, incoming]);
};

export const unifiedLayerToCampaignRows = (layer: UnifiedDataLayer): Record<string, unknown>[] => {
  const accountById = new Map(layer.accounts.map((account) => [account.id, account]));
  const metricByCampaignId = new Map(
    layer.metrics
      .filter((row) => row.entityType === 'campaign')
      .map((row) => [row.entityId, row])
  );
  const conversionByCampaignId = new Map(
    layer.conversions
      .filter((row) => row.entityType === 'campaign')
      .map((row) => [row.entityId, row])
  );
  const budgetByCampaignId = new Map(
    layer.budgets
      .filter((row) => row.entityType === 'campaign')
      .map((row) => [row.entityId, row])
  );

  return layer.campaigns.map((campaign) => {
    const providerData = (campaign.providerData || {}) as Record<string, unknown>;
    const metric = metricByCampaignId.get(campaign.id);
    const conversion = conversionByCampaignId.get(campaign.id);
    const budget = budgetByCampaignId.get(campaign.id);
    const account = accountById.get(campaign.accountId);

    const spend = metric?.spend ?? toNumber(providerData.spend);
    const conversions = conversion?.count ?? toNumber(providerData.conversions);
    const conversionValue = conversion?.value ?? toNumber(providerData.conversionValue);
    const roas = metric?.roas ?? (spend > 0 ? conversionValue / spend : 0);
    const cpa = metric?.cpa ?? (conversions > 0 ? spend / conversions : 0);

    const fallbackId =
      toStringSafe(providerData.id) || campaign.externalId || campaign.id;

    return {
      ...providerData,
      id: fallbackId,
      campaignId: campaign.externalId || fallbackId,
      name: campaign.name,
      platform: campaign.platform,
      status: toUiStatus(campaign.status),
      objective: campaign.objective || toStringSafe(providerData.objective),
      spend,
      impressions: metric?.impressions ?? toNumber(providerData.impressions),
      clicks: metric?.clicks ?? toNumber(providerData.clicks),
      reach: metric?.reach ?? toNumber(providerData.reach),
      frequency: metric?.frequency ?? toNumber(providerData.frequency),
      ctr: metric?.ctr ?? toNumber(providerData.ctr),
      cpc: metric?.cpc ?? toNumber(providerData.cpc),
      cpm: metric?.cpm ?? toNumber(providerData.cpm),
      conversions,
      conversionValue,
      roas,
      cpa,
      budget:
        budget?.dailyAmount ??
        budget?.lifetimeAmount ??
        toNumber(providerData.budget),
      dailyBudget:
        budget?.dailyAmount ??
        toNumber(providerData.dailyBudget),
      lifetimeBudget:
        budget?.lifetimeAmount ??
        toNumber(providerData.lifetimeBudget),
      budgetPeriod: budget?.period || toStringSafe(providerData.budgetPeriod),
      accountId: account?.externalId || toStringSafe(providerData.accountId),
      unifiedCampaignId: campaign.id,
      unifiedAccountId: campaign.accountId,
      dataSource: 'UnifiedDataLayer',
    };
  });
};

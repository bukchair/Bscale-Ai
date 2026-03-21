// Pure helper functions extracted from Campaigns.tsx
import type { CampaignRow } from './types';

export const toAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const normalizeCampaignStatus = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unknown';
  const normalized = raw.toLowerCase();
  if (normalized === 'draft') return 'Draft';
  if (normalized.includes('scheduled')) return 'Scheduled';
  if (
    normalized.includes('active') ||
    normalized === 'enabled' ||
    normalized.includes('serving')
  ) {
    return 'Active';
  }
  if (normalized.includes('paused') || normalized.includes('disable')) return 'Paused';
  if (
    normalized.includes('removed') ||
    normalized.includes('deleted') ||
    normalized.includes('archived')
  ) {
    return 'Removed';
  }
  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('learning')
  ) {
    return 'Pending';
  }
  if (normalized.includes('error') || normalized.includes('fail')) return 'Error';
  return 'Unknown';
};

export const getStatusBadgeClass = (status: string) => {
  if (status === 'Active') return 'bg-green-100 text-green-800';
  if (status === 'Scheduled' || status === 'Pending') return 'bg-indigo-100 text-indigo-800';
  if (status === 'Draft') return 'bg-slate-100 text-slate-700';
  if (status === 'Paused') return 'bg-yellow-100 text-yellow-800';
  if (status === 'Removed') return 'bg-rose-100 text-rose-800';
  if (status === 'Error') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-700';
};

export const formatPercent = (value: unknown, fractionDigits = 2) => {
  const numeric = toAmount(value);
  return `${numeric.toFixed(fractionDigits)}%`;
};

export const hasMetaMetrics = (campaign: CampaignRow) => {
  const keys = ['spend', 'impressions', 'clicks', 'conversions', 'conversionValue', 'ctr', 'cpc', 'cpm', 'reach', 'frequency'];
  return keys.some((key) => toAmount(campaign?.[key]) > 0);
};

export const hasGoogleMetrics = (campaign: CampaignRow) => {
  const keys = ['spend', 'impressions', 'clicks', 'conversions', 'conversionValue', 'ctr', 'cpc', 'cpm', 'costPerConversion'];
  return keys.some((key) => toAmount(campaign?.[key]) > 0);
};

export const mergePlatformCampaignsPreferRich = (
  existingRows: CampaignRow[],
  incomingRows: CampaignRow[],
  hasMetrics: (row: CampaignRow) => boolean
) => {
  const existingById = new Map(
    existingRows.map((row) => [String(row?.id || row?.campaignId || ''), row])
  );
  return incomingRows.map((row) => {
    const key = String(row?.id || row?.campaignId || '');
    if (!key) return row;
    const existing = existingById.get(key);
    if (!existing) return row;
    if (!hasMetrics(row) && hasMetrics(existing)) {
      // Keep richer historical row if new response only has minimal fields.
      return {
        ...existing,
        ...row,
        name: row.name || existing.name,
        status: row.status || existing.status,
      };
    }
    return row;
  });
};

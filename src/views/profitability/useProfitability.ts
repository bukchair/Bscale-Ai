import { useEffect, useMemo, useState } from 'react';
import { fetchWooCommerceSalesByRange, type WooCommerceSalesPoint } from '../../services/woocommerceService';
import { loadUnifiedCampaignLayerFromConnections } from '../../lib/unified-data/loaders';
import type { Connection } from '../../contexts/ConnectionsContext';
import { resolveWooCredentials } from '../../lib/integrations/woocommerceCredentials';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampaignSpendRow = {
  id: string;
  name: string;
  platform: 'Google' | 'Meta' | 'TikTok';
  status: string;
  spend: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  metaChannels?: {
    facebook?: { spend?: number } | null;
    instagram?: { spend?: number } | null;
    whatsapp?: { enabled?: boolean; spend?: number; conversations?: number } | null;
  } | null;
};

export const toAmount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseProfitabilityProps {
  connections: Connection[];
  startDate: Date;
  endDate: Date;
  periodLabel: string;
}

export function useProfitability({ connections, startDate, endDate, periodLabel }: UseProfitabilityProps) {
  const wooConnection = connections.find((c) => c.id === 'woocommerce' && c.status === 'connected');

  // ── State ──────────────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<'period' | 'campaigns' | 'platforms'>('period');
  const [wooSales, setWooSales] = useState<WooCommerceSalesPoint[]>([]);
  const [campaignRows, setCampaignRows] = useState<CampaignSpendRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ── Effect: load data ──────────────────────────────────────────────────────
  useEffect(() => {
    const startIso = startDate.toISOString().slice(0, 10);
    const endIso = endDate.toISOString().slice(0, 10);
    let cancelled = false;

    const load = async () => {
      setIsLoadingData(true);
      try {
        const { campaignRows: unifiedCampaignRows } =
          await loadUnifiedCampaignLayerFromConnections({
            connections,
            startDate: startIso,
            endDate: endIso,
          });

        let nextWoo: WooCommerceSalesPoint[] = [];
        if (wooConnection?.settings) {
          const { storeUrl, wooKey, wooSecret } = resolveWooCredentials(
            wooConnection.settings as Record<string, unknown>
          );
          if (storeUrl && wooKey && wooSecret) {
            nextWoo = await fetchWooCommerceSalesByRange(storeUrl, wooKey, wooSecret, startIso, endIso).catch(() => []);
          }
        }

        const connectedCampaigns = unifiedCampaignRows
          .map((row: Record<string, unknown>) => {
            const platformRaw = String(row?.platform || '');
            const platform =
              platformRaw === 'Google' || platformRaw === 'Meta' || platformRaw === 'TikTok'
                ? (platformRaw as 'Google' | 'Meta' | 'TikTok')
                : null;
            if (!platform) return null;
            return {
              id: String(row?.campaignId || row?.id || `${platform.toLowerCase()}-${row?.name || ''}`),
              name: String(row?.name || `${platform} Campaign`),
              platform,
              status: String(row?.status || 'Unknown'),
              spend: toAmount(row?.spend),
              conversions: toAmount(row?.conversions),
              conversionValue: toAmount(row?.conversionValue),
              roas: toAmount(row?.roas),
              metaChannels: platform === 'Meta' ? (row?.metaChannels || null) : null,
            } as CampaignSpendRow;
          })
          .filter((row): row is CampaignSpendRow => Boolean(row))
          .filter((row) => row && (row.spend > 0 || row.conversions > 0 || row.conversionValue > 0 || row.name));

        if (!cancelled) {
          setWooSales(nextWoo);
          setCampaignRows(connectedCampaigns.sort((a, b) => b.spend - a.spend));
        }
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [connections, startDate, endDate, wooConnection?.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memos ──────────────────────────────────────────────────────────────────
  const financialData = useMemo(() => {
    const totalCampaignSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
    if (wooSales.length > 0) {
      const totalWooRevenue = wooSales.reduce((sum, row) => sum + toAmount(row.totalSales), 0);
      return wooSales.map((row) => {
        const dateLabel = row.date ? new Date(row.date).toLocaleDateString('he-IL') : '';
        const revenue = toAmount(row.totalSales);
        const allocatedSpend =
          totalCampaignSpend > 0
            ? totalWooRevenue > 0
              ? (revenue / totalWooRevenue) * totalCampaignSpend
              : totalCampaignSpend / Math.max(wooSales.length, 1)
            : 0;
        return {
          name: dateLabel,
          revenue: Math.round(revenue),
          spend: Math.round(allocatedSpend),
          profit: Math.round(revenue - allocatedSpend),
        };
      });
    }

    if (campaignRows.length > 0) {
      const totalSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
      return [{ name: periodLabel, revenue: 0, spend: Math.round(totalSpend), profit: Math.round(-totalSpend) }];
    }

    return [];
  }, [wooSales, campaignRows, periodLabel]);

  const platformData = useMemo(() => {
    const byPlatform = new Map<string, { name: string; spend: number; conversionValue: number }>();
    campaignRows.forEach((row) => {
      const current = byPlatform.get(row.platform) || { name: row.platform, spend: 0, conversionValue: 0 };
      current.spend += row.spend;
      current.conversionValue += row.conversionValue;
      byPlatform.set(row.platform, current);
    });
    return Array.from(byPlatform.values())
      .map((row) => ({
        ...row,
        roas: row.spend > 0 ? row.conversionValue / row.spend : 0,
      }))
      .sort((a, b) => {
        const order = (name: string) => (name === 'Google' ? 0 : name === 'Meta' ? 1 : name === 'TikTok' ? 2 : 3);
        return order(a.name) - order(b.name);
      });
  }, [campaignRows]);

  // ── Computed KPIs ──────────────────────────────────────────────────────────
  const kpiRevenue = financialData.reduce((a, r) => a + r.revenue, 0);
  const kpiSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
  const kpiProfit = kpiRevenue - kpiSpend;
  const kpiRoas = kpiSpend > 0 ? (kpiRevenue / kpiSpend).toFixed(2) : '0.00';

  return {
    // state
    reportType, setReportType,
    isLoadingData,
    campaignRows,
    // memos
    financialData,
    platformData,
    // kpis
    kpiRevenue,
    kpiSpend,
    kpiProfit,
    kpiRoas,
  };
}

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { DollarSign, TrendingUp, TrendingDown, Activity, Download, Filter, Zap, BarChart3, PieChart, CheckCircle2, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import { cn } from '../lib/utils';
import { useConnections } from '../contexts/ConnectionsContext';
import { fetchWooCommerceSalesByRange, WooCommerceSalesPoint } from '../services/woocommerceService';
import { useCurrency } from '../contexts/CurrencyContext';
import { loadUnifiedCampaignLayerFromConnections } from '../lib/unified-data/loaders';

type CampaignSpendRow = {
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

const toAmount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function Profitability() {
  const { t, dir } = useLanguage();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections } = useConnections();
  const { format: formatCurrency, symbol } = useCurrency();
  const [reportType, setReportType] = useState<'period' | 'campaigns' | 'platforms'>('period');

  const wooConnection = connections.find((c) => c.id === 'woocommerce' && c.status === 'connected');
  const [wooSales, setWooSales] = useState<WooCommerceSalesPoint[]>([]);
  const [campaignRows, setCampaignRows] = useState<CampaignSpendRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const periodLabel = dateRange === 'today' ? t('dashboard.today') : dateRange === '7days' ? t('dashboard.last7Days') : dateRange === '30days' ? t('dashboard.last30Days') : t('dashboard.customRange');
  const periodSubtitle =
    dateRange === 'custom'
      ? `${bounds.startDate.toLocaleDateString('he-IL')} - ${bounds.endDate.toLocaleDateString('he-IL')}`
      : periodLabel;

  useEffect(() => {
    const startIso = bounds.startDate.toISOString().slice(0, 10);
    const endIso = bounds.endDate.toISOString().slice(0, 10);
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
          const { storeUrl, wooKey, wooSecret } = wooConnection.settings as any;
          if (storeUrl && wooKey && wooSecret) {
            nextWoo = await fetchWooCommerceSalesByRange(storeUrl, wooKey, wooSecret, startIso, endIso).catch(() => []);
          }
        }

        const connectedCampaigns = unifiedCampaignRows
          .map((row: any) => {
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
  }, [connections, bounds.startDate, bounds.endDate, wooConnection?.settings]);

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

  const kpiRevenue = financialData.reduce((a, r) => a + r.revenue, 0);
  const kpiSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
  const kpiProfit = kpiRevenue - kpiSpend;
  const kpiRoas = kpiSpend > 0 ? (kpiRevenue / kpiSpend).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('profitability.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('profitability.subtitle')} <span className="font-bold text-indigo-600">({periodSubtitle})</span></p>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingData && (
            <span className="inline-flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('common.loading')}
            </span>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            <Filter className="w-4 h-4" />
            {t('common.filter')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            {t('common.export') || 'Export Report'}
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingUp className="w-3 h-3" /> Live
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.revenueWoo')}</p>
          <p className="text-3xl font-black text-gray-900">{formatCurrency(kpiRevenue)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingDown className="w-3 h-3" /> Live
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.adSpend')}</p>
          <p className="text-3xl font-black text-gray-900">{formatCurrency(kpiSpend)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingUp className="w-3 h-3" /> Live
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.netProfit')}</p>
          <p className="text-3xl font-black text-gray-900">{formatCurrency(kpiProfit)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <PieChart className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingUp className="w-3 h-3" /> Live
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.avgRoas')}</p>
          <p className="text-3xl font-black text-gray-900" dir="ltr">{kpiRoas}x</p>
        </div>
      </div>

      {/* AI Financial Analysis (compact) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-indigo-50/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t('profitability.aiAnalysisTitle')}</h2>
              <p className="text-xs text-gray-600">{t('profitability.aiAnalysisSubtitle')}</p>
            </div>
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] text-gray-500 mb-1">{t('profitability.performanceSummary')}</p>
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{t('profitability.performanceSummaryDesc')}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">{t('profitability.growthOpportunity')}</p>
              <p className="text-[11px] text-emerald-800">{t('profitability.growthOpportunityDesc')}</p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <Activity className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">{t('profitability.efficiencyAlert')}</p>
              <p className="text-[11px] text-amber-800">{t('profitability.efficiencyAlertDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Financial Reports */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('profitability.detailedReports')}</h2>
            <p className="text-sm text-gray-500">{t('profitability.detailedReportsSubtitle')}</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setReportType('period')}
              className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", reportType === 'period' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              {t('profitability.period')}
            </button>
            <button 
              onClick={() => setReportType('platforms')}
              className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", reportType === 'platforms' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              {t('profitability.platforms')}
            </button>
            <button 
              onClick={() => setReportType('campaigns')}
              className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", reportType === 'campaigns' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
            >
              {t('profitability.campaigns')}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {reportType === 'period' && (
            <div className="space-y-6">
              {financialData.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  {t('campaigns.connectPlatforms')}
                </div>
              )}
              {financialData.length > 0 && (
                <>
              <div className="h-80" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={financialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSpnd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                      name={`${t('profitability.revenue')} (${symbol})`}
                    />
                    <Area
                      type="monotone"
                      dataKey="spend"
                      stroke="#EF4444"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSpnd)"
                      name={`${t('profitability.spend')} (${symbol})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="overflow-x-auto">
                <table className={cn("w-full text-sm", dir === 'rtl' ? "text-right" : "text-left")}>
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="pb-4 font-medium">{t('profitability.month')}</th>
                      <th className="pb-4 font-medium">{t('profitability.revenue')}</th>
                      <th className="pb-4 font-medium">{t('profitability.spend')}</th>
                      <th className="pb-4 font-medium">{t('profitability.grossProfit')}</th>
                      <th className="pb-4 font-medium">{t('profitability.roas')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {financialData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 font-bold text-gray-900">{row.name}</td>
                        <td className="py-4 text-emerald-600 font-bold">{formatCurrency(row.revenue)}</td>
                        <td className="py-4 text-red-500">{formatCurrency(row.spend)}</td>
                        <td className="py-4 text-indigo-600 font-bold">{formatCurrency(row.profit)}</td>
                        <td className="py-4 font-medium" dir="ltr">
                          {row.spend > 0 ? `${(row.revenue / row.spend).toFixed(2)}x` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
          )}

          {reportType === 'platforms' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {platformData.length === 0 && (
                <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  {t('campaigns.connectPlatforms')}
                </div>
              )}
              {platformData.length > 0 && (
                <>
              <div className="h-80" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <RechartsBarChart data={platformData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar
                      dataKey="spend"
                      fill="#6366F1"
                      radius={[6, 6, 0, 0]}
                      name={`${t('profitability.spend')} (${symbol})`}
                      maxBarSize={40}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">{t('profitability.performanceByPlatform')}</h3>
                {platformData.map((platform, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-500">
                        {platform.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{platform.name}</p>
                        <p className="text-xs text-gray-500">
                          {t('profitability.spend')}: {formatCurrency(platform.spend)}
                        </p>
                      </div>
                    </div>
                    <div className={dir === 'rtl' ? "text-left" : "text-right"}>
                      <p className="text-sm font-bold text-emerald-600" dir="ltr">{platform.roas.toFixed(2)}x ROAS</p>
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${Math.max(0, Math.min(100, (platform.roas / 5) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
              )}
            </div>
          )}

          {reportType === 'campaigns' && (
            <div>
              {campaignRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  {isLoadingData ? t('profitability.loadingCampaignsDesc') : t('campaigns.connectPlatforms')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>
                        <th className="px-3 py-2 font-bold text-gray-600">#{t('profitability.campaigns')}</th>
                        <th className="px-3 py-2 font-bold text-gray-600">{t('campaigns.platform')}</th>
                        <th className="px-3 py-2 font-bold text-gray-600">{t('campaigns.status')}</th>
                        <th className="px-3 py-2 font-bold text-gray-600">{t('profitability.spend')}</th>
                        <th className="px-3 py-2 font-bold text-gray-600">Conv.</th>
                        <th className="px-3 py-2 font-bold text-gray-600">Conv. Value</th>
                        <th className="px-3 py-2 font-bold text-gray-600">{t('profitability.roas')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {campaignRows.map((row) => {
                        const fbSpend = toAmount(row.metaChannels?.facebook?.spend);
                        const igSpend = toAmount(row.metaChannels?.instagram?.spend);
                        const waEnabled = Boolean(row.metaChannels?.whatsapp?.enabled);
                        const waSpend = toAmount(row.metaChannels?.whatsapp?.spend);
                        return (
                          <tr key={`${row.platform}-${row.id}`} className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>
                            <td className="px-3 py-2">
                              <div className="max-w-[230px] truncate font-medium text-gray-900" title={row.name}>
                                {row.name}
                              </div>
                              {row.platform === 'Meta' && (fbSpend > 0 || igSpend > 0 || waEnabled) && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                    FB {fbSpend > 0 ? formatCurrency(fbSpend) : '—'}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                    IG {igSpend > 0 ? formatCurrency(igSpend) : '—'}
                                  </span>
                                  {waEnabled && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                      WA {waSpend > 0 ? formatCurrency(waSpend) : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-700">{row.platform}</td>
                            <td className="px-3 py-2 text-gray-700">{row.status}</td>
                            <td className="px-3 py-2 text-gray-800 font-medium">{formatCurrency(row.spend)}</td>
                            <td className="px-3 py-2 text-gray-700">{Math.round(row.conversions).toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-700">{formatCurrency(row.conversionValue)}</td>
                            <td className="px-3 py-2 text-gray-700" dir="ltr">{row.roas.toFixed(2)}x</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

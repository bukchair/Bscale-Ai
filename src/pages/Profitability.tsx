import React, { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getRangeLengthInDays, useDateRange } from '../contexts/DateRangeContext';
import { DollarSign, TrendingUp, TrendingDown, Activity, Download, Filter, Zap, BarChart3, PieChart, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import { cn } from '../lib/utils';
import { useAppNavigation } from '../contexts/AppNavigationContext';

const financialData = [
  { name: 'Jan', revenue: 12000, spend: 4000, profit: 8000 },
  { name: 'Feb', revenue: 19000, spend: 6000, profit: 13000 },
  { name: 'Mar', revenue: 15000, spend: 5000, profit: 10000 },
  { name: 'Apr', revenue: 22000, spend: 8000, profit: 14000 },
  { name: 'May', revenue: 28000, spend: 9000, profit: 19000 },
  { name: 'Jun', revenue: 24000, spend: 7000, profit: 17000 },
  { name: 'Jul', revenue: 31000, spend: 10000, profit: 21000 },
];

const platformData = [
  { name: 'Google Ads', spend: 4500, roas: 3.2 },
  { name: 'Meta Ads', spend: 3200, roas: 2.8 },
  { name: 'TikTok Ads', spend: 2300, roas: 2.1 },
];

export function Profitability() {
  const { t, dir } = useLanguage();
  const { navigateTo } = useAppNavigation();
  const { dateRange, resolvedRange } = useDateRange();
  const [reportType, setReportType] = useState<'period' | 'campaigns' | 'platforms'>('period');
  const [showTopPerformersOnly, setShowTopPerformersOnly] = useState(false);

  const dateWindowSize = useMemo(() => {
    if (dateRange === 'today') return 1;
    if (dateRange === '7days') return 2;
    if (dateRange === '30days') return financialData.length;

    const customDays = getRangeLengthInDays(resolvedRange);
    if (customDays <= 1) return 1;
    if (customDays <= 7) return 2;
    return financialData.length;
  }, [dateRange, resolvedRange.endDate, resolvedRange.startDate]);

  const periodFinancialData = useMemo(
    () => financialData.slice(-dateWindowSize),
    [dateWindowSize]
  );

  const periodRatio = periodFinancialData.length / financialData.length;
  const periodPlatformData = useMemo(
    () => platformData.map((platform) => ({
      ...platform,
      spend: Math.max(100, Math.round(platform.spend * periodRatio)),
    })),
    [periodRatio]
  );

  const filteredFinancialData = showTopPerformersOnly
    ? periodFinancialData.filter((row) => (row.revenue / row.spend) >= 2.5)
    : periodFinancialData;

  const filteredPlatformData = showTopPerformersOnly
    ? periodPlatformData.filter((platform) => platform.roas >= 2.5)
    : periodPlatformData;

  const totalRevenue = periodFinancialData.reduce((sum, row) => sum + row.revenue, 0);
  const totalSpend = periodFinancialData.reduce((sum, row) => sum + row.spend, 0);
  const netProfit = totalRevenue - totalSpend;
  const avgRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';

  const handleExportReport = () => {
    const rows =
      reportType === 'period'
        ? filteredFinancialData.map((row) => ({
            month: row.name,
            revenue: row.revenue,
            spend: row.spend,
            grossProfit: row.profit,
            roas: (row.revenue / row.spend).toFixed(2),
          }))
        : filteredPlatformData.map((platform) => ({
            platform: platform.name,
            spend: platform.spend,
            roas: platform.roas,
          }));

    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => (row as any)[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profitability-${reportType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('profitability.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('profitability.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTopPerformersOnly((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            {showTopPerformersOnly ? `${t('common.filter')}: ON` : `${t('common.filter')}: OFF`}
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
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
              <TrendingUp className="w-3 h-3" /> +12.5%
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.revenueWoo')}</p>
          <p className="text-3xl font-black text-gray-900">₪{totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingDown className="w-3 h-3" /> -4.2%
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.adSpend')}</p>
          <p className="text-3xl font-black text-gray-900">₪{totalSpend.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingUp className="w-3 h-3" /> +18.7%
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.netProfit')}</p>
          <p className="text-3xl font-black text-gray-900">₪{netProfit.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
              <PieChart className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" dir="ltr">
              <TrendingUp className="w-3 h-3" /> +0.4
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 mb-1">{t('profitability.avgRoas')}</p>
          <p className="text-3xl font-black text-gray-900" dir="ltr">{avgRoas}x</p>
        </div>
      </div>

      {/* AI Financial Analysis */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('profitability.aiAnalysisTitle')}</h2>
              <p className="text-sm text-gray-500">{t('profitability.aiAnalysisSubtitle')}</p>
            </div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">{t('profitability.performanceSummary')}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {t('profitability.performanceSummaryDesc')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">{t('profitability.growthOpportunity')}</p>
                  <p className="text-xs text-emerald-700">{t('profitability.growthOpportunityDesc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <Activity className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900">{t('profitability.efficiencyAlert')}</p>
                  <p className="text-xs text-amber-700">{t('profitability.efficiencyAlertDesc')}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-indigo-600 rounded-xl p-6 text-white flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div>
              <p className="text-indigo-100 text-sm font-medium mb-1">{t('profitability.profitImprovementPotential')}</p>
              <p className="text-4xl font-black" dir="ltr">+₪12,500</p>
              <p className="text-indigo-200 text-xs mt-2">{t('profitability.basedOnAi')}</p>
            </div>
            <button
              onClick={() => navigateTo('ai-recommendations')}
              className="mt-6 w-full py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-lg active:scale-95"
            >
              {t('profitability.applyRecommendations')}
            </button>
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
          <div className="w-full sm:w-auto overflow-x-auto">
            <div className="flex min-w-max bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setReportType('period')}
                className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap", reportType === 'period' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
              >
                {t('profitability.period')}
              </button>
              <button 
                onClick={() => setReportType('platforms')}
                className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap", reportType === 'platforms' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
              >
                {t('profitability.platforms')}
              </button>
              <button 
                onClick={() => setReportType('campaigns')}
                className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap", reportType === 'campaigns' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
              >
                {t('profitability.campaigns')}
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {reportType === 'period' && (
            <div className="space-y-6">
              <div className="h-80" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={filteredFinancialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name={`${t('profitability.revenue')} (₪)`} />
                    <Area type="monotone" dataKey="spend" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSpnd)" name={`${t('profitability.spend')} (₪)`} />
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
                    {filteredFinancialData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 font-bold text-gray-900">{row.name}</td>
                        <td className="py-4 text-emerald-600 font-bold">₪{row.revenue.toLocaleString()}</td>
                        <td className="py-4 text-red-500">₪{row.spend.toLocaleString()}</td>
                        <td className="py-4 text-indigo-600 font-bold">₪{row.profit.toLocaleString()}</td>
                        <td className="py-4 font-medium" dir="ltr">{(row.revenue / row.spend).toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === 'platforms' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-80" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <RechartsBarChart data={filteredPlatformData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="spend" fill="#6366F1" radius={[6, 6, 0, 0]} name={`${t('profitability.spend')} (₪)`} maxBarSize={40} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">{t('profitability.performanceByPlatform')}</h3>
                {filteredPlatformData.map((platform, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-500">
                        {platform.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{platform.name}</p>
                        <p className="text-xs text-gray-500">{t('profitability.spend')}: ₪{platform.spend.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className={dir === 'rtl' ? "text-left" : "text-right"}>
                      <p className="text-sm font-bold text-emerald-600" dir="ltr">{platform.roas}x ROAS</p>
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${(platform.roas / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportType === 'campaigns' && (
            <div className="flex flex-col items-center justify-center h-80 text-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                <BarChart3 className="w-8 h-8" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{t('profitability.loadingCampaigns')}</p>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  {t('profitability.loadingCampaignsDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { DollarSign, Users, MousePointerClick, TrendingUp, Activity, Search, ShoppingCart, Target, Eye, ArrowRight, Zap, Megaphone, LineChart, Store, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { generateDashboardData } from '../lib/dataUtils';
import { auth } from '../lib/firebase';
import { fetchGA4LiveData, fetchGSCData, fetchGoogleCampaigns, GA4LiveData } from '../services/googleService';
import { fetchMetaAdAccounts, fetchMetaCampaigns } from '../services/metaService';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import { fetchWooCommerceProducts } from '../services/woocommerceService';
import { useAppNavigation } from '../contexts/AppNavigationContext';

export function Dashboard() {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const { navigateTo } = useAppNavigation();
  const { dateRange, resolvedRange } = useDateRange();
  const { connections } = useConnections();
  const currentUser = auth.currentUser;
  const [ga4LiveData, setGa4LiveData] = useState<GA4LiveData | null>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [gscTotals, setGscTotals] = useState<{ clicks: number; impressions: number; position: number; ctr: number } | null>(null);
  const [overviewSyncStage, setOverviewSyncStage] = useState<'idle' | 'platforms' | 'woocommerce'>('idle');
  const [wooLiveLoadingPercent, setWooLiveLoadingPercent] = useState(0);
  const syncInFlightRef = useRef(false);

  const connectedPlatforms = connections.filter(c => c.status === 'connected');
  const isWooConnected = connections.find(c => c.id === 'woocommerce')?.status === 'connected';
  const isShopifyConnected = connections.find(c => c.id === 'shopify')?.status === 'connected';
  const isStoreConnected = isWooConnected || isShopifyConnected;

  const buildDashboardData = useCallback(() => {
    // Collect all settings keys to create a unique seed
    const baseSeed = connectedPlatforms.map(c =>
      Object.values(c.settings || {}).join('')
    ).join('') || 'default';
    const seedStr = `${baseSeed}:${resolvedRange.startDate}:${resolvedRange.endDate}`;
    
    const data = generateDashboardData(seedStr);
    
    // If no store is connected, revenue is 0
    if (!isStoreConnected) {
      return {
        ...data,
        chartData: data.chartData.map(d => ({ ...d, revenue: 0 })),
        totalRevenue: 0,
        roas: '0.00',
        netProfit: -data.totalSpend
      };
    }
    
    return data;
  }, [connectedPlatforms, isStoreConnected, resolvedRange.endDate, resolvedRange.startDate]);

  const [dashboardData, setDashboardData] = useState(() => buildDashboardData());

  const { chartData, totalRevenue, totalSpend, roas, netProfit } = dashboardData;

  useEffect(() => {
    const googleConnection = connections.find(c => c.id === 'google');
    const metaConnection = connections.find(c => c.id === 'meta');
    const wooConnection = connections.find(c => c.id === 'woocommerce');
    const accessToken = googleConnection?.settings?.googleAccessToken;
    const propertyId = googleConnection?.settings?.ga4PropertyId || googleConnection?.settings?.ga4Id;
    const siteUrl = googleConnection?.settings?.gscSiteUrl;

    if (!googleConnection || googleConnection.status !== 'connected' || !accessToken) {
      setGa4LiveData(null);
      setGa4Error(null);
      setGscTotals(null);
      setDashboardData(buildDashboardData());
      setOverviewSyncStage('idle');
      return;
    }

    let isCancelled = false;

    const parseCurrencyNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value !== 'string') return 0;
      const normalized = value.replace(/[^\d.-]/g, '');
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const loadOverviewData = async () => {
      if (isCancelled) return;
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setOverviewSyncStage('platforms');

      let syncedAdSpendTotal = 0;

      try {
        try {
          // 1) Google sync (GA4/GSC + Google Ads for revenue window spend).
          const ga4Data = await fetchGA4LiveData(accessToken, propertyId || undefined, resolvedRange);
          if (!isCancelled) {
            setGa4LiveData(ga4Data);
            setGa4Error(null);
          }
        } catch (err) {
          console.error("Failed to load GA4 live data:", err);
          if (!isCancelled) {
            setGa4LiveData(null);
            setGa4Error(err instanceof Error ? err.message : t('common.error'));
          }
        }

        try {
          if (siteUrl) {
            const gscData = await fetchGSCData(accessToken, siteUrl, resolvedRange);
            const rows = gscData.rows || [];
            const clicks = rows.reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0);
            const impressions = rows.reduce((sum: number, row: any) => sum + Number(row.impressions || 0), 0);
            const weightedPosition = rows.reduce((sum: number, row: any) => sum + (Number(row.position || 0) * Number(row.impressions || 0)), 0);
            const position = impressions > 0 ? weightedPosition / impressions : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

            if (!isCancelled) {
              setGscTotals({ clicks, impressions, position, ctr });
            }
          }
        } catch (err) {
          console.error("Failed to load Search Console data:", err);
          if (!isCancelled) {
            setGscTotals(null);
          }
        }

        try {
          const googleAdsId = googleConnection?.settings?.googleAdsId || '';
          if (googleAdsId) {
            const googleCampaigns = await fetchGoogleCampaigns(accessToken, googleAdsId, undefined, resolvedRange);
            syncedAdSpendTotal += googleCampaigns.reduce(
              (sum, campaign) => sum + parseCurrencyNumber(campaign?.spend),
              0
            );
          }
        } catch (googleCampaignErr) {
          console.warn('Failed to sync Google Ads campaigns during overview sync:', googleCampaignErr);
        }

        // 2) Meta sync before WooCommerce.
        try {
          const metaToken = metaConnection?.settings?.metaToken;
          if (metaConnection?.status === 'connected' && metaToken) {
            let metaAdsId =
              metaConnection.settings?.metaAdsId ||
              metaConnection.settings?.adAccountId ||
              metaConnection.settings?.metaAdAccountId ||
              '';

            if (!metaAdsId) {
              try {
                const accounts = await fetchMetaAdAccounts(metaToken);
                metaAdsId = String(accounts?.[0]?.account_id || accounts?.[0]?.id || '').trim();
              } catch (metaAccountErr) {
                console.warn('Failed to discover Meta ad accounts during overview sync:', metaAccountErr);
              }
            }

            if (metaAdsId) {
              const metaCampaigns = await fetchMetaCampaigns(metaToken, metaAdsId);
              syncedAdSpendTotal += metaCampaigns.reduce(
                (sum, campaign) => sum + parseCurrencyNumber(campaign?.spend),
                0
              );
            }
          }
        } catch (metaErr) {
          console.warn('Failed to sync Meta campaigns during overview sync:', metaErr);
        }

        // 3) TikTok sync before WooCommerce.
        try {
          const tiktokConnection = connections.find(c => c.id === 'tiktok');
          const tiktokToken = tiktokConnection?.settings?.tiktokToken;
          const tiktokAdvertiserId = tiktokConnection?.settings?.tiktokAdvertiserId;
          if (tiktokConnection?.status === 'connected' && tiktokToken && tiktokAdvertiserId) {
            const tiktokCampaigns = await fetchTikTokCampaigns(tiktokToken, tiktokAdvertiserId);
            syncedAdSpendTotal += tiktokCampaigns.reduce(
              (sum, campaign) =>
                sum + parseCurrencyNumber((campaign as { spend?: unknown })?.spend),
              0
            );
          }
        } catch (tiktokErr) {
          console.warn('Failed to sync TikTok campaigns during overview sync:', tiktokErr);
        }

        if (isCancelled) return;
        setOverviewSyncStage('woocommerce');

        // Stage 2: WooCommerce sync runs only after Google + Meta + TikTok stage.
        try {
          if (
            wooConnection?.status === 'connected' &&
            wooConnection.settings?.storeUrl &&
            wooConnection.settings?.wooKey &&
            wooConnection.settings?.wooSecret
          ) {
            await fetchWooCommerceProducts(
              wooConnection.settings.storeUrl,
              wooConnection.settings.wooKey,
              wooConnection.settings.wooSecret
            );
          }
        } catch (wooErr) {
          console.warn('Failed to sync WooCommerce during overview sync:', wooErr);
        }

        if (!isCancelled) {
          const baseData = buildDashboardData();
          const normalizedLiveSpend = Math.max(0, Math.round(syncedAdSpendTotal));
          const hasLiveSpend = normalizedLiveSpend > 0;
          const nextSpend = hasLiveSpend ? normalizedLiveSpend : baseData.totalSpend;
          const nextRoas = nextSpend > 0 ? (baseData.totalRevenue / nextSpend).toFixed(2) : '0.00';
          const nextNetProfit = baseData.totalRevenue - nextSpend;
          const scaleFactor = baseData.totalSpend > 0 ? nextSpend / baseData.totalSpend : 1;

          setDashboardData({
            ...baseData,
            totalSpend: nextSpend,
            roas: nextRoas,
            netProfit: nextNetProfit,
            chartData: baseData.chartData.map((point) => ({
              ...point,
              spend: Math.max(0, Math.round(point.spend * scaleFactor)),
            })),
          });
          setOverviewSyncStage('idle');
        }
      } finally {
        syncInFlightRef.current = false;
      }
    };

    loadOverviewData();
    const intervalId = window.setInterval(loadOverviewData, 60000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [connections, resolvedRange.endDate, resolvedRange.startDate, buildDashboardData, t]);

  useEffect(() => {
    if (!(isWooConnected && overviewSyncStage === 'woocommerce')) {
      setWooLiveLoadingPercent(0);
      return;
    }

    setWooLiveLoadingPercent(8);
    const intervalId = window.setInterval(() => {
      setWooLiveLoadingPercent((prev) => {
        if (prev >= 92) return prev;
        const step = Math.floor(Math.random() * 6) + 3;
        return Math.min(92, prev + step);
      });
    }, 350);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isWooConnected, overviewSyncStage]);

  const isWooLiveLoading = isWooConnected && overviewSyncStage === 'woocommerce';
  const financeValueText = {
    revenue: isWooLiveLoading ? '—' : `₪${totalRevenue.toLocaleString()}`,
    spend: isWooLiveLoading ? '—' : `₪${totalSpend.toLocaleString()}`,
    roas: isWooLiveLoading ? '—' : `${roas}x`,
    netProfit: isWooLiveLoading ? '—' : `₪${netProfit.toLocaleString()}`,
  };

  const useGa4Fallback = !ga4LiveData && !ga4Error;
  const ga4ActiveUsers = ga4LiveData?.activeUsers ?? (useGa4Fallback ? 42 : 0);
  const ga4TotalUsers = ga4LiveData?.totalUsers ?? (useGa4Fallback ? 1247 : 0);

  const topPages = ga4LiveData?.topPages?.length
    ? ga4LiveData.topPages.map((page) => ({
        name: page.name === '/' ? t('dashboard.homePage') : page.name,
        percent: (() => {
          const totalTopPageUsers = ga4LiveData.topPages.reduce((sum, item) => sum + item.users, 0);
          return totalTopPageUsers > 0 ? Math.max(1, Math.round((page.users / totalTopPageUsers) * 100)) : 0;
        })()
      }))
    : useGa4Fallback ? [
        { name: t('dashboard.homePage'), percent: 41 },
        { name: t('dashboard.products'), percent: 28 },
        { name: t('dashboard.promotions'), percent: 18 },
      ] : [];

  const trafficSources = ga4LiveData?.trafficSources?.length
    ? ga4LiveData.trafficSources.slice(0, 3).map((source, idx) => ({
        name: source.name,
        percent: source.percent,
        color: idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-blue-500' : 'bg-purple-500'
      }))
    : useGa4Fallback ? [
        { name: t('dashboard.organicSearch'), percent: 45, color: 'bg-emerald-500' },
        { name: t('dashboard.paidSearch'), percent: 30, color: 'bg-blue-500' },
        { name: t('dashboard.direct'), percent: 15, color: 'bg-purple-500' },
      ] : [];

  const quickActions = [
    { id: 'ai-recs', title: t('dashboard.viewAiRecs'), icon: Zap, color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400', desc: t('dashboard.viewAiRecsDesc'), tab: 'ai-recommendations' },
    { id: 'create-ad', title: t('dashboard.createAdAi'), icon: Megaphone, color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400', desc: t('dashboard.createAdAiDesc'), tab: 'creative-lab' },
    { id: 'seo-fix', title: t('dashboard.fixSeoIssues'), icon: LineChart, color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', desc: t('dashboard.fixSeoIssuesDesc'), tab: 'seo' },
  ];

  const dateRangeLabel = 
    dateRange === 'today' ? t('dashboard.today') :
    dateRange === '7days' ? t('dashboard.last7Days') :
    dateRange === '30days' ? t('dashboard.last30Days') :
    `${t('dashboard.customRange')} (${resolvedRange.startDate} - ${resolvedRange.endDate})`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Personalized Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          {t('dashboard.welcome')}, {currentUser?.displayName?.split(' ')[0] || t('common.user')}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
          {t('dashboard.welcomeSubtitle')}
        </p>
        {overviewSyncStage !== 'idle' && (
          <p className="text-xs mt-2 font-bold text-indigo-600">
            {overviewSyncStage === 'platforms'
              ? (isHebrew
                  ? 'מסנכרן קודם Google + Meta + TikTok...'
                  : 'Syncing Google + Meta + TikTok connections first...')
              : (isHebrew
                  ? 'מסנכרן עכשיו נתוני WooCommerce...'
                  : 'Now syncing WooCommerce data...')}
          </p>
        )}
      </div>

      {/* Quick Smart Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.quickSmartActions')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => navigateTo(action.tab)}
              className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all flex items-start gap-4 text-start group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className={cn("w-4 h-4 text-indigo-500", dir === 'rtl' ? "rotate-180" : "")} />
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", action.color)}>
                <action.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{action.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Financial Analysis */}
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.financialAnalysis')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.wooCommerceRevenueVsCampaignSpend')}</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.netProfit')}</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{financeValueText.netProfit}</p>
          </div>
        </div>

        {isWooLiveLoading && (
          <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-indigo-700">
                {isHebrew ? 'טוען נתונים חיים מ‑WooCommerce' : 'Loading live WooCommerce data'}
              </p>
              <p className="text-[11px] font-black text-indigo-800">{wooLiveLoadingPercent}%</p>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${wooLiveLoadingPercent}%` }}
              />
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-emerald-50 dark:bg-emerald-500/5 p-6 rounded-xl border border-emerald-100 dark:border-emerald-500/10 relative overflow-hidden group hover:shadow-md transition-all">
            <Store className={cn("absolute -bottom-4 w-24 h-24 text-emerald-500 opacity-10 transition-transform group-hover:scale-110", dir === 'rtl' ? "-left-4" : "-right-4")} />
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-2 uppercase tracking-wider">{t('dashboard.wooCommerceRevenue')}</p>
            <p className="text-4xl font-black text-emerald-900 dark:text-emerald-50">{financeValueText.revenue}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-200/50 dark:bg-emerald-500/20 px-2 py-1 rounded-md">+12% {t('dashboard.vsPreviousPeriod')}</span>
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-500/5 p-6 rounded-xl border border-red-100 dark:border-red-500/10 relative overflow-hidden group hover:shadow-md transition-all">
            <Megaphone className={cn("absolute -bottom-4 w-24 h-24 text-red-500 opacity-10 transition-transform group-hover:scale-110", dir === 'rtl' ? "-left-4" : "-right-4")} />
            <p className="text-sm font-bold text-red-800 dark:text-red-400 mb-2 uppercase tracking-wider">{t('dashboard.campaignSpend')}</p>
            <p className="text-4xl font-black text-red-900 dark:text-red-50">{financeValueText.spend}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-200/50 dark:bg-red-500/20 px-2 py-1 rounded-md">-5% {t('dashboard.vsPreviousPeriod')}</span>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('dashboard.platformsGoogleMetaTikTok')}</span>
            </div>
          </div>
          
          <div className="bg-indigo-50 dark:bg-indigo-500/5 p-6 rounded-xl border border-indigo-100 dark:border-indigo-500/10 relative overflow-hidden group hover:shadow-md transition-all">
            <TrendingUp className={cn("absolute -bottom-4 w-24 h-24 text-indigo-500 opacity-10 transition-transform group-hover:scale-110", dir === 'rtl' ? "-left-4" : "-right-4")} />
            <p className="text-sm font-bold text-indigo-800 dark:text-indigo-400 mb-2 uppercase tracking-wider">{t('dashboard.roas')}</p>
            <p className="text-4xl font-black text-indigo-900 dark:text-indigo-50">{financeValueText.roas}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-200/50 dark:bg-indigo-500/20 px-2 py-1 rounded-md">+24% {t('dashboard.vsPreviousPeriod')}</span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{t('dashboard.poasLabel', { value: '1.8x' })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GA4 Section */}
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-6 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.realtimeTrafficGa4')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.activeUsersAndSources')}</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {ga4Error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-700">
                      {isHebrew ? 'שגיאת GA4 (פירוט מלא)' : 'GA4 error (detailed)'}
                    </p>
                    <p className="text-xs text-red-700 break-words">{ga4Error}</p>
                    <p className="text-[11px] text-red-600 mt-1">
                      {isHebrew
                        ? 'בדוק שה־GA4 Property שייך לאותו משתמש Google המחובר ולחץ Reconnect אם צריך.'
                        : 'Verify the GA4 property belongs to the connected Google user and reconnect if needed.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-500/5 p-6 rounded-xl border border-blue-100 dark:border-blue-500/10 relative overflow-hidden">
              <div className={cn("absolute top-3 w-2 h-2 bg-blue-500 rounded-full animate-ping", dir === 'rtl' ? "left-3" : "right-3")} />
              <div className={cn("absolute top-3 w-2 h-2 bg-blue-500 rounded-full", dir === 'rtl' ? "left-3" : "right-3")} />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1">{t('dashboard.activeNow')}</p>
                <p className="text-5xl font-black text-blue-600 dark:text-blue-400">{ga4ActiveUsers}</p>
              </div>
              <div className="text-end">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.totalUsers')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{ga4TotalUsers.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{t('dashboard.topPages')}</h3>
                <div className="space-y-3">
                  {topPages.length > 0 ? topPages.map((page, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-24 font-medium text-gray-700 dark:text-gray-300 truncate">{page.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full" style={{ width: `${page.percent}%` }} />
                      </div>
                      <span className="w-8 font-bold text-gray-500 dark:text-gray-400 text-xs">{page.percent}%</span>
                    </div>
                  )) : (
                    <p className="text-xs text-gray-500">{isHebrew ? 'אין נתוני עמודים זמינים כרגע.' : 'No page data available right now.'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{t('dashboard.trafficSources')}</h3>
                <div className="space-y-3">
                  {trafficSources.length > 0 ? trafficSources.map((source, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className={cn("w-2 h-2 rounded-full", source.color)} />
                      <span className="w-24 font-medium text-gray-700 dark:text-gray-300 truncate">{source.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", source.color)} style={{ width: `${source.percent}%` }} />
                      </div>
                      <span className="w-8 font-bold text-gray-500 dark:text-gray-400 text-xs">{source.percent}%</span>
                    </div>
                  )) : (
                    <p className="text-xs text-gray-500">{isHebrew ? 'אין נתוני מקורות תנועה זמינים כרגע.' : 'No traffic source data available right now.'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Growth Chart */}
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-6 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.businessGrowth')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.businessGrowthDesc')} {dateRangeLabel}</p>
            </div>
          </div>
          
          <div className="h-72 mt-6">
            {isWooLiveLoading ? (
              <div className="h-full rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 flex items-center justify-center">
                <div className="text-center px-4">
                  <p className="text-sm font-bold text-indigo-700">
                    {isHebrew ? 'טוען נתונים חיים מ‑WooCommerce' : 'Loading live WooCommerce data'}
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">{wooLiveLoadingPercent}%</p>
                  <div className="mt-2 h-1.5 w-48 max-w-full rounded-full bg-indigo-100 overflow-hidden mx-auto">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${wooLiveLoadingPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1f2937', color: '#fff' }}
                    itemStyle={{ fontWeight: 600, color: '#fff' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 500 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name={t('dashboard.revenue')} />
                  <Area type="monotone" dataKey="spend" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" name={t('dashboard.spend')} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* SEO Section */}
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('dashboard.seoOverview')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.performanceDataFromGsc')}</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('seo')}
            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {t('dashboard.goToSeoCenter')}
            <ArrowRight className={cn("w-4 h-4", dir === 'rtl' ? "rotate-180" : "")} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-100 dark:border-white/5 text-center hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors cursor-pointer group">
            <MousePointerClick className="w-6 h-6 text-blue-500 dark:text-blue-400 mx-auto mb-3 transition-transform group-hover:scale-110" />
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{(gscTotals?.clicks ?? 3842).toLocaleString()}</p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dashboard.clicks')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-100 dark:border-white/5 text-center hover:border-purple-200 dark:hover:border-purple-500/30 transition-colors cursor-pointer group">
            <Eye className="w-6 h-6 text-purple-500 dark:text-purple-400 mx-auto mb-3 transition-transform group-hover:scale-110" />
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{(gscTotals?.impressions ?? 48200).toLocaleString()}</p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dashboard.impressions')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-100 dark:border-white/5 text-center hover:border-orange-200 dark:hover:border-orange-500/30 transition-colors cursor-pointer group">
            <Target className="w-6 h-6 text-orange-500 dark:text-orange-400 mx-auto mb-3 transition-transform group-hover:scale-110" />
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">#{(gscTotals?.position ?? 14.3).toFixed(1)}</p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dashboard.avgPosition')}</p>
          </div>
          <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-100 dark:border-white/5 text-center hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-colors cursor-pointer group">
            <TrendingUp className="w-6 h-6 text-emerald-500 dark:text-emerald-400 mx-auto mb-3 transition-transform group-hover:scale-110" />
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">{(gscTotals?.ctr ?? 7.97).toFixed(2)}%</p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dashboard.ctr')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

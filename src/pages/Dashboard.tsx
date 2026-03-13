import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  Users,
  ShoppingCart,
  Megaphone,
  Search,
  Sparkles,
  ArrowRight,
  Loader2,
  Activity,
  Store,
  Target,
  Globe,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { generateDashboardData } from '../lib/dataUtils';
import { fetchGA4Report, fetchGSCData, fetchGoogleCampaigns } from '../services/googleService';
import { fetchMetaCampaigns } from '../services/metaService';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import {
  fetchWooCommerceLatestOrders,
  fetchWooCommerceSalesByRange,
  type WooCommerceOrder,
} from '../services/woocommerceService';
import { auth } from '../lib/firebase';
import { useCurrency } from '../contexts/CurrencyContext';

type CampaignSnapshot = {
  id: string | number;
  name: string;
  platform: 'Google' | 'Meta' | 'TikTok';
  status: 'Active' | 'Paused';
  spend: number;
  roas: number;
};

type CampaignSummary = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalSpend: number;
  avgRoas: number;
  platformBreakdown: Array<{ platform: 'Google' | 'Meta' | 'TikTok'; count: number }>;
};

const DEMO_GA4_STATS = { activeNow: 42, totalUsers: 1247 };
const DEMO_GSC_STATS = { clicks: 3842, impressions: 48200, avgPosition: 14.3, ctr: 7.97 };

const DEMO_RECENT_ORDERS: WooCommerceOrder[] = [
  {
    id: 801,
    number: '801',
    status: 'processing',
    currency: 'ILS',
    total: 529,
    total_tax: 0,
    shipping_total: 25,
    payment_method: 'card',
    payment_method_title: 'Credit Card',
    date_created: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    date_modified: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    date_completed: null,
    customer_note: '',
    billing: { first_name: 'רועי', last_name: 'לוי', email: 'roy@example.com', phone: '+972501112233' },
    shipping: { first_name: 'רועי', last_name: 'לוי' },
    line_items: [],
    meta_data: [],
  },
  {
    id: 802,
    number: '802',
    status: 'completed',
    currency: 'ILS',
    total: 249,
    total_tax: 0,
    shipping_total: 0,
    payment_method: 'paypal',
    payment_method_title: 'PayPal',
    date_created: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    date_modified: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    date_completed: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    customer_note: 'נא להשאיר ליד הדלת',
    billing: { first_name: 'נועה', last_name: 'כהן', email: 'noa@example.com', phone: '+972507778899' },
    shipping: { first_name: 'נועה', last_name: 'כהן' },
    line_items: [],
    meta_data: [],
  },
  {
    id: 803,
    number: '803',
    status: 'pending',
    currency: 'ILS',
    total: 1090,
    total_tax: 0,
    shipping_total: 35,
    payment_method: 'card',
    payment_method_title: 'Credit Card',
    date_created: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    date_modified: new Date(Date.now() - 1000 * 60 * 138).toISOString(),
    date_completed: null,
    customer_note: '',
    billing: { first_name: 'אור', last_name: 'שחר', email: 'or@example.com', phone: '+972505556677' },
    shipping: { first_name: 'אור', last_name: 'שחר' },
    line_items: [],
    meta_data: [],
  },
  {
    id: 804,
    number: '804',
    status: 'completed',
    currency: 'ILS',
    total: 339,
    total_tax: 0,
    shipping_total: 20,
    payment_method: 'card',
    payment_method_title: 'Credit Card',
    date_created: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    date_modified: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    date_completed: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
    customer_note: '',
    billing: { first_name: 'מיכל', last_name: 'אדרי', email: 'michal@example.com', phone: '+972503339944' },
    shipping: { first_name: 'מיכל', last_name: 'אדרי' },
    line_items: [],
    meta_data: [],
  },
  {
    id: 805,
    number: '805',
    status: 'on-hold',
    currency: 'ILS',
    total: 799,
    total_tax: 0,
    shipping_total: 0,
    payment_method: 'bank',
    payment_method_title: 'Bank Transfer',
    date_created: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
    date_modified: new Date(Date.now() - 1000 * 60 * 309).toISOString(),
    date_completed: null,
    customer_note: '',
    billing: { first_name: 'דן', last_name: 'מור', email: 'dan@example.com', phone: '+972501234111' },
    shipping: { first_name: 'דן', last_name: 'מור' },
    line_items: [],
    meta_data: [],
  },
];

const DEMO_CAMPAIGN_SUMMARY: CampaignSummary = {
  totalCampaigns: 9,
  activeCampaigns: 6,
  totalSpend: 8420,
  avgRoas: 2.8,
  platformBreakdown: [
    { platform: 'Google', count: 4 },
    { platform: 'Meta', count: 3 },
    { platform: 'TikTok', count: 2 },
  ],
};
const EMPTY_CAMPAIGN_SUMMARY: CampaignSummary = {
  totalCampaigns: 0,
  activeCampaigns: 0,
  totalSpend: 0,
  avgRoas: 0,
  platformBreakdown: [],
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const moneyFromUnknown = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
const orderStatusLabel = (status: string): string => {
  const normalized = (status || '').toLowerCase();
  switch (normalized) {
    case 'completed':
      return 'הושלמה';
    case 'processing':
      return 'בטיפול';
    case 'pending':
      return 'ממתינה';
    case 'on-hold':
      return 'בהמתנה';
    case 'cancelled':
      return 'בוטלה';
    case 'refunded':
      return 'הוחזרה';
    case 'failed':
      return 'נכשלה';
    default:
      return status || '—';
  }
};
const orderStatusBadgeClass = (status: string) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'processing') return 'bg-sky-100 text-sky-700';
  if (normalized === 'pending' || normalized === 'on-hold') return 'bg-amber-100 text-amber-700';
  if (normalized === 'cancelled' || normalized === 'refunded' || normalized === 'failed') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-gray-100 text-gray-700';
};

export function Dashboard() {
  const { dir } = useLanguage();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections } = useConnections();
  const { format: formatCurrency } = useCurrency();
  const currentUser = auth.currentUser;
  const hasLoadedRealDataRef = useRef(false);

  const connectedPlatforms = connections.filter((c) => c.status === 'connected');
  const isWooConnected = connections.find((c) => c.id === 'woocommerce')?.status === 'connected';
  const isShopifyConnected = connections.find((c) => c.id === 'shopify')?.status === 'connected';
  const isStoreConnected = isWooConnected || isShopifyConnected;

  const fallbackData = useMemo(() => {
    const seedStr =
      connectedPlatforms.map((c) => Object.values(c.settings || {}).join('')).join('') || 'default';
    const data = generateDashboardData(seedStr, dateRange);
    if (!isStoreConnected) {
      return {
        ...data,
        totalRevenue: 0,
        roas: '0.00',
        netProfit: -data.totalSpend,
      };
    }
    return data;
  }, [connectedPlatforms, dateRange, isStoreConnected]);

  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(fallbackData.totalRevenue);
  const [totalSpend, setTotalSpend] = useState(fallbackData.totalSpend);
  const [netProfit, setNetProfit] = useState(fallbackData.netProfit);
  const [roas, setRoas] = useState(fallbackData.roas);
  const [ga4Stats, setGa4Stats] = useState(DEMO_GA4_STATS);
  const [gscStats, setGscStats] = useState(DEMO_GSC_STATS);
  const [recentOrders, setRecentOrders] = useState<WooCommerceOrder[]>(DEMO_RECENT_ORDERS);
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary>(DEMO_CAMPAIGN_SUMMARY);
  const [financialAvailability, setFinancialAvailability] = useState({
    revenue: false,
    spend: false,
    netProfit: false,
    roas: false,
  });

  const [isGa4UsingDemo, setIsGa4UsingDemo] = useState(true);
  const [isOrdersUsingDemo, setIsOrdersUsingDemo] = useState(true);
  const [isCampaignsUsingDemo, setIsCampaignsUsingDemo] = useState(true);
  const [isGscUsingDemo, setIsGscUsingDemo] = useState(true);

  useEffect(() => {
    hasLoadedRealDataRef.current = false;
    setFinancialAvailability({
      revenue: false,
      spend: false,
      netProfit: false,
      roas: false,
    });
  }, [bounds.startDate, bounds.endDate]);

  useEffect(() => {
    if (hasLoadedRealDataRef.current) return;
    hasLoadedRealDataRef.current = true;

    let cancelled = false;

    const buildCampaignSummary = (campaigns: CampaignSnapshot[]): CampaignSummary => {
      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter((c) => c.status === 'Active').length;
      const totalSpendLive = campaigns.reduce((sum, c) => sum + c.spend, 0);
      const roasRows = campaigns.filter((c) => c.roas > 0);
      const avgRoas =
        roasRows.length > 0
          ? roasRows.reduce((sum, c) => sum + c.roas, 0) / roasRows.length
          : 0;
      const platformBreakdown = (['Google', 'Meta', 'TikTok'] as const)
        .map((platform) => ({
          platform,
          count: campaigns.filter((c) => c.platform === platform).length,
        }))
        .filter((row) => row.count > 0);

      return {
        totalCampaigns,
        activeCampaigns,
        totalSpend: totalSpendLive,
        avgRoas,
        platformBreakdown,
      };
    };

    async function loadOverview() {
      setIsLoadingOverview(true);

      const woo = connections.find((c) => c.id === 'woocommerce' && c.status === 'connected');
      const google = connections.find((c) => c.id === 'google' && c.status === 'connected');
      const meta = connections.find((c) => c.id === 'meta' && c.status === 'connected');
      const tiktok = connections.find((c) => c.id === 'tiktok' && c.status === 'connected');

      let liveRevenue = 0;
      let liveSpend = 0;
      let hasGa4Live = false;
      let hasGscLive = false;
      let hasOrdersLive = false;
      let hasCampaignsLive = false;
      let hasRevenueLive = false;
      let hasSpendLive = false;
      let ga4Live = DEMO_GA4_STATS;
      let gscLive = DEMO_GSC_STATS;
      let latestOrdersLive: WooCommerceOrder[] = [];
      const campaignRows: CampaignSnapshot[] = [];

      const endIso = bounds.endDate.toISOString();
      const startIsoDateOnly = bounds.startDate.toISOString().slice(0, 10);
      const endIsoDateOnly = bounds.endDate.toISOString().slice(0, 10);

      if (woo?.settings?.storeUrl && woo.settings.wooKey && woo.settings.wooSecret) {
        try {
          const salesRows = await fetchWooCommerceSalesByRange(
            woo.settings.storeUrl,
            woo.settings.wooKey,
            woo.settings.wooSecret,
            startIsoDateOnly,
            endIsoDateOnly
          );
          const revenueFromRange = salesRows.reduce(
            (sum, row) => sum + toNumber(row.netSales || row.totalSales, 0),
            0
          );
          liveRevenue = revenueFromRange;
          hasRevenueLive = true;
        } catch (error) {
          console.warn('Failed to load WooCommerce sales range', error);
        }

        try {
          const orders = await fetchWooCommerceLatestOrders(
            woo.settings.storeUrl,
            woo.settings.wooKey,
            woo.settings.wooSecret,
            5
          );
          if (orders.length > 0) {
            latestOrdersLive = [...orders]
              .sort(
                (a, b) =>
                  new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime()
              )
              .slice(0, 5);
            hasOrdersLive = true;
            if (!hasRevenueLive && liveRevenue <= 0) {
              hasRevenueLive = true;
              liveRevenue = orders.reduce((sum, order) => sum + toNumber(order.total, 0), 0);
            }
          }
        } catch (error) {
          console.warn('Failed to load latest WooCommerce orders', error);
        }
      }

      if (google?.settings?.googleAccessToken) {
        const token = google.settings.googleAccessToken;

        if (google.settings.ga4Id) {
          try {
            const report = await fetchGA4Report(token, google.settings.ga4Id);
            const rows = Array.isArray(report.rows) ? report.rows : [];
            let totalUsers = 0;
            let activeNow = 0;
            rows.forEach((row: any) => {
              const metrics = row.metricValues || row.metrics || [];
              totalUsers += moneyFromUnknown(metrics?.[0]?.value);
            });
            if (rows.length) {
              const latestMetrics = rows[rows.length - 1]?.metricValues || rows[rows.length - 1]?.metrics || [];
              activeNow = moneyFromUnknown(latestMetrics?.[0]?.value);
            }
            ga4Live = {
              activeNow: toNumber(activeNow, DEMO_GA4_STATS.activeNow),
              totalUsers: toNumber(totalUsers, DEMO_GA4_STATS.totalUsers),
            };
            hasGa4Live = ga4Live.activeNow > 0 || ga4Live.totalUsers > 0;
          } catch (error) {
            console.warn('Failed to load GA4 stats', error);
          }
        }

        if (google.settings.siteUrl) {
          try {
            const gsc = await fetchGSCData(token, google.settings.siteUrl);
            const rows = Array.isArray(gsc.rows) ? gsc.rows : [];
            let clicks = 0;
            let impressions = 0;
            let positionSum = 0;
            rows.forEach((row: any) => {
              clicks += toNumber(row.clicks, 0);
              impressions += toNumber(row.impressions, 0);
              positionSum += toNumber(row.position, 0);
            });
            const avgPosition = rows.length ? positionSum / rows.length : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            gscLive = {
              clicks: toNumber(clicks, DEMO_GSC_STATS.clicks),
              impressions: toNumber(impressions, DEMO_GSC_STATS.impressions),
              avgPosition: toNumber(avgPosition, DEMO_GSC_STATS.avgPosition),
              ctr: toNumber(ctr, DEMO_GSC_STATS.ctr),
            };
            hasGscLive = gscLive.clicks > 0 || gscLive.impressions > 0;
          } catch (error) {
            console.warn('Failed to load GSC stats', error);
          }
        }

        if (google.settings.googleAdsId) {
          try {
            const googleCampaigns = await fetchGoogleCampaigns(
              token,
              google.settings.googleAdsId,
              google.settings.loginCustomerId
            );
            googleCampaigns.forEach((campaign: any) => {
              const spend = moneyFromUnknown(campaign.spend);
              const roasValue = moneyFromUnknown(campaign.roas);
              campaignRows.push({
                id: campaign.id,
                name: campaign.name || 'Google Campaign',
                platform: 'Google',
                status: campaign.status === 'Active' ? 'Active' : 'Paused',
                spend,
                roas: roasValue,
              });
              liveSpend += spend;
            });
            if (googleCampaigns.length > 0) {
              hasSpendLive = true;
            }
            if (googleCampaigns.length > 0) {
              hasCampaignsLive = true;
            }
          } catch (error) {
            console.warn('Failed to load Google campaigns', error);
          }
        }
      }

      if (meta?.settings?.metaToken && meta.settings.metaAdsId) {
        try {
          const metaCampaigns = await fetchMetaCampaigns(meta.settings.metaToken, meta.settings.metaAdsId);
          metaCampaigns.forEach((campaign: any) => {
            const spend = moneyFromUnknown(campaign.spend);
            const roasValue = moneyFromUnknown(campaign.roas);
            campaignRows.push({
              id: campaign.id,
              name: campaign.name || 'Meta Campaign',
              platform: 'Meta',
              status: campaign.status === 'Active' ? 'Active' : 'Paused',
              spend,
              roas: roasValue,
            });
            liveSpend += spend;
          });
          if (metaCampaigns.length > 0) {
            hasSpendLive = true;
          }
          if (metaCampaigns.length > 0) {
            hasCampaignsLive = true;
          }
        } catch (error) {
          console.warn('Failed to load Meta campaigns', error);
        }
      }

      if (tiktok?.settings?.tiktokToken && tiktok.settings.tiktokAdvertiserId) {
        try {
          const tiktokCampaigns = await fetchTikTokCampaigns(
            tiktok.settings.tiktokToken,
            tiktok.settings.tiktokAdvertiserId
          );
          (Array.isArray(tiktokCampaigns) ? tiktokCampaigns : []).forEach((campaign: any) => {
            const spend = moneyFromUnknown(
              campaign.stat_cost ?? campaign.spend ?? campaign.cost ?? campaign.metrics?.spend
            );
            const roasValue = moneyFromUnknown(
              campaign.roas ?? campaign.stat_roas ?? campaign.metrics?.roas
            );
            campaignRows.push({
              id: campaign.campaign_id || campaign.id || `tiktok-${campaign.campaign_name || 'campaign'}`,
              name: campaign.campaign_name || campaign.name || 'TikTok Campaign',
              platform: 'TikTok',
              status: campaign.operation_status === 'ENABLE' ? 'Active' : 'Paused',
              spend,
              roas: roasValue,
            });
            liveSpend += spend;
          });
          const hasTikTokCampaignRows = (Array.isArray(tiktokCampaigns) ? tiktokCampaigns.length : 0) > 0;
          if (hasTikTokCampaignRows) {
            hasSpendLive = true;
            hasCampaignsLive = true;
          }
        } catch (error) {
          console.warn('Failed to load TikTok campaigns', error);
        }
      }

      if (cancelled) return;

      const finalRevenue = hasRevenueLive ? liveRevenue : 0;
      const finalSpend = hasSpendLive ? liveSpend : 0;
      const finalRoas = hasRevenueLive && hasSpendLive && finalSpend > 0 ? (finalRevenue / finalSpend).toFixed(2) : '0.00';
      const finalNetProfit = finalRevenue - finalSpend;

      setTotalRevenue(finalRevenue);
      setTotalSpend(finalSpend);
      setRoas(finalRoas);
      setNetProfit(finalNetProfit);
      setFinancialAvailability({
        revenue: hasRevenueLive,
        spend: hasSpendLive,
        netProfit: hasRevenueLive && hasSpendLive,
        roas: hasRevenueLive && hasSpendLive && finalSpend > 0,
      });

      const hasAnyLiveData =
        hasRevenueLive || hasSpendLive || hasGa4Live || hasGscLive || hasOrdersLive || hasCampaignsLive;
      const useDemoFallback = !hasAnyLiveData;

      if (hasGa4Live) {
        setGa4Stats(ga4Live);
        setIsGa4UsingDemo(false);
      } else if (useDemoFallback) {
        setGa4Stats(DEMO_GA4_STATS);
        setIsGa4UsingDemo(true);
      } else {
        setGa4Stats({ activeNow: 0, totalUsers: 0 });
        setIsGa4UsingDemo(false);
      }

      if (hasGscLive) {
        setGscStats(gscLive);
        setIsGscUsingDemo(false);
      } else if (useDemoFallback) {
        setGscStats(DEMO_GSC_STATS);
        setIsGscUsingDemo(true);
      } else {
        setGscStats({ clicks: 0, impressions: 0, avgPosition: 0, ctr: 0 });
        setIsGscUsingDemo(false);
      }

      if (hasOrdersLive) {
        setRecentOrders(latestOrdersLive);
        setIsOrdersUsingDemo(false);
      } else if (useDemoFallback) {
        setRecentOrders(DEMO_RECENT_ORDERS);
        setIsOrdersUsingDemo(true);
      } else {
        setRecentOrders([]);
        setIsOrdersUsingDemo(false);
      }

      if (hasCampaignsLive) {
        setCampaignSummary(buildCampaignSummary(campaignRows));
        setIsCampaignsUsingDemo(false);
      } else if (useDemoFallback) {
        setCampaignSummary(DEMO_CAMPAIGN_SUMMARY);
        setIsCampaignsUsingDemo(true);
      } else {
        setCampaignSummary(EMPTY_CAMPAIGN_SUMMARY);
        setIsCampaignsUsingDemo(false);
      }
      setIsLoadingOverview(false);
    }

    loadOverview().catch(() => {
      if (!cancelled) {
        setIsLoadingOverview(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    bounds.endDate,
    bounds.startDate,
    connections,
    fallbackData.netProfit,
    fallbackData.roas,
    fallbackData.totalRevenue,
    fallbackData.totalSpend,
  ]);

  const safeTotalRevenue = toNumber(totalRevenue, 0);
  const safeTotalSpend = toNumber(totalSpend, 0);
  const safeNetProfit = toNumber(netProfit, 0);
  const safeRoas = (() => {
    const parsed = Number(roas);
    if (Number.isFinite(parsed)) return parsed.toFixed(2);
    if (safeTotalSpend > 0) return (safeTotalRevenue / safeTotalSpend).toFixed(2);
    return '0.00';
  })();
  const safeGa4Stats = {
    activeNow: toNumber(ga4Stats.activeNow, DEMO_GA4_STATS.activeNow),
    totalUsers: toNumber(ga4Stats.totalUsers, DEMO_GA4_STATS.totalUsers),
  };
  const safeGscStats = {
    clicks: toNumber(gscStats.clicks, DEMO_GSC_STATS.clicks),
    impressions: toNumber(gscStats.impressions, DEMO_GSC_STATS.impressions),
    avgPosition: toNumber(gscStats.avgPosition, DEMO_GSC_STATS.avgPosition),
    ctr: toNumber(gscStats.ctr, DEMO_GSC_STATS.ctr),
  };
  const hasGa4Data = isGa4UsingDemo || safeGa4Stats.activeNow > 0 || safeGa4Stats.totalUsers > 0;
  const hasGscData = isGscUsingDemo || safeGscStats.clicks > 0 || safeGscStats.impressions > 0;
  const hasOrdersData = isOrdersUsingDemo || recentOrders.length > 0;
  const hasCampaignData = isCampaignsUsingDemo || campaignSummary.totalCampaigns > 0;
  const ga4Availability = {
    activeNow: isGa4UsingDemo || safeGa4Stats.activeNow > 0,
    totalUsers: isGa4UsingDemo || safeGa4Stats.totalUsers > 0,
  };
  const campaignAvailability = {
    totalCampaigns: hasCampaignData,
    activeCampaigns: hasCampaignData,
    spend: isCampaignsUsingDemo || financialAvailability.spend,
    roas: isCampaignsUsingDemo || campaignSummary.avgRoas > 0,
  };
  const seoAvailability = {
    siteScore: hasGa4Data || hasGscData,
    searchConsoleScore: hasGscData,
    clicks: hasGscData,
    impressions: hasGscData,
    ctr: hasGscData,
    avgPosition: hasGscData,
  };

  const siteSeoScore = useMemo(() => {
    const ctrScore = Math.min(30, safeGscStats.ctr * 3);
    const positionScore = Math.max(0, 35 - safeGscStats.avgPosition * 1.2);
    const trafficScore = Math.min(35, Math.log10(safeGa4Stats.totalUsers + 1) * 9);
    return Math.round(ctrScore + positionScore + trafficScore);
  }, [safeGa4Stats.totalUsers, safeGscStats.avgPosition, safeGscStats.ctr]);

  const searchConsoleSeoScore = useMemo(() => {
    const clickScore = Math.min(40, Math.log10(safeGscStats.clicks + 1) * 10);
    const impressionScore = Math.min(25, Math.log10(safeGscStats.impressions + 1) * 5.5);
    const positionScore = Math.max(0, 35 - safeGscStats.avgPosition * 1.4);
    return Math.round(clickScore + impressionScore + positionScore);
  }, [safeGscStats.avgPosition, safeGscStats.clicks, safeGscStats.impressions]);

  const optimizationRecommendations = useMemo(() => {
    const recommendations: string[] = [];

    if (financialAvailability.roas && Number(safeRoas) < 2) {
      recommendations.push('להגדיל תקציב רק בקמפיינים עם המרות בפועל ולעצור קבוצות מודעות חלשות.');
    }
    if (hasGscData && safeGscStats.avgPosition > 12) {
      recommendations.push('לחזק SEO בדפי קטגוריה ומוצר עם כותרות H1 מדויקות וקישורים פנימיים.');
    }
    if (hasGscData && safeGscStats.ctr < 2.5) {
      recommendations.push('לשפר Meta Title ו Meta Description בדפים עם חשיפות גבוהות ו CTR נמוך.');
    }
    if (hasGa4Data && hasOrdersData && safeGa4Stats.activeNow > 0 && recentOrders.length < 3) {
      recommendations.push('לבדוק משפך רכישה ועמודי Checkout כדי לשפר יחס המרה מתנועה להזמנה.');
    }
    if (hasCampaignData && campaignSummary.activeCampaigns < campaignSummary.totalCampaigns) {
      recommendations.push('להפעיל מחדש רק קמפיינים מושהים עם עלות לרכישה יציבה וללא שחיקת ROAS.');
    }

    return recommendations.slice(0, 5);
  }, [campaignSummary.activeCampaigns, campaignSummary.totalCampaigns, financialAvailability.roas, hasCampaignData, hasGa4Data, hasGscData, hasOrdersData, recentOrders.length, safeGa4Stats.activeNow, safeGscStats.avgPosition, safeGscStats.ctr, safeRoas]);
  const hasAnyOptimizationInput =
    financialAvailability.revenue ||
    financialAvailability.spend ||
    hasGa4Data ||
    hasGscData ||
    hasOrdersData ||
    hasCampaignData;

  const goToPath = (path: string) => {
    if (typeof window === 'undefined') return;
    window.history.pushState({}, '', path);
    try {
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.dispatchEvent(new Event('popstate'));
    }
  };

  const DemoTag = ({ show }: { show: boolean }) =>
    show ? (
      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        Demo data
      </span>
    ) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ui-display text-2xl sm:text-3xl text-gray-900 dark:text-white">
            סקירה כללית, {currentUser?.displayName?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="ui-subtitle text-gray-500 dark:text-gray-400 mt-1">
            נתונים מרכזיים מהחנות, מהקמפיינים, מ GA4 ומ Search Console במקום אחד.
          </p>
        </div>
        {isLoadingOverview && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            מסנכרן נתונים חיים...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">הכנסות</h2>
            </div>
          </div>

          <div className="space-y-2">
            {financialAvailability.revenue && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">סה"כ הכנסות</span>
                <span className="font-extrabold text-emerald-700">{formatCurrency(safeTotalRevenue)}</span>
              </div>
            )}
            {financialAvailability.spend && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">סה"כ הוצאות פרסום</span>
                <span className="font-bold text-red-600">{formatCurrency(safeTotalSpend)}</span>
              </div>
            )}
            {financialAvailability.netProfit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">רווח נקי</span>
                <span className="font-bold text-indigo-600">{formatCurrency(safeNetProfit)}</span>
              </div>
            )}
            {financialAvailability.roas && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">ROAS</span>
                <span className="font-black text-gray-900 dark:text-white">{safeRoas}x</span>
              </div>
            )}
            {!financialAvailability.revenue && !financialAvailability.spend && (
              <p className="text-xs text-gray-500">
                עדיין אין נתונים חיים להכנסות או הוצאות פרסום לטווח התאריכים שנבחר.
              </p>
            )}
          </div>

          <button
            onClick={() => goToPath('/orders')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            מעבר לרשימת הזמנות
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">מצב גולשים מהאתר GA4</h2>
            </div>
            <DemoTag show={isGa4UsingDemo} />
          </div>

          {hasGa4Data ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {ga4Availability.activeNow && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <p className="text-[11px] font-semibold text-blue-700">פעילים עכשיו</p>
                    <p className="text-3xl font-black text-blue-600 mt-1">{safeGa4Stats.activeNow}</p>
                  </div>
                )}
                {ga4Availability.totalUsers && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                    <p className="text-[11px] font-semibold text-indigo-700">סה"כ משתמשים</p>
                    <p className="text-3xl font-black text-indigo-600 mt-1">{safeGa4Stats.totalUsers.toLocaleString()}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                מציג תמונת מצב מיידית של התנועה לאתר ומסייע להבין האם הקמפיינים מביאים גולשים בזמן אמת.
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              אין כרגע נתוני GA4 חיים להצגה.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">5 הזמנות אחרונות</h2>
            </div>
            <DemoTag show={isOrdersUsingDemo} />
          </div>

          <div className="space-y-2">
            {recentOrders.length ? (
              recentOrders.slice(0, 5).map((order) => {
                const customerName =
                  `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() || 'לקוח';
                return (
                  <div key={order.id} className="rounded-xl border border-gray-200 p-2.5 bg-gray-50/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-bold text-gray-900">#{order.number}</p>
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap',
                            orderStatusBadgeClass(order.status)
                          )}
                        >
                          {orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500">{formatDate(order.date_created)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-gray-700 truncate">{customerName}</p>
                      <p className="text-xs font-extrabold text-indigo-700 whitespace-nowrap">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500">אין כרגע נתוני הזמנות חיים להצגה.</p>
            )}
          </div>

          <button
            onClick={() => goToPath('/orders')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            מעבר להזמנות
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">מצב קמפיינים מהפלטפורמות</h2>
            </div>
            <DemoTag show={isCampaignsUsingDemo} />
          </div>

          {hasCampaignData || campaignAvailability.spend || campaignAvailability.roas ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {campaignAvailability.totalCampaigns && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <p className="text-gray-500 text-xs">סה"כ קמפיינים</p>
                    <p className="text-xl font-black text-gray-900">{campaignSummary.totalCampaigns}</p>
                  </div>
                )}
                {campaignAvailability.activeCampaigns && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <p className="text-gray-500 text-xs">פעילים כרגע</p>
                    <p className="text-xl font-black text-emerald-600">{campaignSummary.activeCampaigns}</p>
                  </div>
                )}
                {campaignAvailability.spend && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <p className="text-gray-500 text-xs">הוצאה כוללת</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(campaignSummary.totalSpend)}</p>
                  </div>
                )}
                {campaignAvailability.roas && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <p className="text-gray-500 text-xs">ROAS / ROS</p>
                    <p className="text-xl font-black text-indigo-600">{campaignSummary.avgRoas.toFixed(2)}x</p>
                  </div>
                )}
              </div>

              {campaignSummary.platformBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {campaignSummary.platformBreakdown.map((row) => (
                    <span
                      key={row.platform}
                      className="text-[11px] font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full"
                    >
                      {row.platform}: {row.count}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">אין כרגע נתוני קמפיינים חיים להצגה.</p>
          )}

          <button
            onClick={() => goToPath('/campaigns')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            מעבר לקמפיינים
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">מצב SEO באתר מול Search Console</h2>
            </div>
            <DemoTag show={isGscUsingDemo} />
          </div>

          {seoAvailability.siteScore || seoAvailability.searchConsoleScore || seoAvailability.clicks ? (
            <>
              <div className="space-y-3">
                {seoAvailability.siteScore && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" /> SEO באתר</span>
                      <span className="font-black text-gray-900">{siteSeoScore}/100</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(siteSeoScore, 100)}%` }} />
                    </div>
                  </div>
                )}
                {seoAvailability.searchConsoleScore && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> SEO ב Search Console</span>
                      <span className="font-black text-gray-900">{searchConsoleSeoScore}/100</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(searchConsoleSeoScore, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {seoAvailability.clicks && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-gray-500">קליקים</p>
                    <p className="font-bold text-gray-900">{safeGscStats.clicks.toLocaleString()}</p>
                  </div>
                )}
                {seoAvailability.impressions && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-gray-500">חשיפות</p>
                    <p className="font-bold text-gray-900">{safeGscStats.impressions.toLocaleString()}</p>
                  </div>
                )}
                {seoAvailability.ctr && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-gray-500">CTR</p>
                    <p className="font-bold text-gray-900">{safeGscStats.ctr.toFixed(2)}%</p>
                  </div>
                )}
                {seoAvailability.avgPosition && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-gray-500">מיקום ממוצע</p>
                    <p className="font-bold text-gray-900">#{safeGscStats.avgPosition.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">אין כרגע נתוני SEO חיים להצגה.</p>
          )}

          <button
            onClick={() => goToPath('/seo')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            מעבר ל SEO
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">המלצות לאופטימיזציה</h2>
          </div>

          <div className="space-y-2.5">
            {optimizationRecommendations.length > 0 ? (
              optimizationRecommendations.map((rec, idx) => (
                <div key={idx} className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
                  <div className="flex items-start gap-2">
                    <Activity className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-800 leading-relaxed">{rec}</p>
                  </div>
                </div>
              ))
            ) : hasAnyOptimizationInput ? (
              <p className="text-xs text-gray-500">יש כרגע מעט נתונים חיים ולכן אין המלצות חדשות לאופטימיזציה.</p>
            ) : (
              <p className="text-xs text-gray-500">אין כרגע מספיק נתונים חיים כדי ליצור המלצות אופטימיזציה.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => goToPath('/ai-recommendations')}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
            >
              המלצות AI
              <ArrowRight className={cn('w-3.5 h-3.5', dir === 'rtl' ? 'rotate-180' : '')} />
            </button>
            <button
              onClick={() => goToPath('/campaigns')}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl py-2"
            >
              אופטימיזציית קמפיינים
              <Target className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

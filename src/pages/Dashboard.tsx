import React, { useEffect, useMemo, useState } from 'react';
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
import { fetchMetaCampaigns, isMetaRateLimitMessage } from '../services/metaService';
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
  return status || '—';
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
const STATUS_LABELS = {
  he: {
    completed: 'הושלמה',
    processing: 'בטיפול',
    pending: 'ממתינה',
    'on-hold': 'בהמתנה',
    cancelled: 'בוטלה',
    refunded: 'הוחזרה',
    failed: 'נכשלה',
  },
  en: {
    completed: 'Completed',
    processing: 'Processing',
    pending: 'Pending',
    'on-hold': 'On hold',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    failed: 'Failed',
  },
  ru: {
    completed: 'Завершен',
    processing: 'В обработке',
    pending: 'Ожидает',
    'on-hold': 'На удержании',
    cancelled: 'Отменен',
    refunded: 'Возврат',
    failed: 'Ошибка',
  },
  pt: {
    completed: 'Concluído',
    processing: 'Processando',
    pending: 'Pendente',
    'on-hold': 'Em espera',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    failed: 'Falhou',
  },
  fr: {
    completed: 'Terminée',
    processing: 'En cours',
    pending: 'En attente',
    'on-hold': 'En pause',
    cancelled: 'Annulée',
    refunded: 'Remboursée',
    failed: 'Échouée',
  },
} as const;

const COPY = {
  he: {
    title: 'סקירה כללית',
    subtitle: 'נתונים מרכזיים מהחנות, מהקמפיינים, מ GA4 ומ Search Console במקום אחד.',
    syncing: 'מסנכרן נתונים חיים...',
    sourceLive: 'Live',
    sourceMissing: 'Missing metric',
    revenueCard: 'הכנסות',
    totalRevenue: 'סה"כ הכנסות',
    totalSpend: 'סה"כ הוצאות פרסום',
    netProfit: 'רווח נקי',
    roas: 'ROAS',
    noFinanceData: 'עדיין אין נתונים חיים להכנסות או הוצאות פרסום לטווח התאריכים שנבחר.',
    goOrders: 'מעבר לרשימת הזמנות',
    ga4Card: 'מצב גולשים מהאתר GA4',
    activeNow: 'פעילים עכשיו',
    totalUsers: 'סה"כ משתמשים',
    ga4Desc: 'מציג תמונת מצב מיידית של התנועה לאתר ומסייע להבין האם הקמפיינים מביאים גולשים בזמן אמת.',
    noGa4: 'אין כרגע נתוני GA4 חיים להצגה.',
    latestOrdersCard: '5 הזמנות אחרונות',
    customerFallback: 'לקוח',
    noOrders: 'אין כרגע נתוני הזמנות חיים להצגה.',
    goOrdersShort: 'מעבר להזמנות',
    campaignsCard: 'מצב קמפיינים מהפלטפורמות',
    totalCampaigns: 'סה"כ קמפיינים',
    activeCampaigns: 'פעילים כרגע',
    totalCampaignSpend: 'הוצאה כוללת',
    roasRos: 'ROAS / ROS',
    noCampaigns: 'אין כרגע נתוני קמפיינים חיים להצגה.',
    goCampaigns: 'מעבר לקמפיינים',
    seoCard: 'מצב SEO באתר מול Search Console',
    siteSeo: 'SEO באתר',
    scSeo: 'SEO ב Search Console',
    clicks: 'קליקים',
    impressions: 'חשיפות',
    ctr: 'CTR',
    avgPosition: 'מיקום ממוצע',
    noSeo: 'אין כרגע נתוני SEO חיים להצגה.',
    goSeo: 'מעבר ל SEO',
    optimizationCard: 'המלצות לאופטימיזציה',
    noFreshRecs: 'יש כרגע מעט נתונים חיים ולכן אין המלצות חדשות לאופטימיזציה.',
    noRecsData: 'אין כרגע מספיק נתונים חיים כדי ליצור המלצות אופטימיזציה.',
    aiRecs: 'המלצות AI',
    campaignOptimization: 'אופטימיזציית קמפיינים',
    recLowRoas: 'להגדיל תקציב רק בקמפיינים עם המרות בפועל ולעצור קבוצות מודעות חלשות.',
    recSeoStructure: 'לחזק SEO בדפי קטגוריה ומוצר עם כותרות H1 מדויקות וקישורים פנימיים.',
    recMetaCtr: 'לשפר Meta Title ו Meta Description בדפים עם חשיפות גבוהות ו CTR נמוך.',
    recFunnel: 'לבדוק משפך רכישה ועמודי Checkout כדי לשפר יחס המרה מתנועה להזמנה.',
    recPausedCampaigns: 'להפעיל מחדש רק קמפיינים מושהים עם עלות לרכישה יציבה וללא שחיקת ROAS.',
  },
  en: {
    title: 'Overview',
    subtitle: 'Key store, campaign, GA4 and Search Console data in one place.',
    syncing: 'Syncing live data...',
    sourceLive: 'Live',
    sourceMissing: 'Missing metric',
    revenueCard: 'Revenue',
    totalRevenue: 'Total revenue',
    totalSpend: 'Total ad spend',
    netProfit: 'Net profit',
    roas: 'ROAS',
    noFinanceData: 'No live revenue or ad spend data for the selected date range yet.',
    goOrders: 'Go to orders list',
    ga4Card: 'Website traffic status (GA4)',
    activeNow: 'Active now',
    totalUsers: 'Total users',
    ga4Desc: 'Shows real time site traffic so you can understand whether campaigns are bringing visitors now.',
    noGa4: 'No live GA4 data to display right now.',
    latestOrdersCard: 'Latest 5 orders',
    customerFallback: 'Customer',
    noOrders: 'No live order data to display right now.',
    goOrdersShort: 'Go to orders',
    campaignsCard: 'Campaign status across platforms',
    totalCampaigns: 'Total campaigns',
    activeCampaigns: 'Currently active',
    totalCampaignSpend: 'Total spend',
    roasRos: 'ROAS / ROS',
    noCampaigns: 'No live campaign data to display right now.',
    goCampaigns: 'Go to campaigns',
    seoCard: 'Website SEO vs Search Console',
    siteSeo: 'On-site SEO',
    scSeo: 'Search Console SEO',
    clicks: 'Clicks',
    impressions: 'Impressions',
    ctr: 'CTR',
    avgPosition: 'Avg position',
    noSeo: 'No live SEO data to display right now.',
    goSeo: 'Go to SEO',
    optimizationCard: 'Optimization recommendations',
    noFreshRecs: 'Live data is currently partial, so there are no new optimization recommendations.',
    noRecsData: 'Not enough live data yet to generate optimization recommendations.',
    aiRecs: 'AI recommendations',
    campaignOptimization: 'Campaign optimization',
    recLowRoas: 'Increase budget only for campaigns with real conversions and pause weak ad groups.',
    recSeoStructure: 'Strengthen category and product SEO with precise H1 titles and internal links.',
    recMetaCtr: 'Improve meta titles and descriptions on high impression pages with low CTR.',
    recFunnel: 'Review checkout and conversion funnel to improve traffic to order conversion rate.',
    recPausedCampaigns: 'Reactivate paused campaigns only when CPA is stable and ROAS is not eroding.',
  },
  ru: {
    title: 'Обзор',
    subtitle: 'Ключевые данные магазина, кампаний, GA4 и Search Console в одном месте.',
    syncing: 'Синхронизация live данных...',
    sourceLive: 'Live',
    sourceMissing: 'Missing metric',
    revenueCard: 'Доход',
    totalRevenue: 'Общий доход',
    totalSpend: 'Расходы на рекламу',
    netProfit: 'Чистая прибыль',
    roas: 'ROAS',
    noFinanceData: 'Пока нет live данных по доходу или расходам за выбранный период.',
    goOrders: 'Перейти к списку заказов',
    ga4Card: 'Состояние трафика сайта (GA4)',
    activeNow: 'Сейчас активны',
    totalUsers: 'Всего пользователей',
    ga4Desc: 'Показывает трафик сайта в реальном времени.',
    noGa4: 'Сейчас нет live данных GA4.',
    latestOrdersCard: 'Последние 5 заказов',
    customerFallback: 'Клиент',
    noOrders: 'Сейчас нет live данных заказов.',
    goOrdersShort: 'К заказам',
    campaignsCard: 'Состояние кампаний по платформам',
    totalCampaigns: 'Всего кампаний',
    activeCampaigns: 'Активных сейчас',
    totalCampaignSpend: 'Общие расходы',
    roasRos: 'ROAS / ROS',
    noCampaigns: 'Сейчас нет live данных по кампаниям.',
    goCampaigns: 'К кампаниям',
    seoCard: 'SEO сайта vs Search Console',
    siteSeo: 'SEO на сайте',
    scSeo: 'SEO Search Console',
    clicks: 'Клики',
    impressions: 'Показы',
    ctr: 'CTR',
    avgPosition: 'Средняя позиция',
    noSeo: 'Сейчас нет live SEO данных.',
    goSeo: 'К SEO',
    optimizationCard: 'Рекомендации по оптимизации',
    noFreshRecs: 'Сейчас мало live данных, поэтому новых рекомендаций нет.',
    noRecsData: 'Недостаточно live данных для рекомендаций.',
    aiRecs: 'AI рекомендации',
    campaignOptimization: 'Оптимизация кампаний',
    recLowRoas: 'Увеличивайте бюджет только для кампаний с реальными конверсиями.',
    recSeoStructure: 'Усильте SEO категорий и товаров с точными H1 и внутренними ссылками.',
    recMetaCtr: 'Улучшите meta title и description на страницах с высоким показом и низким CTR.',
    recFunnel: 'Проверьте воронку и checkout для повышения конверсии.',
    recPausedCampaigns: 'Возобновляйте только кампании со стабильной стоимостью привлечения.',
  },
  pt: {
    title: 'Visão geral',
    subtitle: 'Dados principais da loja, campanhas, GA4 e Search Console em um só lugar.',
    syncing: 'Sincronizando dados ao vivo...',
    sourceLive: 'Live',
    sourceMissing: 'Missing metric',
    revenueCard: 'Receita',
    totalRevenue: 'Receita total',
    totalSpend: 'Gasto total em anúncios',
    netProfit: 'Lucro líquido',
    roas: 'ROAS',
    noFinanceData: 'Ainda não há dados ao vivo de receita ou gasto no período selecionado.',
    goOrders: 'Ir para lista de pedidos',
    ga4Card: 'Status de tráfego do site (GA4)',
    activeNow: 'Ativos agora',
    totalUsers: 'Usuários totais',
    ga4Desc: 'Mostra o tráfego em tempo real para entender se as campanhas estão trazendo visitas.',
    noGa4: 'Não há dados GA4 ao vivo para mostrar no momento.',
    latestOrdersCard: '5 pedidos mais recentes',
    customerFallback: 'Cliente',
    noOrders: 'Não há dados de pedidos ao vivo para mostrar no momento.',
    goOrdersShort: 'Ir para pedidos',
    campaignsCard: 'Status de campanhas por plataforma',
    totalCampaigns: 'Total de campanhas',
    activeCampaigns: 'Ativas agora',
    totalCampaignSpend: 'Gasto total',
    roasRos: 'ROAS / ROS',
    noCampaigns: 'Não há dados de campanhas ao vivo para mostrar no momento.',
    goCampaigns: 'Ir para campanhas',
    seoCard: 'SEO do site vs Search Console',
    siteSeo: 'SEO no site',
    scSeo: 'SEO no Search Console',
    clicks: 'Cliques',
    impressions: 'Impressões',
    ctr: 'CTR',
    avgPosition: 'Posição média',
    noSeo: 'Não há dados SEO ao vivo para mostrar no momento.',
    goSeo: 'Ir para SEO',
    optimizationCard: 'Recomendações de otimização',
    noFreshRecs: 'Há poucos dados ao vivo no momento, sem novas recomendações.',
    noRecsData: 'Dados ao vivo insuficientes para gerar recomendações.',
    aiRecs: 'Recomendações AI',
    campaignOptimization: 'Otimização de campanhas',
    recLowRoas: 'Aumente orçamento apenas em campanhas com conversões reais.',
    recSeoStructure: 'Reforce SEO de categorias e produtos com H1 correto e links internos.',
    recMetaCtr: 'Melhore meta title e description em páginas com alta impressão e CTR baixo.',
    recFunnel: 'Revise checkout e funil para melhorar conversão de tráfego em pedido.',
    recPausedCampaigns: 'Reative campanhas pausadas apenas com CPA estável e sem erosão de ROAS.',
  },
  fr: {
    title: 'Vue d’ensemble',
    subtitle: 'Données clés de la boutique, des campagnes, de GA4 et de Search Console au même endroit.',
    syncing: 'Synchronisation des données en direct...',
    sourceLive: 'Live',
    sourceMissing: 'Missing metric',
    revenueCard: 'Revenus',
    totalRevenue: 'Revenu total',
    totalSpend: 'Dépenses publicitaires',
    netProfit: 'Bénéfice net',
    roas: 'ROAS',
    noFinanceData: 'Aucune donnée en direct de revenu ou de dépense pour la période sélectionnée.',
    goOrders: 'Aller à la liste des commandes',
    ga4Card: 'Statut du trafic du site (GA4)',
    activeNow: 'Actifs maintenant',
    totalUsers: 'Utilisateurs totaux',
    ga4Desc: 'Affiche le trafic en temps réel pour comprendre si les campagnes apportent des visiteurs.',
    noGa4: 'Aucune donnée GA4 en direct à afficher pour le moment.',
    latestOrdersCard: '5 dernières commandes',
    customerFallback: 'Client',
    noOrders: 'Aucune donnée de commande en direct à afficher pour le moment.',
    goOrdersShort: 'Aller aux commandes',
    campaignsCard: 'Statut des campagnes par plateforme',
    totalCampaigns: 'Total campagnes',
    activeCampaigns: 'Actives actuellement',
    totalCampaignSpend: 'Dépense totale',
    roasRos: 'ROAS / ROS',
    noCampaigns: 'Aucune donnée campagne en direct à afficher pour le moment.',
    goCampaigns: 'Aller aux campagnes',
    seoCard: 'SEO du site vs Search Console',
    siteSeo: 'SEO du site',
    scSeo: 'SEO Search Console',
    clicks: 'Clics',
    impressions: 'Impressions',
    ctr: 'CTR',
    avgPosition: 'Position moyenne',
    noSeo: 'Aucune donnée SEO en direct à afficher pour le moment.',
    goSeo: 'Aller au SEO',
    optimizationCard: 'Recommandations d’optimisation',
    noFreshRecs: 'Les données en direct sont partielles, pas de nouvelles recommandations.',
    noRecsData: 'Pas assez de données en direct pour générer des recommandations.',
    aiRecs: 'Recommandations AI',
    campaignOptimization: 'Optimisation des campagnes',
    recLowRoas: 'Augmenter le budget uniquement sur les campagnes avec de vraies conversions.',
    recSeoStructure: 'Renforcer le SEO des catégories et produits avec des H1 précis et des liens internes.',
    recMetaCtr: 'Améliorer les meta title et descriptions sur les pages à forte impression et faible CTR.',
    recFunnel: 'Analyser le checkout et l’entonnoir pour améliorer la conversion.',
    recPausedCampaigns: 'Réactiver seulement les campagnes en pause avec un CPA stable.',
  },
} as const;

export function Dashboard() {
  const { dir, language } = useLanguage();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections } = useConnections();
  const { format: formatCurrency } = useCurrency();
  const currentUser = auth.currentUser;
  const text = COPY[language] || COPY.en;
  const statusLabels = STATUS_LABELS[language] || STATUS_LABELS.en;

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
  const [hasGa4LiveSnapshot, setHasGa4LiveSnapshot] = useState(false);
  const [isOrdersUsingDemo, setIsOrdersUsingDemo] = useState(true);
  const [isCampaignsUsingDemo, setIsCampaignsUsingDemo] = useState(true);
  const [isGscUsingDemo, setIsGscUsingDemo] = useState(true);

  useEffect(() => {
    setFinancialAvailability({
      revenue: false,
      spend: false,
      netProfit: false,
      roas: false,
    });

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
      let ga4SnapshotLoaded = false;
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

      if (google?.status === 'connected') {
        const token = google.settings?.googleAccessToken || 'server-managed';
        try {
          const report = await fetchGA4Report(
            token,
            google.settings.ga4Id || undefined,
            startIsoDateOnly,
            endIsoDateOnly
          );
          const rows = Array.isArray(report.rows) ? report.rows : [];
          const metricHeaders = Array.isArray((report as any).metricHeaders)
            ? (report as any).metricHeaders
            : [];
          const metricIndexByName = metricHeaders.reduce<Record<string, number>>((acc, header, index) => {
            const name = String(header?.name || '').trim();
            if (name) acc[name] = index;
            return acc;
          }, {});
          const metricValueByName = (row: any, metricName: string, fallbackIndex: number) => {
            const metrics = row?.metricValues || row?.metrics || [];
            const namedIndex = metricIndexByName[metricName];
            const index =
              typeof namedIndex === 'number' && Number.isInteger(namedIndex)
                ? namedIndex
                : fallbackIndex;
            return metrics?.[index]?.value;
          };
          let totalUsers = 0;
          let activeNow = 0;
          rows.forEach((row: any) => {
            totalUsers += moneyFromUnknown(metricValueByName(row, 'totalUsers', 0));
          });
          if (rows.length) {
            activeNow = moneyFromUnknown(metricValueByName(rows[rows.length - 1], 'activeUsers', 0));
          }
          const totalsRow = Array.isArray((report as any).totals) ? (report as any).totals[0] : undefined;
          if (totalsRow) {
            totalUsers = moneyFromUnknown(metricValueByName(totalsRow, 'totalUsers', 0));
          }
          ga4Live = {
            activeNow: toNumber(activeNow, DEMO_GA4_STATS.activeNow),
            totalUsers: toNumber(totalUsers, DEMO_GA4_STATS.totalUsers),
          };
          hasGa4Live = true;
          ga4SnapshotLoaded = true;
        } catch (error) {
          console.warn('Failed to load GA4 stats', error);
        }

        try {
          const gsc = await fetchGSCData(
            token,
            google.settings.siteUrl || google.settings.gscSiteUrl || undefined,
            startIsoDateOnly,
            endIsoDateOnly
          );
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

        const googleCustomerId =
          google.settings.googleAdsId ||
          google.settings.customerId ||
          google.settings.googleCustomerId;
        try {
          const googleCampaigns = await fetchGoogleCampaigns(
            token,
            googleCustomerId || undefined,
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
            hasCampaignsLive = true;
          }
        } catch (error) {
          console.warn('Failed to load Google campaigns', error);
        }
      }

      const metaToken = meta?.status === 'connected' ? meta.settings?.metaToken || 'server-managed' : undefined;
      const metaAdsId =
        meta?.settings?.metaAdsId ||
        meta?.settings?.adAccountId ||
        meta?.settings?.metaAdAccountId;
      if (metaToken) {
        try {
          const metaCampaigns = await fetchMetaCampaigns(metaToken, metaAdsId || undefined);
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
          const message = error instanceof Error ? error.message : String(error);
          if (!isMetaRateLimitMessage(message)) {
            console.warn('Failed to load Meta campaigns', error);
          }
        }
      }

      const tiktokToken = tiktok?.settings?.tiktokToken || tiktok?.settings?.tiktokAccessToken;
      const tiktokAdvertiserId =
        tiktok?.settings?.tiktokAdvertiserId || tiktok?.settings?.advertiserId;
      if (tiktokToken && tiktokAdvertiserId) {
        try {
          const tiktokCampaigns = await fetchTikTokCampaigns(
            tiktokToken,
            tiktokAdvertiserId
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
        setHasGa4LiveSnapshot(ga4SnapshotLoaded);
      } else if (useDemoFallback) {
        setGa4Stats(DEMO_GA4_STATS);
        setIsGa4UsingDemo(true);
        setHasGa4LiveSnapshot(false);
      } else {
        setGa4Stats({ activeNow: 0, totalUsers: 0 });
        setIsGa4UsingDemo(false);
        setHasGa4LiveSnapshot(false);
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
  const hasGa4Data = isGa4UsingDemo || hasGa4LiveSnapshot;
  const hasGscData = isGscUsingDemo || safeGscStats.clicks > 0 || safeGscStats.impressions > 0;
  const hasOrdersData = isOrdersUsingDemo || recentOrders.length > 0;
  const hasCampaignData = isCampaignsUsingDemo || campaignSummary.totalCampaigns > 0;
  const ga4Availability = {
    activeNow: isGa4UsingDemo || hasGa4LiveSnapshot,
    totalUsers: isGa4UsingDemo || hasGa4LiveSnapshot,
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
  const ga4LiveAvailability = {
    activeNow: !isGa4UsingDemo && hasGa4LiveSnapshot,
    totalUsers: !isGa4UsingDemo && hasGa4LiveSnapshot,
  };
  const campaignLiveAvailability = {
    totalCampaigns: !isCampaignsUsingDemo && campaignAvailability.totalCampaigns,
    activeCampaigns: !isCampaignsUsingDemo && campaignAvailability.activeCampaigns,
    spend: !isCampaignsUsingDemo && campaignAvailability.spend,
    roas: !isCampaignsUsingDemo && campaignAvailability.roas,
  };
  const seoLiveAvailability = {
    siteScore: !isGa4UsingDemo && seoAvailability.siteScore,
    searchConsoleScore: !isGscUsingDemo && seoAvailability.searchConsoleScore,
    clicks: !isGscUsingDemo && seoAvailability.clicks,
    impressions: !isGscUsingDemo && seoAvailability.impressions,
    ctr: !isGscUsingDemo && seoAvailability.ctr,
    avgPosition: !isGscUsingDemo && seoAvailability.avgPosition,
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
      recommendations.push(text.recLowRoas);
    }
    if (hasGscData && safeGscStats.avgPosition > 12) {
      recommendations.push(text.recSeoStructure);
    }
    if (hasGscData && safeGscStats.ctr < 2.5) {
      recommendations.push(text.recMetaCtr);
    }
    if (hasGa4Data && hasOrdersData && safeGa4Stats.activeNow > 0 && recentOrders.length < 3) {
      recommendations.push(text.recFunnel);
    }
    if (hasCampaignData && campaignSummary.activeCampaigns < campaignSummary.totalCampaigns) {
      recommendations.push(text.recPausedCampaigns);
    }

    return recommendations.slice(0, 5);
  }, [campaignSummary.activeCampaigns, campaignSummary.totalCampaigns, financialAvailability.roas, hasCampaignData, hasGa4Data, hasGscData, hasOrdersData, recentOrders.length, safeGa4Stats.activeNow, safeGscStats.avgPosition, safeGscStats.ctr, safeRoas, text]);
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
  const SourceTag = ({ live }: { live: boolean }) => (
    <span
      className={cn(
        'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
        live
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-gray-600 bg-gray-100 border-gray-200'
      )}
    >
      {live ? text.sourceLive : text.sourceMissing}
    </span>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="ui-display text-2xl sm:text-3xl text-gray-900 dark:text-white">
            {text.title}, {currentUser?.displayName?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="ui-subtitle text-gray-500 dark:text-gray-400 mt-1">
            {text.subtitle}
          </p>
        </div>
        {isLoadingOverview && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {text.syncing}
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
              <h2 className="font-bold text-gray-900 dark:text-white">{text.revenueCard}</h2>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.totalRevenue}
                <SourceTag live={financialAvailability.revenue} />
              </span>
              <span className="font-extrabold text-emerald-700">
                {financialAvailability.revenue ? formatCurrency(safeTotalRevenue) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.totalSpend}
                <SourceTag live={financialAvailability.spend} />
              </span>
              <span className="font-bold text-red-600">
                {financialAvailability.spend ? formatCurrency(safeTotalSpend) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.netProfit}
                <SourceTag live={financialAvailability.netProfit} />
              </span>
              <span className="font-bold text-indigo-600">
                {financialAvailability.netProfit ? formatCurrency(safeNetProfit) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.roas}
                <SourceTag live={financialAvailability.roas} />
              </span>
              <span className="font-black text-gray-900 dark:text-white">
                {financialAvailability.roas ? `${safeRoas}x` : '—'}
              </span>
            </div>
            {!financialAvailability.revenue && !financialAvailability.spend && (
              <p className="text-xs text-gray-500">{text.noFinanceData}</p>
            )}
          </div>

          <button
            onClick={() => goToPath('/orders')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            {text.goOrders}
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">{text.ga4Card}</h2>
            </div>
            <DemoTag show={isGa4UsingDemo} />
          </div>

          {hasGa4Data ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <p className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1.5">
                    {text.activeNow}
                    <SourceTag live={ga4LiveAvailability.activeNow} />
                  </p>
                  <p className="text-3xl font-black text-blue-600 mt-1">
                    {ga4Availability.activeNow ? safeGa4Stats.activeNow : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                  <p className="text-[11px] font-semibold text-indigo-700 inline-flex items-center gap-1.5">
                    {text.totalUsers}
                    <SourceTag live={ga4LiveAvailability.totalUsers} />
                  </p>
                  <p className="text-3xl font-black text-indigo-600 mt-1">
                    {ga4Availability.totalUsers ? safeGa4Stats.totalUsers.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {text.ga4Desc}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              {text.noGa4}
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">{text.latestOrdersCard}</h2>
            </div>
            <DemoTag show={isOrdersUsingDemo} />
          </div>

          <div className="space-y-2">
            {recentOrders.length ? (
              recentOrders.slice(0, 5).map((order) => {
                const customerName =
                  `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() || text.customerFallback;
                return (
                  <div key={order.id} className="rounded-xl border border-gray-200 p-2.5 bg-gray-50/60">
                    <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <p className="text-xs font-bold text-gray-900">#{order.number}</p>
                        <SourceTag live={!isOrdersUsingDemo} />
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold',
                            orderStatusBadgeClass(order.status)
                          )}
                        >
                          {statusLabels[(order.status || '').toLowerCase() as keyof typeof statusLabels] || orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500">{formatDate(order.date_created)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-gray-700 truncate">{customerName}</p>
                      <p className="text-xs font-extrabold text-indigo-700">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500">{text.noOrders}</p>
            )}
          </div>

          <button
            onClick={() => goToPath('/orders')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            {text.goOrdersShort}
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">{text.campaignsCard}</h2>
            </div>
            <DemoTag show={isCampaignsUsingDemo} />
          </div>

          {hasCampaignData || campaignAvailability.spend || campaignAvailability.roas ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                    {text.totalCampaigns}
                    <SourceTag live={campaignLiveAvailability.totalCampaigns} />
                  </p>
                  <p className="text-xl font-black text-gray-900">
                    {campaignAvailability.totalCampaigns ? campaignSummary.totalCampaigns : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                    {text.activeCampaigns}
                    <SourceTag live={campaignLiveAvailability.activeCampaigns} />
                  </p>
                  <p className="text-xl font-black text-emerald-600">
                    {campaignAvailability.activeCampaigns ? campaignSummary.activeCampaigns : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                    {text.totalCampaignSpend}
                    <SourceTag live={campaignLiveAvailability.spend} />
                  </p>
                  <p className="text-xl font-black text-red-600">
                    {campaignAvailability.spend ? formatCurrency(campaignSummary.totalSpend) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                    {text.roasRos}
                    <SourceTag live={campaignLiveAvailability.roas} />
                  </p>
                  <p className="text-xl font-black text-indigo-600">
                    {campaignAvailability.roas ? `${campaignSummary.avgRoas.toFixed(2)}x` : '—'}
                  </p>
                </div>
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
            <p className="text-xs text-gray-500">{text.noCampaigns}</p>
          )}

          <button
            onClick={() => goToPath('/campaigns')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            {text.goCampaigns}
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">{text.seoCard}</h2>
            </div>
            <DemoTag show={isGscUsingDemo} />
          </div>

          {seoAvailability.siteScore || seoAvailability.searchConsoleScore || seoAvailability.clicks ? (
            <>
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 inline-flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> {text.siteSeo}
                      <SourceTag live={seoLiveAvailability.siteScore} />
                    </span>
                    <span className="font-black text-gray-900">
                      {seoAvailability.siteScore ? `${siteSeoScore}/100` : '—'}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${seoAvailability.siteScore ? Math.min(siteSeoScore, 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 inline-flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" /> {text.scSeo}
                      <SourceTag live={seoLiveAvailability.searchConsoleScore} />
                    </span>
                    <span className="font-black text-gray-900">
                      {seoAvailability.searchConsoleScore ? `${searchConsoleSeoScore}/100` : '—'}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${seoAvailability.searchConsoleScore ? Math.min(searchConsoleSeoScore, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                  <p className="text-gray-500 inline-flex items-center gap-1.5">
                    {text.clicks}
                    <SourceTag live={seoLiveAvailability.clicks} />
                  </p>
                  <p className="font-bold text-gray-900">
                    {seoAvailability.clicks ? safeGscStats.clicks.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                  <p className="text-gray-500 inline-flex items-center gap-1.5">
                    {text.impressions}
                    <SourceTag live={seoLiveAvailability.impressions} />
                  </p>
                  <p className="font-bold text-gray-900">
                    {seoAvailability.impressions ? safeGscStats.impressions.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                  <p className="text-gray-500 inline-flex items-center gap-1.5">
                    {text.ctr}
                    <SourceTag live={seoLiveAvailability.ctr} />
                  </p>
                  <p className="font-bold text-gray-900">
                    {seoAvailability.ctr ? `${safeGscStats.ctr.toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                  <p className="text-gray-500 inline-flex items-center gap-1.5">
                    {text.avgPosition}
                    <SourceTag live={seoLiveAvailability.avgPosition} />
                  </p>
                  <p className="font-bold text-gray-900">
                    {seoAvailability.avgPosition ? `#${safeGscStats.avgPosition.toFixed(1)}` : '—'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">{text.noSeo}</p>
          )}

          <button
            onClick={() => goToPath('/seo')}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
          >
            {text.goSeo}
            <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
          </button>
        </div>

        <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">{text.optimizationCard}</h2>
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
              <p className="text-xs text-gray-500">{text.noFreshRecs}</p>
            ) : (
              <p className="text-xs text-gray-500">{text.noRecsData}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => goToPath('/ai-recommendations')}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
            >
              {text.aiRecs}
              <ArrowRight className={cn('w-3.5 h-3.5', dir === 'rtl' ? 'rotate-180' : '')} />
            </button>
            <button
              onClick={() => goToPath('/campaigns')}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl py-2"
            >
              {text.campaignOptimization}
              <Target className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

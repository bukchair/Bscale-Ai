import React, { useEffect, useMemo, useState } from 'react';
import { getOptimizationRecommendations, getAIKeysFromConnections, hasAnyAIKey } from '../lib/gemini';
import { CheckCircle2, AlertCircle, Loader2, Zap, Mail, Target, ImagePlus, Trash2, Clock3, CalendarClock, PlusCircle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import { fetchMetaCampaigns, isMetaRateLimitMessage } from '../services/metaService';
import { fetchGoogleCampaigns, sendGmailNotification } from '../services/googleService';
import { auth } from '../lib/firebase';

const mockCampaignData = [
  { id: 1, name: 'Summer Sale - Shoes', platform: 'Google', status: 'Active', spend: 1200, roas: 2.5, cpa: 45 },
  { id: 2, name: 'Retargeting - Abandoned Cart', platform: 'Meta', status: 'Active', spend: 800, roas: 4.2, cpa: 22 },
  { id: 3, name: 'New Collection - Video', platform: 'TikTok', status: 'Paused', spend: 400, roas: 1.1, cpa: 85 },
  { id: 4, name: 'Brand Search', platform: 'Google', status: 'Active', spend: 300, roas: 8.5, cpa: 12 },
];

type ContentType = 'product' | 'offer' | 'educational' | 'testimonial' | 'video';
type ProductType = 'fashion' | 'beauty' | 'tech' | 'home' | 'fitness' | 'services' | 'other';
type ObjectiveType = 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
type SlotKey = 'morning' | 'afternoon' | 'evening' | 'night';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type RuleAction = 'boost' | 'limit' | 'pause';

type UploadedAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  file: File;
};

type TimeRule = {
  id: string;
  platform: string;
  slot: SlotKey;
  action: RuleAction;
  minRoas: number;
};

type DaySchedule = Record<DayKey, Record<SlotKey, boolean>>;
type WeeklySchedule = Record<string, DaySchedule>;

const PLATFORM_CONNECTION_MAP: Record<string, string> = {
  Google: 'google',
  Meta: 'meta',
  TikTok: 'tiktok',
};

const SLOT_RANGES: Record<SlotKey, string> = {
  morning: '06:00-11:00',
  afternoon: '11:00-16:00',
  evening: '16:00-21:00',
  night: '21:00-01:00',
};

const BEST_TIME_WINDOWS: Record<string, { slot: SlotKey; roas: number; cpa: number }[]> = {
  Google: [
    { slot: 'evening', roas: 4.2, cpa: 28 },
    { slot: 'afternoon', roas: 3.6, cpa: 34 },
  ],
  Meta: [
    { slot: 'night', roas: 4.1, cpa: 26 },
    { slot: 'evening', roas: 3.7, cpa: 29 },
  ],
  TikTok: [
    { slot: 'evening', roas: 3.4, cpa: 31 },
    { slot: 'night', roas: 3.2, cpa: 33 },
  ],
};

const SMART_AUDIENCE_BY_CONTENT: Record<ContentType, string[]> = {
  product: ['Product viewers 30d', 'Cart abandoners 14d', 'Lookalike 1% - Purchasers'],
  offer: ['Price sensitive shoppers', 'Promo clickers 30d', 'Coupon users'],
  educational: ['Blog readers 60d', 'Video viewers 75%', 'Top funnel warm audience'],
  testimonial: ['Consideration audience', 'Review seekers', 'Competitor audience'],
  video: ['Short video engagers', 'Watch time > 15s', 'Reels/TikTok engagers'],
};

const SMART_AUDIENCE_BY_PRODUCT: Record<ProductType, string[]> = {
  fashion: ['Fashion interest', 'Streetwear audience', 'Seasonal shoppers'],
  beauty: ['Beauty products interest', 'Skincare enthusiasts', 'Self care audience'],
  tech: ['Tech enthusiasts', 'Gadget buyers', 'Early adopters'],
  home: ['Home improvement', 'Interior design audience', 'Family buyers'],
  fitness: ['Fitness audience', 'Running & sports', 'Healthy lifestyle'],
  services: ['High intent leads', 'Local business services', 'Consultation seekers'],
  other: ['Broad prospecting', 'Engaged audience 30d'],
};

const SMART_AUDIENCE_BY_OBJECTIVE: Record<ObjectiveType, string[]> = {
  sales: ['High intent purchasers', 'Returning buyers', 'Upsell audience'],
  traffic: ['Click propensity audience', 'Content consumers'],
  leads: ['Lead forms engagers', 'WhatsApp clickers', 'Contact page visitors'],
  awareness: ['Broad awareness 18-44', 'Reach optimized audience'],
  retargeting: ['Site visitors 30d', 'Product viewers 14d', 'Initiated checkout 14d'],
};

const createEmptyDaySchedule = (): DaySchedule => ({
  mon: { morning: false, afternoon: false, evening: false, night: false },
  tue: { morning: false, afternoon: false, evening: false, night: false },
  wed: { morning: false, afternoon: false, evening: false, night: false },
  thu: { morning: false, afternoon: false, evening: false, night: false },
  fri: { morning: false, afternoon: false, evening: false, night: false },
  sat: { morning: false, afternoon: false, evening: false, night: false },
  sun: { morning: false, afternoon: false, evening: false, night: false },
});

export function Campaigns() {
  const { t, dir, language } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { connections } = useConnections();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const isHebrew = language === 'he';

  const text = {
    builderTitle: isHebrew ? 'יוצר קמפיינים אינטראקטיבי' : 'Interactive campaign builder',
    builderSubtitle: isHebrew
      ? 'יצירת מודעות עם קהלים חכמים, העלאת תמונות אמיתית, חוקי זמן ולוח תזמון שבועי לכל פלטפורמה.'
      : 'Create campaigns with smart audiences, real image upload, time targeting rules, and weekly scheduling.',
    campaignName: isHebrew ? 'שם קמפיין' : 'Campaign name',
    objective: isHebrew ? 'מטרת קמפיין' : 'Campaign objective',
    contentType: isHebrew ? 'אופי פוסט/תוכן' : 'Post/Product content type',
    productType: isHebrew ? 'סוג מוצר/שירות' : 'Product/service type',
    description: isHebrew ? 'תיאור קצר לפוסט או מוצר' : 'Short post/product brief',
    selectPlatforms: isHebrew ? 'בחירת פלטפורמות מחוברות' : 'Select connected platforms',
    noConnectedPlatforms: isHebrew ? 'אין פלטפורמות פרסום מחוברות כרגע.' : 'No advertising platforms are currently connected.',
    smartAudienceTitle: isHebrew ? 'רשימת קהלים חכמה מטורגטת' : 'Smart targeted audience list',
    smartAudienceSubtitle: isHebrew
      ? 'המלצות אוטומטיות לפי אופי התוכן, סוג המוצר ומטרת הקמפיין.'
      : 'Auto recommendations by content nature, product type, and campaign objective.',
    addCustomAudience: isHebrew ? 'הוסף קהל ידני' : 'Add custom audience',
    uploadTitle: isHebrew ? 'העלאת תמונות למודעות (אמיתי)' : 'Upload ad images (real upload)',
    uploadHint: isHebrew
      ? 'התמונות מועלות מהמחשב שלך ומוכנות לפרסום בפלטפורמות המחוברות.'
      : 'Images are uploaded from your device and prepared for connected platforms.',
    uploadButton: isHebrew ? 'בחר תמונות' : 'Choose images',
    timingRulesTitle: isHebrew ? 'חוקי טירגוט לפי שעות ביצועים' : 'Performance based time targeting rules',
    weeklyTitle: isHebrew ? 'לוח זמנים שבועי לקמפיינים' : 'Weekly campaign schedule board',
    createDraft: isHebrew ? 'צור קמפיין מתוזמן' : 'Create scheduled campaign',
    publishedOk: isHebrew ? 'הקמפיינים נוצרו בהצלחה ברשימת הניהול.' : 'Campaign drafts were created successfully in management list.',
    requireFields: isHebrew ? 'נדרש שם קמפיין ובחירת לפחות פלטפורמה אחת.' : 'Campaign name and at least one platform are required.',
    requireAsset: isHebrew ? 'יש להעלות לפחות תמונה אחת כדי ליצור מודעה.' : 'Upload at least one image to create ad campaigns.',
    connectedOnly: isHebrew ? 'זמין רק בפלטפורמות מחוברות' : 'Available only for connected platforms',
    bestWindows: isHebrew ? 'חלונות הזמן עם ביצועים טובים' : 'Best performing time windows',
    addRule: isHebrew ? 'הוסף חוק' : 'Add rule',
    weeklyActiveSlots: isHebrew ? 'משבצות פעילות' : 'Active slots',
    createdCampaigns: isHebrew ? 'קמפיינים פעילים ומתוזמנים' : 'Active and scheduled campaigns',
    syncLive: isHebrew ? 'מסנכרן נתונים בזמן אמת...' : 'Syncing real-time data...',
  };

  const periodLabel = dateRange === 'today' ? t('dashboard.today') : dateRange === '7days' ? t('dashboard.last7Days') : dateRange === '30days' ? t('dashboard.last30Days') : t('dashboard.customRange');
  const startDateIso = useMemo(() => bounds.startDate.toISOString().slice(0, 10), [bounds.startDate]);
  const endDateIso = useMemo(() => bounds.endDate.toISOString().slice(0, 10), [bounds.endDate]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<number[]>([]);
  const [expandedRecs, setExpandedRecs] = useState<number[]>([]);
  const [realCampaigns, setRealCampaigns] = useState<any[]>([]);
  const CAMPAIGNS_CACHE_KEY = 'bscale:campaigns:realCampaigns:v1';

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { items?: any[] };
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setRealCampaigns(parsed.items);
      }
    } catch {
      // ignore cache parse errors
    }
  }, []);

  useEffect(() => {
    try {
      if (realCampaigns.length > 0) {
        window.localStorage.setItem(
          CAMPAIGNS_CACHE_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            items: realCampaigns,
          })
        );
      }
    } catch {
      // ignore storage quota errors
    }
  }, [realCampaigns]);

  const [createdCampaigns, setCreatedCampaigns] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);
  const [metaSyncNotice, setMetaSyncNotice] = useState<string | null>(null);

  // Filtering and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Interactive campaign builder state
  const [campaignNameInput, setCampaignNameInput] = useState('');
  const [objective, setObjective] = useState<ObjectiveType>('sales');
  const [contentType, setContentType] = useState<ContentType>('product');
  const [productType, setProductType] = useState<ProductType>('other');
  const [campaignBrief, setCampaignBrief] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState('');
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [selectedSchedulePlatform, setSelectedSchedulePlatform] = useState<string>('Google');
  const [timeRules, setTimeRules] = useState<TimeRule[]>([]);
  const [rulePlatform, setRulePlatform] = useState<string>('Google');
  const [ruleSlot, setRuleSlot] = useState<SlotKey>('evening');
  const [ruleAction, setRuleAction] = useState<RuleAction>('boost');
  const [ruleMinRoas, setRuleMinRoas] = useState<number>(3);

  const connectedAdPlatforms = useMemo(() => {
    const options: string[] = [];
    if (connections.find((c) => c.id === 'google' && c.status === 'connected')) options.push('Google');
    if (connections.find((c) => c.id === 'meta' && c.status === 'connected')) options.push('Meta');
    if (connections.find((c) => c.id === 'tiktok' && c.status === 'connected')) options.push('TikTok');
    return options;
  }, [connections]);

  const objectiveOptions: Array<{ value: ObjectiveType; label: string }> = [
    { value: 'sales', label: isHebrew ? 'מכירות' : 'Sales' },
    { value: 'traffic', label: isHebrew ? 'תנועה לאתר' : 'Traffic' },
    { value: 'leads', label: isHebrew ? 'לידים' : 'Leads' },
    { value: 'awareness', label: isHebrew ? 'מודעות למותג' : 'Awareness' },
    { value: 'retargeting', label: isHebrew ? 'רימרקטינג' : 'Retargeting' },
  ];

  const contentTypeOptions: Array<{ value: ContentType; label: string }> = [
    { value: 'product', label: isHebrew ? 'פוסט מוצר' : 'Product post' },
    { value: 'offer', label: isHebrew ? 'פוסט מבצע' : 'Offer post' },
    { value: 'educational', label: isHebrew ? 'פוסט מידע/ערך' : 'Educational post' },
    { value: 'testimonial', label: isHebrew ? 'פוסט המלצה/עדות' : 'Testimonial post' },
    { value: 'video', label: isHebrew ? 'פוסט וידאו קצר' : 'Short video post' },
  ];

  const productTypeOptions: Array<{ value: ProductType; label: string }> = [
    { value: 'fashion', label: isHebrew ? 'אופנה' : 'Fashion' },
    { value: 'beauty', label: isHebrew ? 'ביוטי וטיפוח' : 'Beauty' },
    { value: 'tech', label: isHebrew ? 'טכנולוגיה' : 'Tech' },
    { value: 'home', label: isHebrew ? 'בית ועיצוב' : 'Home' },
    { value: 'fitness', label: isHebrew ? 'כושר וספורט' : 'Fitness' },
    { value: 'services', label: isHebrew ? 'שירותים' : 'Services' },
    { value: 'other', label: isHebrew ? 'אחר' : 'Other' },
  ];

  const slotLabels: Record<SlotKey, string> = {
    morning: isHebrew ? 'בוקר' : 'Morning',
    afternoon: isHebrew ? 'צהריים' : 'Afternoon',
    evening: isHebrew ? 'ערב' : 'Evening',
    night: isHebrew ? 'לילה' : 'Night',
  };

  const dayLabels: Record<DayKey, string> = {
    mon: isHebrew ? 'שני' : 'Mon',
    tue: isHebrew ? 'שלישי' : 'Tue',
    wed: isHebrew ? 'רביעי' : 'Wed',
    thu: isHebrew ? 'חמישי' : 'Thu',
    fri: isHebrew ? 'שישי' : 'Fri',
    sat: isHebrew ? 'שבת' : 'Sat',
    sun: isHebrew ? 'ראשון' : 'Sun',
  };

  const audienceSuggestions = useMemo(() => {
    const combined = [
      ...SMART_AUDIENCE_BY_CONTENT[contentType],
      ...SMART_AUDIENCE_BY_PRODUCT[productType],
      ...SMART_AUDIENCE_BY_OBJECTIVE[objective],
    ];
    return [...new Set(combined)];
  }, [contentType, productType, objective]);

  useEffect(() => {
    if (connectedAdPlatforms.length === 0) {
      setSelectedPlatforms([]);
      return;
    }
    setSelectedPlatforms((prev) => {
      const filtered = prev.filter((p) => connectedAdPlatforms.includes(p));
      return filtered.length ? filtered : [connectedAdPlatforms[0]];
    });
    setSelectedSchedulePlatform((prev) => (connectedAdPlatforms.includes(prev) ? prev : connectedAdPlatforms[0]));
    setRulePlatform((prev) => (connectedAdPlatforms.includes(prev) ? prev : connectedAdPlatforms[0]));
  }, [connectedAdPlatforms]);

  useEffect(() => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      selectedPlatforms.forEach((platform) => {
        if (!next[platform]) next[platform] = createEmptyDaySchedule();
      });
      Object.keys(next).forEach((platform) => {
        if (!selectedPlatforms.includes(platform)) delete next[platform];
      });
      return next;
    });
  }, [selectedPlatforms]);

  useEffect(() => {
    return () => {
      uploadedAssets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    };
  }, [uploadedAssets]);
  const toAmount = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const normalizeCampaignStatus = (value: unknown): string => {
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

  const getStatusBadgeClass = (status: string) => {
    if (status === 'Active') return 'bg-green-100 text-green-800';
    if (status === 'Scheduled' || status === 'Pending') return 'bg-indigo-100 text-indigo-800';
    if (status === 'Draft') return 'bg-slate-100 text-slate-700';
    if (status === 'Paused') return 'bg-yellow-100 text-yellow-800';
    if (status === 'Removed') return 'bg-rose-100 text-rose-800';
    if (status === 'Error') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  const formatPercent = (value: unknown, fractionDigits = 2) => {
    const numeric = toAmount(value);
    return `${numeric.toFixed(fractionDigits)}%`;
  };

  const hasMetaMetrics = (campaign: any) => {
    const keys = ['spend', 'impressions', 'clicks', 'conversions', 'conversionValue', 'ctr', 'cpc', 'cpm', 'reach', 'frequency'];
    return keys.some((key) => toAmount(campaign?.[key]) > 0);
  };

  const hasGoogleMetrics = (campaign: any) => {
    const keys = ['spend', 'impressions', 'clicks', 'conversions', 'conversionValue', 'ctr', 'cpc', 'cpm', 'costPerConversion'];
    return keys.some((key) => toAmount(campaign?.[key]) > 0);
  };

  const mergePlatformCampaignsPreferRich = (
    existingRows: any[],
    incomingRows: any[],
    hasMetrics: (row: any) => boolean
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

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const aiKeys = getAIKeysFromConnections(connections);
      if (!hasAnyAIKey(aiKeys)) {
        setRecommendations([]);
        setExpandedRecs([]);
      } else {
        const dataToAnalyze = realCampaigns.length > 0 ? realCampaigns : mockCampaignData;
        const dataStr = JSON.stringify(dataToAnalyze);
        const recommendationLanguage =
          language === 'he'
            ? 'Hebrew'
            : language === 'ru'
              ? 'Russian'
              : language === 'pt'
                ? 'Portuguese'
                : language === 'fr'
                  ? 'French'
                  : 'English';
        const res = await getOptimizationRecommendations(dataStr, aiKeys, recommendationLanguage);
        const normalized = Array.isArray(res?.recommendations)
          ? res.recommendations.filter(Boolean)
          : [];
        setRecommendations(normalized);
        setExpandedRecs([]);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
    } finally {
      setLoading(false);
    }
  };

  const syncTikTokData = async () => {
    const tiktokConn = connections.find(c => c.id === 'tiktok');
    const token = tiktokConn?.settings?.tiktokToken || tiktokConn?.settings?.tiktokAccessToken;
    const advertiserId = tiktokConn?.settings?.tiktokAdvertiserId || tiktokConn?.settings?.advertiserId;
    if (tiktokConn?.status === 'connected' && token && advertiserId) {
      try {
        const campaigns = await fetchTikTokCampaigns(
          token,
          advertiserId,
          startDateIso,
          endDateIso
        );

        setRealCampaigns(prev => [...prev.filter(c => c.platform !== 'TikTok'), ...campaigns]);
      } catch (err) {
        console.error("Failed to sync TikTok data:", err);
      }
    }
  };

  const syncMetaData = async () => {
    const metaConn = connections.find(c => c.id === 'meta');
    const token = metaConn?.status === 'connected' ? metaConn?.settings?.metaToken || 'server-managed' : '';
    const adAccountId =
      metaConn?.settings?.metaAdsId ||
      metaConn?.settings?.adAccountId ||
      metaConn?.settings?.metaAdAccountId;
    if (metaConn?.status === 'connected' && token) {
      try {
        const campaigns = await fetchMetaCampaigns(
          token,
          adAccountId || undefined,
          startDateIso,
          endDateIso
        );

        setRealCampaigns(prev => {
          const existingMeta = prev.filter(c => c.platform === 'Meta');
          if (campaigns.length === 0 && existingMeta.length > 0) {
            return prev;
          }
          const mergedMeta = mergePlatformCampaignsPreferRich(existingMeta, campaigns, hasMetaMetrics);
          return [...prev.filter(c => c.platform !== 'Meta'), ...mergedMeta];
        });
        setMetaSyncNotice(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMetaRateLimitMessage(message)) {
          setMetaSyncNotice(
            isHebrew
              ? 'מטא מגביל כרגע קריאות API. מוצגים נתונים אחרונים זמינים.'
              : 'Meta is currently rate-limiting API calls. Showing the latest available data.'
          );
        } else {
          console.error("Failed to sync Meta data:", err);
        }
      }
    }
  };

  const syncGoogleData = async () => {
    const googleConn = connections.find(c => c.id === 'google');
    const token = googleConn?.status === 'connected' ? googleConn?.settings?.googleAccessToken || 'server-managed' : '';
    const customerId =
      googleConn?.settings?.googleAdsId ||
      googleConn?.settings?.customerId ||
      googleConn?.settings?.googleCustomerId;
    const loginCustomerId = googleConn?.settings?.loginCustomerId;
    if (googleConn?.status === 'connected' && token) {
      try {
        const campaigns = await fetchGoogleCampaigns(
          token,
          customerId || undefined,
          loginCustomerId,
          startDateIso,
          endDateIso
        );

        setRealCampaigns(prev => {
          const existingGoogle = prev.filter(c => c.platform === 'Google');
          if (campaigns.length === 0 && existingGoogle.length > 0) {
            return prev;
          }
          const mergedGoogle = mergePlatformCampaignsPreferRich(existingGoogle, campaigns, hasGoogleMetrics);
          return [...prev.filter(c => c.platform !== 'Google'), ...mergedGoogle];
        });
      } catch (err) {
        console.error("Failed to sync Google data:", err);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    let lastSyncAt = 0;
    const syncAll = async () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastSyncAt < 60_000) return;
      lastSyncAt = now;
      setIsSyncing(true);
      try {
        await Promise.all([syncTikTokData(), syncMetaData(), syncGoogleData()]);
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void syncAll();

    const intervalId = window.setInterval(() => {
      void syncAll();
    }, 120_000);

    const handleFocus = () => {
      void syncAll();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [connections, startDateIso, endDateIso]);

  const handleApply = (index: number) => {
    setAppliedRecs([...appliedRecs, index]);
  };

  const toggleRecExpanded = (index: number) => {
    setExpandedRecs((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const handleSendEmail = async () => {
    const googleConn = connections.find(c => c.id === 'google');
    if (!googleConn?.settings?.googleAccessToken) {
      alert("Please connect Google Workspace first to send emails.");
      return;
    }

    setSendingEmail(true);
    try {
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;">
          <h2 style="color: #4f46e5;">BScale AI: Optimization Recommendations</h2>
          <p>Here are the latest AI-generated recommendations for your advertising campaigns:</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          ${recommendations.map(rec => `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; background-color: ${rec.impact === 'High' ? '#fee2e2' : rec.impact === 'Medium' ? '#fef3c7' : '#dcfce7'}; color: ${rec.impact === 'High' ? '#991b1b' : rec.impact === 'Medium' ? '#92400e' : '#166534'}; margin-right: 8px;">
                  IMPACT: ${rec.impact}
                </span>
                <span style="font-size: 12px; color: #6b7280;">${rec.platform}</span>
              </div>
              <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">${rec.title}</h3>
              <p style="margin: 0; font-size: 14px; color: #4b5563;">${rec.description}</p>
            </div>
          `).join('')}
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
            Sent from BScale AI Dashboard.
          </p>
        </div>
      `;
      
      await sendGmailNotification(
        googleConn.settings.googleAccessToken,
        auth.currentUser?.email || '',
        'BScale AI: Your Campaign Recommendations',
        emailBody
      );
      alert("Recommendations sent to your email!");
    } catch (err) {
      console.error("Failed to send email:", err);
      alert("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  const togglePlatformSelection = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const toggleAudienceSelection = (audience: string) => {
    setSelectedAudiences((prev) =>
      prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience]
    );
  };

  const addCustomAudience = () => {
    const value = customAudience.trim();
    if (!value) return;
    if (!selectedAudiences.includes(value)) {
      setSelectedAudiences((prev) => [...prev, value]);
    }
    setCustomAudience('');
  };

  const handleAssetUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = Array.from(event.target.files || []) as File[];
    if (!files.length) return;
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const mapped: UploadedAsset[] = imageFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setUploadedAssets((prev) => [...prev, ...mapped].slice(0, 12));
    event.target.value = '';
  };

  const removeAsset = (id: string) => {
    setUploadedAssets((prev) => {
      const target = prev.find((asset) => asset.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((asset) => asset.id !== id);
    });
  };

  const toggleScheduleCell = (platform: string, day: DayKey, slot: SlotKey) => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      if (!next[platform]) next[platform] = createEmptyDaySchedule();
      next[platform] = {
        ...next[platform],
        [day]: {
          ...next[platform][day],
          [slot]: !next[platform][day][slot],
        },
      };
      return next;
    });
  };

  const getActiveSlotsCount = (platform: string): number => {
    const schedule = weeklySchedule[platform];
    if (!schedule) return 0;
    return (Object.keys(schedule) as DayKey[]).reduce((sum, day) => {
      const dayCount = (Object.keys(schedule[day]) as SlotKey[]).filter((slot) => schedule[day][slot]).length;
      return sum + dayCount;
    }, 0);
  };

  const addTimeRule = () => {
    if (!rulePlatform) return;
    const next: TimeRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: rulePlatform,
      slot: ruleSlot,
      action: ruleAction,
      minRoas: ruleMinRoas,
    };
    setTimeRules((prev) => [next, ...prev]);
  };

  const removeTimeRule = (id: string) => {
    setTimeRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleCreateScheduledCampaign = () => {
    setBuilderMessage(null);
    if (!campaignNameInput.trim() || selectedPlatforms.length === 0) {
      setBuilderMessage(text.requireFields);
      return;
    }
    if (uploadedAssets.length === 0) {
      setBuilderMessage(text.requireAsset);
      return;
    }

    const created = selectedPlatforms.map((platform) => {
      const activeSlots = getActiveSlotsCount(platform);
      return {
        id: `local-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: campaignNameInput.trim(),
        platform,
        status: activeSlots > 0 ? 'Scheduled' : 'Draft',
        spend: 0,
        roas: 0,
        cpa: 0,
        objective,
        brief: campaignBrief.trim(),
        audiences: selectedAudiences,
        mediaCount: uploadedAssets.length,
      };
    });

    setCreatedCampaigns((prev) => [...created, ...prev]);
    setBuilderMessage(text.publishedOk);
    setCampaignNameInput('');
    setCampaignBrief('');
    setSelectedAudiences([]);
    setTimeRules([]);
    setUploadedAssets((prev) => {
      prev.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
      return [];
    });
  };

  const hasConnectedAdPlatform = Boolean(
    connections.find(
      (c) =>
        (c.id === 'google' || c.id === 'meta' || c.id === 'tiktok') &&
        c.status === 'connected'
    )
  );

  const allCampaigns = [
    ...createdCampaigns,
    ...(realCampaigns.length > 0
      ? realCampaigns
      : hasConnectedAdPlatform
      ? []
      : mockCampaignData),
  ];

  const filteredAndSortedCampaigns = allCampaigns
    .filter(campaign => {
      const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = platformFilter === 'All' || campaign.platform === platformFilter;
      const matchesStatus =
        statusFilter === 'All' || normalizeCampaignStatus(campaign.status) === statusFilter;
      return matchesSearch && matchesPlatform && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      if (sortField === 'spend' || sortField === 'cpa' || sortField === 'roas') {
        valA = toAmount(valA);
        valB = toAmount(valB);
      } else if (sortField === 'status') {
        valA = normalizeCampaignStatus(a.status).toLowerCase();
        valB = normalizeCampaignStatus(b.status).toLowerCase();
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const platforms = ['All', ...new Set(allCampaigns.map(c => c.platform))];
  const statuses = ['All', ...new Set(allCampaigns.map(c => normalizeCampaignStatus(c.status)))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('campaigns.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(language === 'he' ? 'נתונים לפי תקופה:' : 'Data for period:')}{' '}
            <span className="font-bold text-indigo-600">{periodLabel}</span>
          </p>
        </div>
        <button 
          onClick={fetchRecommendations}
          disabled={loading}
          className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Zap className="w-4 h-4 ml-2" />}
          {t('campaigns.refreshAi')}
        </button>
      </div>

      <section className="bg-white shadow rounded-lg overflow-hidden flex flex-col border border-gray-200">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {text.createdCampaigns} {isHebrew ? 'לפי פלטפורמה' : 'by platform'}
            </h3>
            {isSyncing && (
              <span className="flex items-center text-xs text-indigo-600 font-bold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin ml-1" />
                {text.syncLive}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder={t('campaigns.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platform === 'All' ? t('campaigns.allPlatforms') : platform}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? t('campaigns.allStatuses') : status}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="block min-w-0 flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="name">{t('campaigns.campaignName')}</option>
                <option value="platform">{t('campaigns.platform')}</option>
                <option value="status">{t('campaigns.status')}</option>
                <option value="spend">{t('campaigns.spend')}</option>
                <option value="roas">{t('campaigns.roas')}</option>
                <option value="cpa">{t('campaigns.cpa')}</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 shrink-0"
                title={sortOrder === 'asc' ? t('campaigns.ascending') : t('campaigns.descending')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {metaSyncNotice && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {metaSyncNotice}
            </div>
          )}
          {filteredAndSortedCampaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
              {!hasConnectedAdPlatform ? t('campaigns.connectPlatforms') : t('campaigns.noCampaigns')}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.campaignName')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.platform')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.status')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'סוג / יעד' : 'Type / Objective'}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Impr.</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Clicks</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CTR</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.spend')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.roas')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.cpa')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Conv.</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'מקור נתונים' : 'Data source'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredAndSortedCampaigns.map((campaign) => {
                      const unifiedStatus = normalizeCampaignStatus(campaign.status);
                      const platform = String(campaign.platform || '');
                      const metaFacebookSpend = toAmount(campaign?.metaChannels?.facebook?.spend);
                      const metaInstagramSpend = toAmount(campaign?.metaChannels?.instagram?.spend);
                      const metaWhatsappSpend = toAmount(campaign?.metaChannels?.whatsapp?.spend);
                      const metaWhatsappConversations = toAmount(campaign?.metaChannels?.whatsapp?.conversations);
                      const hasMetaChannels =
                        platform === 'Meta' &&
                        (metaFacebookSpend > 0 ||
                          metaInstagramSpend > 0 ||
                          Boolean(campaign?.metaChannels?.whatsapp?.enabled));
                      const typeOrObjective =
                        platform === 'Meta'
                          ? campaign.objective || '—'
                          : platform === 'Google'
                            ? campaign.advertisingChannelSubType || campaign.advertisingChannelType || '—'
                            : campaign.campaignType || campaign.objective || '—';
                      const hasMetrics =
                        platform === 'Meta'
                          ? hasMetaMetrics(campaign)
                          : platform === 'Google'
                            ? hasGoogleMetrics(campaign)
                            : (toAmount(campaign.impressions) + toAmount(campaign.clicks) + toAmount(campaign.spend)) > 0;

                      return (
                        <tr key={`campaign-row-${platform}-${campaign.id}`}>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                            <div className="max-w-[220px] truncate" title={String(campaign.name || '')}>
                              {campaign.name}
                            </div>
                            {hasMetaChannels && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                  FB {metaFacebookSpend > 0 ? formatCurrency(metaFacebookSpend) : '—'}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                  IG {metaInstagramSpend > 0 ? formatCurrency(metaInstagramSpend) : '—'}
                                </span>
                                {campaign?.metaChannels?.whatsapp?.enabled && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                    WA {metaWhatsappSpend > 0 ? formatCurrency(metaWhatsappSpend) : ''}
                                    {metaWhatsappConversations > 0 ? ` · ${Math.round(metaWhatsappConversations)}` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">{platform || '—'}</td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              getStatusBadgeClass(unifiedStatus)
                            )}>
                              {unifiedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{typeOrObjective}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.impressions).toLocaleString()}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.clicks).toLocaleString()}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{formatPercent(campaign.ctr)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{formatCurrency(toAmount(campaign.spend))}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.roas).toFixed(2)}x</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{formatCurrency(toAmount(campaign.cpa))}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.conversions).toLocaleString()}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                              hasMetrics ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            )}>
                              {hasMetrics ? (isHebrew ? 'חי' : 'Live') : (isHebrew ? 'חסר מדדים' : 'Missing metrics')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white shadow rounded-lg overflow-hidden flex flex-col border border-gray-200">
        <div className="px-3 py-3 sm:px-4 border-b border-gray-200 bg-indigo-50 flex items-center justify-between">
          <h3 className="text-base leading-6 font-semibold text-indigo-900 flex items-center">
            <Zap className="w-4 h-4 ml-1.5 text-indigo-600" />
            {t('campaigns.aiRecommendations')}
          </h3>
          {recommendations.length > 0 && (
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="inline-flex items-center p-1.5 border border-indigo-200 rounded-md text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
              title="Send to Email"
            >
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className="p-3">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : recommendations.length > 0 ? (
            <ul className="space-y-1.5 max-h-[250px] overflow-y-auto pe-1">
              {recommendations.map((rec, index) => (
                <li key={`ai-rec-${index}`} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleRecExpanded(index)}
                    className="w-full px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
                          rec.impact === 'High' ? "bg-red-100 text-red-800" :
                          rec.impact === 'Medium' ? "bg-yellow-100 text-yellow-800" :
                          "bg-green-100 text-green-800"
                        )}>
                          {t('campaigns.impact')}: {
                            rec.impact === 'High' ? t('campaigns.impactHigh') :
                            rec.impact === 'Medium' ? t('campaigns.impactMedium') :
                            t('campaigns.impactLow')
                          }
                        </span>
                        <span className="text-[10px] text-gray-500 truncate">{rec.platform}</span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900 truncate text-start">{rec.title}</h4>
                    </div>
                    {expandedRecs.includes(index) ? (
                      <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                  </button>
                  <div className={cn(
                    "px-2.5 overflow-hidden transition-all duration-200",
                    expandedRecs.includes(index) ? "max-h-44 pb-2.5" : "max-h-0"
                  )}>
                    <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-4">{rec.description}</p>
                    <div className="mt-1.5">
                      <button
                        onClick={() => handleApply(index)}
                        disabled={appliedRecs.includes(index)}
                        className={cn(
                          "inline-flex items-center px-2.5 py-1 border border-transparent text-[11px] font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
                          appliedRecs.includes(index)
                            ? "bg-green-50 text-green-700 border-green-200 cursor-not-allowed"
                            : "text-white bg-indigo-600 hover:bg-indigo-700"
                        )}
                      >
                        {appliedRecs.includes(index) ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                            {t('campaigns.appliedSuccess')}
                          </>
                        ) : (
                          t('campaigns.applyAuto')
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p>{t('campaigns.noRecommendations')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-indigo-50/60">
          <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            {text.builderTitle}
          </h3>
          <p className="text-sm text-indigo-700 mt-1">{text.builderSubtitle}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.campaignName}</label>
              <input
                value={campaignNameInput}
                onChange={(e) => setCampaignNameInput(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'לדוגמה: השקת קולקציה חדשה' : 'Example: New collection launch'}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.objective}</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as ObjectiveType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {objectiveOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.contentType}</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {contentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.productType}</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as ProductType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {productTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">{text.description}</label>
            <textarea
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder={
                isHebrew
                  ? 'כתוב מה הפוסט/המוצר, למי הוא מיועד ומה המסר.'
                  : 'Describe the post/product, target user, and campaign message.'
              }
            />
          </div>

          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">{text.selectPlatforms}</p>
            {connectedAdPlatforms.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {text.noConnectedPlatforms}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(['Google', 'Meta', 'TikTok'] as const).map((platform) => {
                  const connected = connectedAdPlatforms.includes(platform);
                  const selected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => connected && togglePlatformSelection(platform)}
                      disabled={!connected}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : connected
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      )}
                      title={!connected ? text.connectedOnly : ''}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      {platform}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">{text.smartAudienceTitle}</h4>
            <p className="text-xs text-indigo-700 mb-3">{text.smartAudienceSubtitle}</p>
            <div className="flex flex-wrap gap-2">
              {audienceSuggestions.map((audience) => {
                const selected = selectedAudiences.includes(audience);
                return (
                  <button
                    key={audience}
                    type="button"
                    onClick={() => toggleAudienceSelection(audience)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    )}
                  >
                    {audience}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAudience())}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'קהל מותאם אישית...' : 'Custom audience...'}
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 text-sm font-bold"
              >
                <PlusCircle className="w-4 h-4" />
                {text.addCustomAudience}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-1">
              <ImagePlus className="w-4 h-4 text-indigo-600" />
              {text.uploadTitle}
            </h4>
            <p className="text-xs text-gray-500 mb-3">{text.uploadHint}</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              {text.uploadButton}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAssetUpload} />
            </label>
            {uploadedAssets.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {uploadedAssets.map((asset) => (
                  <div key={asset.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <img src={asset.previewUrl} alt={asset.name} className="h-20 w-full object-cover" />
                    <div className="p-1.5">
                      <p className="text-[10px] text-gray-600 truncate">{asset.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.id)}
                      className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-red-600 border border-red-100 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
                <Clock3 className="w-4 h-4" />
                {text.timingRulesTitle}
              </h4>
              <p className="text-xs text-amber-700 mb-3">{text.bestWindows}</p>
              <div className="space-y-2 mb-3">
                {connectedAdPlatforms.map((platform) => (
                  <div key={platform} className="text-xs bg-white border border-amber-100 rounded-md px-2 py-1.5">
                    <span className="font-bold text-amber-900">{platform}: </span>
                    {(BEST_TIME_WINDOWS[platform] || []).map((w, idx) => (
                      <span key={`${platform}-${w.slot}`} className="text-amber-800">
                        {idx > 0 ? ' | ' : ''}
                        {slotLabels[w.slot]} ({SLOT_RANGES[w.slot]}) · ROAS {w.roas.toFixed(1)} · CPA {formatCurrency(w.cpa)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  value={rulePlatform}
                  onChange={(e) => setRulePlatform(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {connectedAdPlatforms.map((platform) => (
                    <option key={`rule-${platform}`} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleSlot}
                  onChange={(e) => setRuleSlot(e.target.value as SlotKey)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {(Object.keys(slotLabels) as SlotKey[]).map((slot) => (
                    <option key={slot} value={slot}>
                      {slotLabels[slot]} ({SLOT_RANGES[slot]})
                    </option>
                  ))}
                </select>
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as RuleAction)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  <option value="boost">{isHebrew ? 'הגדל תקציב' : 'Boost budget'}</option>
                  <option value="limit">{isHebrew ? 'הגבל תקציב' : 'Limit budget'}</option>
                  <option value="pause">{isHebrew ? 'השהה מודעה' : 'Pause ads'}</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={ruleMinRoas}
                    onChange={(e) => setRuleMinRoas(Number(e.target.value))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                    placeholder="ROAS"
                  />
                  <button
                    type="button"
                    onClick={addTimeRule}
                    className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                  >
                    {text.addRule}
                  </button>
                </div>
              </div>
              {timeRules.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {timeRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between rounded-md bg-white border border-amber-100 px-2 py-1.5 text-xs">
                      <span>
                        <strong>{rule.platform}</strong> · {slotLabels[rule.slot]} ·{' '}
                        {rule.action === 'boost'
                          ? isHebrew
                            ? 'הגדל'
                            : 'Boost'
                          : rule.action === 'limit'
                          ? isHebrew
                            ? 'הגבל'
                            : 'Limit'
                          : isHebrew
                          ? 'השהה'
                          : 'Pause'}{' '}
                        · ROAS ≥ {rule.minRoas.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTimeRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4" />
                {text.weeklyTitle}
              </h4>
              {selectedPlatforms.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedPlatforms.map((platform) => (
                      <button
                        key={`schedule-${platform}`}
                        type="button"
                        onClick={() => setSelectedSchedulePlatform(platform)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-bold border',
                          selectedSchedulePlatform === platform
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        )}
                      >
                        {platform} · {text.weeklyActiveSlots}: {getActiveSlotsCount(platform)}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[520px] w-full text-xs border border-emerald-100 rounded-lg overflow-hidden">
                      <thead className="bg-emerald-100/60">
                        <tr>
                          <th className="px-2 py-1 text-start">{isHebrew ? 'יום' : 'Day'}</th>
                          {(Object.keys(slotLabels) as SlotKey[]).map((slot) => (
                            <th key={`slot-head-${slot}`} className="px-2 py-1 text-center">
                              {slotLabels[slot]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {(Object.keys(dayLabels) as DayKey[]).map((day) => (
                          <tr key={`day-${day}`} className="border-t border-emerald-50">
                            <td className="px-2 py-1.5 font-semibold text-gray-700">{dayLabels[day]}</td>
                            {(Object.keys(slotLabels) as SlotKey[]).map((slot) => {
                              const active = weeklySchedule[selectedSchedulePlatform]?.[day]?.[slot] || false;
                              return (
                                <td key={`${day}-${slot}`} className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleScheduleCell(selectedSchedulePlatform, day, slot)}
                                    className={cn(
                                      'inline-flex h-6 w-6 items-center justify-center rounded-md border',
                                      active
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-400 hover:border-emerald-300'
                                    )}
                                  >
                                    {active && <Check className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-emerald-700">{text.noConnectedPlatforms}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <p className="text-xs text-gray-500">
              {isHebrew
                ? 'המודעות ייווצרו לפי הקהלים, התמונות והתזמון שבחרת, ורק בפלטפורמות שמחוברות לממשק.'
                : 'Campaigns are created with your selected audiences, media, and schedule only on connected platforms.'}
            </p>
            <button
              type="button"
              onClick={handleCreateScheduledCampaign}
              disabled={selectedPlatforms.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Target className="w-4 h-4" />
              {text.createDraft}
            </button>
          </div>

          {builderMessage && (
            <div className={cn(
              'text-sm rounded-lg px-3 py-2 border',
              builderMessage === text.publishedOk
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            )}>
              {builderMessage}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

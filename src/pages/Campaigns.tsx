import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getOptimizationRecommendations,
  getAIKeysFromConnections,
  hasAnyAIKey,
  getAudienceRecommendations,
  getCampaignBuilderSuggestions,
} from '../lib/gemini';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Mail,
  Target,
  ImagePlus,
  Trash2,
  Clock3,
  CalendarClock,
  PlusCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Video,
  Pencil,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import { fetchMetaCampaigns, isMetaRateLimitMessage } from '../services/metaService';
import { fetchGoogleCampaigns, sendGmailNotification } from '../services/googleService';
import { fetchWooCommerceProducts } from '../services/woocommerceService';
import { auth, onAuthStateChanged } from '../lib/firebase';
import {
  mapGoogleCampaignRowsToUnifiedLayer,
  mapMetaCampaignRowsToUnifiedLayer,
  mapTikTokCampaignRowsToUnifiedLayer,
  replaceUnifiedPlatformSlice,
  unifiedLayerToCampaignRows,
} from '../lib/unified-data/mappers';
import { createEmptyUnifiedDataLayer } from '../lib/unified-data/types';

const mockCampaignData = [
  { id: 1, name: 'Summer Sale - Shoes', platform: 'Google', status: 'Active', spend: 1200, roas: 2.5, cpa: 45 },
  { id: 2, name: 'Retargeting - Abandoned Cart', platform: 'Meta', status: 'Active', spend: 800, roas: 4.2, cpa: 22 },
  { id: 3, name: 'New Collection - Video', platform: 'TikTok', status: 'Paused', spend: 400, roas: 1.1, cpa: 85 },
  { id: 4, name: 'Brand Search', platform: 'Google', status: 'Active', spend: 300, roas: 8.5, cpa: 12 },
];

type ContentType = 'product' | 'offer' | 'educational' | 'testimonial' | 'video';
type ProductType = 'fashion' | 'beauty' | 'tech' | 'home' | 'fitness' | 'services' | 'other';
type ObjectiveType = 'sales' | 'traffic' | 'leads' | 'awareness' | 'retargeting';
type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type RuleAction = 'boost' | 'limit' | 'pause';
type PlatformName = 'Google' | 'Meta' | 'TikTok';

type UploadedAsset = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  file: File;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
};

type TimeRule = {
  id: string;
  platform: PlatformName;
  startHour: number;
  endHour: number;
  action: RuleAction;
  minRoas: number;
  reason?: string;
};

type DayHours = Record<DayKey, number[]>;
type WeeklySchedule = Record<string, DayHours>;

type MediaLimits = {
  imageMaxMb: number;
  videoMaxMb: number;
  maxImageWidth: number;
  maxImageHeight: number;
};

type EditableStatus = 'Active' | 'Paused';

type EditCampaignDraft = {
  rowKey: string;
  platform: PlatformName;
  campaignId: string;
  name: string;
  status: EditableStatus;
  dailyBudget: string;
};

type WooCampaignProduct = {
  id: number;
  name: string;
  categories: string[];
  price?: string;
  shortDescription?: string;
  description?: string;
  sku?: string;
  stockQuantity?: number | null;
};

type WooPublishScope = 'category' | 'product';

type PlatformCopyDraft = {
  title: string;
  description: string;
};

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const PLATFORM_MEDIA_LIMITS: Record<PlatformName, MediaLimits> = {
  Google: { imageMaxMb: 5, videoMaxMb: 100, maxImageWidth: 1200, maxImageHeight: 1200 },
  Meta: { imageMaxMb: 30, videoMaxMb: 500, maxImageWidth: 1440, maxImageHeight: 1440 },
  TikTok: { imageMaxMb: 20, videoMaxMb: 500, maxImageWidth: 1080, maxImageHeight: 1920 },
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

const createEmptyDaySchedule = (): DayHours => ({
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
});

const stripHtmlToText = (value: unknown): string =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
      ? 'יצירת מודעות עם קהלים חכמים, העלאת תמונה/וידאו, חוקי טירגוט לפי שעות ולוח תזמון שבועי.'
      : 'Create campaigns with smart audiences, image/video upload, hourly targeting rules, and weekly scheduling.',
    smartWindowTitle: isHebrew ? 'חלון תכנון חכם עם AI' : 'Smart AI planning window',
    smartWindowSubtitle: isHebrew
      ? 'הכנס כותרת קצרה והמערכת תציע קהלים, מטרה, סוג תוכן, סוג מוצר/שירות ושעות ביצוע מומלצות.'
      : 'Enter a short title and the system suggests audiences, objective, content type, product/service type, and recommended hours.',
    shortTitle: isHebrew ? 'כותרת קצרה' : 'Short title',
    analyzeWithAi: isHebrew ? 'נתח עם AI' : 'Analyze with AI',
    aiAudienceFromConnections: isHebrew
      ? 'קהלים חכמים מנותחים מנתוני החיבורים הפעילים'
      : 'Smart audiences analyzed from connected platform data',
    campaignName: isHebrew ? 'שם קמפיין' : 'Campaign name',
    objective: isHebrew ? 'מטרת קמפיין' : 'Campaign objective',
    contentType: isHebrew ? 'אופי פוסט/תוכן' : 'Post/Product content type',
    productType: isHebrew ? 'סוג מוצר/שירות' : 'Product/service type',
    serviceType: isHebrew ? 'סוג שירות / קטגוריה עסקית' : 'Service type / business category',
    description: isHebrew ? 'תיאור קצר לפוסט או מוצר' : 'Short post/product brief',
    selectPlatforms: isHebrew ? 'בחירת פלטפורמות מחוברות' : 'Select connected platforms',
    noConnectedPlatforms: isHebrew ? 'אין פלטפורמות פרסום מחוברות כרגע.' : 'No advertising platforms are currently connected.',
    smartAudienceTitle: isHebrew ? 'רשימת קהלים חכמה מטורגטת' : 'Smart targeted audience list',
    smartAudienceSubtitle: isHebrew
      ? 'המלצות אוטומטיות לפי אופי התוכן, סוג המוצר ומטרת הקמפיין.'
      : 'Auto recommendations by content nature, product type, and campaign objective.',
    addCustomAudience: isHebrew ? 'הוסף קהל ידני' : 'Add custom audience',
    uploadTitle: isHebrew ? 'מדיה למודעות (תמונה / וידאו)' : 'Ad media (image / video)',
    uploadHint: isHebrew
      ? 'התמונות יעברו הקטנה חכמה אוטומטית לפי תנאי הפלטפורמות בלי פגיעה נראית לעין באיכות.'
      : 'Images are auto-resized smartly to fit platform requirements with no visible quality loss.',
    uploadButton: isHebrew ? 'בחר תמונה / וידאו' : 'Choose image / video',
    noDataPersistenceNote: isHebrew
      ? 'הערה: המדיה נמחקת אוטומטית אחרי שליחת הפרסום ואינה נשמרת במערכת.'
      : 'Note: media is automatically deleted right after publish submission and is never stored.',
    timingRulesTitle: isHebrew ? 'חוקי טירגוט לפי שעות ביצועים (AI)' : 'AI hourly performance targeting rules',
    weeklyTitle: isHebrew ? 'לוח זמנים שבועי לפי שעות (גובר על כל החוקים)' : 'Weekly hourly schedule (overrides all other rules)',
    createDraft: isHebrew ? 'צור קמפיין מתוזמן בפלטפורמה' : 'Create scheduled campaign in platform',
    publishedOk: isHebrew ? 'הקמפיינים נוצרו בהצלחה בפלטפורמות שנבחרו.' : 'Campaigns were created successfully on selected platforms.',
    publishedPartial: isHebrew ? 'חלק מהפלטפורמות נכשלו. בדוק פירוט תוצאות.' : 'Some platforms failed. Check detailed results.',
    requireFields: isHebrew ? 'נדרש שם קמפיין ובחירת לפחות פלטפורמה אחת.' : 'Campaign name and at least one platform are required.',
    requireAsset: isHebrew ? 'יש להעלות לפחות קובץ מדיה אחד כדי ליצור קמפיין.' : 'Upload at least one media file to create campaign.',
    connectedOnly: isHebrew ? 'זמין רק בפלטפורמות מחוברות' : 'Available only for connected platforms',
    bestWindows: isHebrew ? 'שעות ביצועים מומלצות (AI)' : 'AI recommended performance hours',
    addRule: isHebrew ? 'הוסף חוק' : 'Add rule',
    weeklyActiveSlots: isHebrew ? 'שעות פעילות' : 'Active hours',
    createdCampaigns: isHebrew ? 'קמפיינים פעילים ומתוזמנים' : 'Active and scheduled campaigns',
    syncLive: isHebrew ? 'מסנכרן נתונים בזמן אמת...' : 'Syncing real-time data...',
    creatingLiveCampaigns: isHebrew ? 'יוצר קמפיינים חיים...' : 'Creating live campaigns...',
    aiMissing: isHebrew ? 'אין כרגע חיבור למנוע AI פעיל.' : 'No active AI engine connection found.',
    editCampaign: isHebrew ? 'עריכת קמפיין קיים' : 'Edit existing campaign',
    editCampaignSubtitle: isHebrew
      ? 'עריכה ישירה בפלטפורמה המחוברת (שם, סטטוס, ובמקום אפשרי גם תקציב יומי).'
      : 'Direct update on connected platform (name, status, and when supported also daily budget).',
    saveChanges: isHebrew ? 'שמור שינויים' : 'Save changes',
    cancel: isHebrew ? 'בטל' : 'Cancel',
    editName: isHebrew ? 'שם קמפיין' : 'Campaign name',
    editStatus: isHebrew ? 'סטטוס' : 'Status',
    editBudget: isHebrew ? 'תקציב יומי (אופציונלי)' : 'Daily budget (optional)',
    updateSuccess: isHebrew ? 'הקמפיין עודכן בהצלחה.' : 'Campaign updated successfully.',
    updateFailed: isHebrew ? 'עדכון הקמפיין נכשל.' : 'Failed to update campaign.',
    actions: isHebrew ? 'פעולות' : 'Actions',
    editNotAvailable: isHebrew ? 'עריכה זמינה רק לקמפיינים חיים מהפלטפורמות.' : 'Editing is available only for live platform campaigns.',
    saving: isHebrew ? 'שומר...' : 'Saving...',
    wooPublishTitle: isHebrew ? 'בחירה מתוך WooCommerce' : 'Choose from WooCommerce',
    wooPublishSubtitle: isHebrew
      ? 'בחר מה לפרסם לפי קטגוריה או לפי מוצר מתוך החנות המחוברת.'
      : 'Choose what to promote by category or by product from connected store.',
    wooOptionalModeTitle: isHebrew
      ? 'שימוש ב-WooCommerce (אופציונלי)'
      : 'Use WooCommerce (optional)',
    wooOptionalModeDesc: isHebrew
      ? 'ניתן ליצור ולפרסם קמפיין גם בלי לבחור מוצר/קטגוריה מתוך WooCommerce.'
      : 'You can create and publish a campaign without selecting WooCommerce product/category.',
    wooManualModeActive: isHebrew
      ? 'מצב ידני פעיל: הפרסום לא תלוי במוצרי WooCommerce.'
      : 'Manual mode active: publishing is independent of WooCommerce products.',
    wooNotConnected: isHebrew
      ? 'כדי לבחור מוצר/קטגוריה, חבר קודם WooCommerce במסך החיבורים.'
      : 'Connect WooCommerce in Integrations to choose category/product.',
    wooLoading: isHebrew ? 'טוען מוצרים מהחנות...' : 'Loading store products...',
    wooNoProducts: isHebrew ? 'לא נמצאו מוצרים בחיבור WooCommerce.' : 'No products found in WooCommerce connection.',
    wooScope: isHebrew ? 'שיטת פרסום' : 'Promotion mode',
    wooByCategory: isHebrew ? 'לפי קטגוריה' : 'By category',
    wooByProduct: isHebrew ? 'לפי מוצר' : 'By product',
    wooCategory: isHebrew ? 'קטגוריה' : 'Category',
    wooProduct: isHebrew ? 'מוצר' : 'Product',
    wooChooseCategory: isHebrew ? 'בחר קטגוריה' : 'Select category',
    wooChooseProduct: isHebrew ? 'בחר מוצר' : 'Select product',
    wooRequireTarget: isHebrew
      ? 'בחר קטגוריה או מוצר לפרסום מתוך WooCommerce.'
      : 'Select a WooCommerce category or product to promote.',
    wooAutoDescriptionHint: isHebrew
      ? 'בחירת מוצר ממלאת אוטומטית את התיאור לפי מידע המוצר, וניתן לערוך חופשי.'
      : 'Selecting a product auto-fills the description from product data and remains editable.',
    wooImportProduct: isHebrew ? 'ייבא מוצר לקמפיין' : 'Import product to campaign',
    wooImportSuccess: isHebrew
      ? 'פרטי המוצר יובאו בהצלחה מ-WooCommerce.'
      : 'Product details imported successfully from WooCommerce.',
    wooProductDataMissing: isHebrew
      ? 'למוצר הנבחר אין מספיק פרטים לייבוא.'
      : 'Selected product has insufficient data for import.',
    markFullDay: isHebrew ? 'סמן יום מלא' : 'Mark full day',
    unmarkFullDay: isHebrew ? 'בטל יום מלא' : 'Unmark full day',
    platformCopyTitle: isHebrew ? 'כותרת ותיאור מותאמים לפי פלטפורמה' : 'Platform-fit title and description',
    platformCopySubtitle: isHebrew
      ? 'נוצר אוטומטית לפי חוקי אורך מומלצים של כל פלטפורמה.'
      : 'Generated automatically according to recommended length rules per platform.',
    analyzePlatformAds: isHebrew
      ? 'נתח וצור מודעות מותאמות לפלטפורמות'
      : 'Analyze and generate platform-fit ads',
    applyPlatformCopy: isHebrew ? 'החל לשדות הקמפיין' : 'Apply to campaign fields',
  };

  const periodLabel = dateRange === 'today' ? t('dashboard.today') : dateRange === '7days' ? t('dashboard.last7Days') : dateRange === '30days' ? t('dashboard.last30Days') : t('dashboard.customRange');
  const startDateIso = useMemo(() => bounds.startDate.toISOString().slice(0, 10), [bounds.startDate]);
  const endDateIso = useMemo(() => bounds.endDate.toISOString().slice(0, 10), [bounds.endDate]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<number[]>([]);
  const [expandedRecs, setExpandedRecs] = useState<number[]>([]);
  const [realCampaigns, setRealCampaigns] = useState<any[]>([]);
  const [unifiedDataLayer, setUnifiedDataLayer] = useState(createEmptyUnifiedDataLayer);
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
  const [shortTitleInput, setShortTitleInput] = useState('');
  const [objective, setObjective] = useState<ObjectiveType>('sales');
  const [contentType, setContentType] = useState<ContentType>('product');
  const [productType, setProductType] = useState<ProductType>('other');
  const [serviceTypeInput, setServiceTypeInput] = useState('');
  const [campaignBrief, setCampaignBrief] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState('');
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [selectedSchedulePlatform, setSelectedSchedulePlatform] = useState<string>('Google');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<DayKey>('mon');
  const [timeRules, setTimeRules] = useState<TimeRule[]>([]);
  const [rulePlatform, setRulePlatform] = useState<PlatformName>('Google');
  const [ruleStartHour, setRuleStartHour] = useState<number>(18);
  const [ruleEndHour, setRuleEndHour] = useState<number>(22);
  const [ruleAction, setRuleAction] = useState<RuleAction>('boost');
  const [ruleMinRoas, setRuleMinRoas] = useState<number>(3);
  const [ruleReason, setRuleReason] = useState<string>('');
  const [aiAudienceLoading, setAiAudienceLoading] = useState(false);
  const [aiAudienceProvider, setAiAudienceProvider] = useState<string>('');
  const [aiGeneratedAudienceNames, setAiGeneratedAudienceNames] = useState<string[]>([]);
  const [aiRecommendedHoursByPlatform, setAiRecommendedHoursByPlatform] = useState<Record<string, number[]>>({});
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [publishResults, setPublishResults] = useState<Array<{ platform: string; ok: boolean; message: string; campaignId?: string }>>([]);
  const [editingCampaign, setEditingCampaign] = useState<EditCampaignDraft | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [platformCopyDrafts, setPlatformCopyDrafts] = useState<Partial<Record<PlatformName, PlatformCopyDraft>>>({});
  const [wooProducts, setWooProducts] = useState<WooCampaignProduct[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [useWooProductData, setUseWooProductData] = useState(false);
  const [wooPublishScope, setWooPublishScope] = useState<WooPublishScope>('category');
  const [selectedWooCategory, setSelectedWooCategory] = useState('');
  const [selectedWooProductId, setSelectedWooProductId] = useState<string>('');
  const wooAutoBriefRef = useRef('');

  const connectedAdPlatforms = useMemo(() => {
    const options: string[] = [];
    if (connections.find((c) => c.id === 'google' && c.status === 'connected')) options.push('Google');
    if (connections.find((c) => c.id === 'meta' && c.status === 'connected')) options.push('Meta');
    if (connections.find((c) => c.id === 'tiktok' && c.status === 'connected')) options.push('TikTok');
    return options;
  }, [connections]);

  const wooConnection = useMemo(
    () => connections.find((c) => c.id === 'woocommerce' && c.status === 'connected'),
    [connections]
  );
  const isWooConnected = Boolean(wooConnection);

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

  const dayLabels: Record<DayKey, string> = {
    mon: isHebrew ? 'שני' : 'Mon',
    tue: isHebrew ? 'שלישי' : 'Tue',
    wed: isHebrew ? 'רביעי' : 'Wed',
    thu: isHebrew ? 'חמישי' : 'Thu',
    fri: isHebrew ? 'שישי' : 'Fri',
    sat: isHebrew ? 'שבת' : 'Sat',
    sun: isHebrew ? 'ראשון' : 'Sun',
  };

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => hour), []);
  const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
  const formatHourRange = (startHour: number, endHour: number) =>
    `${formatHour(startHour)}-${formatHour(endHour)}`;

  const effectiveMediaLimits = useMemo(() => {
    const activePlatforms = selectedPlatforms.filter((p): p is PlatformName =>
      p === 'Google' || p === 'Meta' || p === 'TikTok'
    );
    if (!activePlatforms.length) return PLATFORM_MEDIA_LIMITS.Google;
    return activePlatforms.reduce<MediaLimits>((acc, platform) => {
      const current = PLATFORM_MEDIA_LIMITS[platform];
      return {
        imageMaxMb: Math.min(acc.imageMaxMb, current.imageMaxMb),
        videoMaxMb: Math.min(acc.videoMaxMb, current.videoMaxMb),
        maxImageWidth: Math.min(acc.maxImageWidth, current.maxImageWidth),
        maxImageHeight: Math.min(acc.maxImageHeight, current.maxImageHeight),
      };
    }, PLATFORM_MEDIA_LIMITS[activePlatforms[0]]);
  }, [selectedPlatforms]);

  const wooCategoryOptions = useMemo(() => {
    const names = wooProducts.flatMap((product) => product.categories);
    return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [wooProducts]);

  const wooProductsFiltered = useMemo(() => {
    if (wooPublishScope !== 'category') return wooProducts;
    if (!selectedWooCategory) return wooProducts;
    return wooProducts.filter((product) => product.categories.includes(selectedWooCategory));
  }, [wooProducts, wooPublishScope, selectedWooCategory]);

  const selectedWooProduct = useMemo(() => {
    if (!selectedWooProductId) return null;
    return wooProducts.find((product) => String(product.id) === String(selectedWooProductId)) || null;
  }, [wooProducts, selectedWooProductId]);

  const inferredWooTitle = useMemo(() => {
    if (!useWooProductData || !isWooConnected) return '';
    if (wooPublishScope === 'product' && selectedWooProduct?.name) {
      return selectedWooProduct.name;
    }
    if (wooPublishScope === 'category' && selectedWooCategory) {
      return `${selectedWooCategory} Campaign`;
    }
    return '';
  }, [useWooProductData, isWooConnected, wooPublishScope, selectedWooProduct?.name, selectedWooCategory]);

  const buildWooProductBrief = (product: WooCampaignProduct): string => {
    const longDescription =
      (product.shortDescription && product.shortDescription.trim()) ||
      (product.description && product.description.trim()) ||
      '';
    const compactDescription =
      longDescription.length > 420 ? `${longDescription.slice(0, 417).trim()}...` : longDescription;
    const categoryLabel =
      product.categories.length > 0
        ? `${isHebrew ? 'קטגוריות' : 'Categories'}: ${product.categories.join(', ')}`
        : '';
    const priceLabel = product.price ? `${isHebrew ? 'מחיר' : 'Price'}: ${product.price}` : '';
    const skuLabel = product.sku ? `SKU: ${product.sku}` : '';
    const stockLabel =
      typeof product.stockQuantity === 'number'
        ? `${isHebrew ? 'מלאי' : 'Stock'}: ${product.stockQuantity}`
        : '';
    return [
      `${isHebrew ? 'מוצר' : 'Product'}: ${product.name}`,
      categoryLabel,
      priceLabel,
      skuLabel,
      stockLabel,
      compactDescription,
    ]
      .filter((item) => item && item.trim().length > 0)
      .join('\n');
  };

  const importWooProductToBuilder = (
    product: WooCampaignProduct,
    options?: { overwriteExisting?: boolean; notify?: boolean }
  ) => {
    const overwriteExisting = options?.overwriteExisting ?? true;
    const notify = options?.notify ?? false;
    const productBrief = buildWooProductBrief(product);
    if (!productBrief.trim()) {
      if (notify) setBuilderMessage(text.wooProductDataMissing);
      return;
    }

    setContentType('product');
    setShortTitleInput((prev) =>
      overwriteExisting || !prev.trim() ? product.name : prev
    );
    setCampaignNameInput((prev) =>
      overwriteExisting || !prev.trim() ? product.name : prev
    );
    setServiceTypeInput((prev) => {
      const nextCategory = product.categories[0] || '';
      if (!nextCategory) return prev;
      return overwriteExisting || !prev.trim() ? nextCategory : prev;
    });
    setCampaignBrief((prev) =>
      overwriteExisting || !prev.trim() || prev.trim() === wooAutoBriefRef.current.trim()
        ? productBrief
        : prev
    );
    wooAutoBriefRef.current = productBrief;
    if (notify) setBuilderMessage(text.wooImportSuccess);
  };

  const audienceSuggestions = useMemo(() => {
    const combined = [
      ...aiGeneratedAudienceNames,
      ...SMART_AUDIENCE_BY_CONTENT[contentType],
      ...SMART_AUDIENCE_BY_PRODUCT[productType],
      ...SMART_AUDIENCE_BY_OBJECTIVE[objective],
    ];
    return [...new Set(combined)];
  }, [aiGeneratedAudienceNames, contentType, productType, objective]);

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
    setRulePlatform((prev) =>
      connectedAdPlatforms.includes(prev)
        ? (prev as PlatformName)
        : ((connectedAdPlatforms[0] || 'Google') as PlatformName)
    );
  }, [connectedAdPlatforms]);

  useEffect(() => {
    if (!wooConnection?.settings) {
      setWooProducts([]);
      setSelectedWooCategory('');
      setSelectedWooProductId('');
      return;
    }
    const { storeUrl, wooKey, wooSecret } = (wooConnection.settings || {}) as any;
    if (!storeUrl || !wooKey || !wooSecret) {
      setWooProducts([]);
      return;
    }
    let cancelled = false;
    setWooLoading(true);
    fetchWooCommerceProducts(storeUrl, wooKey, wooSecret, { fallbackToMock: false })
      .then((list) => {
        if (cancelled) return;
        const mapped = (Array.isArray(list) ? list : [])
          .map((item: any) => ({
            id: Number(item?.id || 0),
            name: stripHtmlToText(item?.name || ''),
            categories: Array.isArray(item?.categories)
              ? item.categories
                  .map((category: any) => stripHtmlToText(category?.name || ''))
                  .filter(Boolean)
              : [],
            price: item?.price != null ? String(item.price) : '',
            shortDescription: stripHtmlToText(item?.short_description || ''),
            description: stripHtmlToText(item?.description || ''),
            sku: stripHtmlToText(item?.sku || ''),
            stockQuantity:
              typeof item?.stock_quantity === 'number' && Number.isFinite(item.stock_quantity)
                ? item.stock_quantity
                : null,
          }))
          .filter((item: WooCampaignProduct) => item.id > 0 && item.name);
        setWooProducts(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setWooProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setWooLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wooConnection?.settings]);

  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope === 'product') return;
    if (!selectedWooCategory && wooCategoryOptions.length > 0) {
      setSelectedWooCategory(wooCategoryOptions[0]);
    }
  }, [useWooProductData, wooPublishScope, wooCategoryOptions, selectedWooCategory]);

  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product') return;
    if (!selectedWooProductId && wooProductsFiltered.length > 0) {
      setSelectedWooProductId(String(wooProductsFiltered[0].id));
    }
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product') return;
    if (!selectedWooProductId) return;
    const exists = wooProductsFiltered.some(
      (product) => String(product.id) === String(selectedWooProductId)
    );
    if (!exists) {
      setSelectedWooProductId(
        wooProductsFiltered.length > 0 ? String(wooProductsFiltered[0].id) : ''
      );
    }
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  useEffect(() => {
    if (!useWooProductData) return;
    if (!inferredWooTitle) return;
    setShortTitleInput((prev) => (prev.trim() ? prev : inferredWooTitle));
    setCampaignNameInput((prev) => (prev.trim() ? prev : inferredWooTitle));
  }, [useWooProductData, inferredWooTitle]);

  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product' || !selectedWooProduct) return;
    importWooProductToBuilder(selectedWooProduct, { overwriteExisting: false, notify: false });
  }, [useWooProductData, wooPublishScope, selectedWooProduct]);

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

  const applyUnifiedPlatformLayer = (platform: PlatformName, incomingLayer: ReturnType<typeof createEmptyUnifiedDataLayer>) => {
    setUnifiedDataLayer((prev) => {
      const next = replaceUnifiedPlatformSlice(prev, platform, incomingLayer);
      const rows = unifiedLayerToCampaignRows(next);
      if (rows.length > 0) {
        setRealCampaigns(rows);
      }
      return next;
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
        const unifiedLayer = mapTikTokCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(advertiserId),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        applyUnifiedPlatformLayer('TikTok', unifiedLayer);
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
        const unifiedLayer = mapMetaCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(adAccountId || ''),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        const mappedRows = unifiedLayerToCampaignRows(unifiedLayer);
        const hasAnyMetaRow = mappedRows.some((row) => String(row?.platform || '') === 'Meta');
        if (hasAnyMetaRow || campaigns.length === 0) {
          applyUnifiedPlatformLayer('Meta', unifiedLayer);
        }
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
        const unifiedLayer = mapGoogleCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(customerId || ''),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        applyUnifiedPlatformLayer('Google', unifiedLayer);
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

  const ensureManagedApiSession = async () => {
    const currentUser =
      auth.currentUser ||
      (await new Promise<typeof auth.currentUser>((resolve) => {
        const timeoutId = window.setTimeout(() => {
          unsubscribe();
          resolve(auth.currentUser);
        }, 3000);
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve(nextUser);
        });
      }));

    if (!currentUser) {
      throw new Error(
        isHebrew
          ? 'נדרש להתחבר מחדש למערכת לפני יצירת קמפיין.'
          : 'Please sign in again before creating a campaign.'
      );
    }

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch('/api/auth/session/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.message ||
          (isHebrew ? 'אימות הסשן נכשל. התחבר מחדש ונסה שוב.' : 'Session bootstrap failed. Please sign in again.')
      );
    }
  };

  const normalizeHour = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(23, Math.round(value)));
  };

  const sanitizeHours = (hours: number[]) =>
    [...new Set(hours.map((hour) => normalizeHour(hour)))].sort((a, b) => a - b);

  const loadImageElement = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for optimization.'));
      };
      img.src = url;
    });

  const resizeImageForPlatforms = async (file: File) => {
    const img = await loadImageElement(file);
    const { width, height } = img;
    const scale = Math.min(
      1,
      effectiveMediaLimits.maxImageWidth / Math.max(width, 1),
      effectiveMediaLimits.maxImageHeight / Math.max(height, 1)
    );
    if (scale >= 1) {
      return {
        file,
        width,
        height,
      };
    }

    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, width, height };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const preferredType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = preferredType === 'image/png' ? undefined : 0.92;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, preferredType, quality)
    );
    if (!blob) return { file, width, height };
    const ext = preferredType === 'image/png' ? '.png' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const nextFile = new File([blob], `${baseName}${ext}`, {
      type: preferredType,
      lastModified: Date.now(),
    });
    return {
      file: nextFile,
      width: targetWidth,
      height: targetHeight,
    };
  };

  const handleAssetUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = Array.from(event.target.files || []) as File[];
    if (!files.length) return;
    const imageMaxBytes = effectiveMediaLimits.imageMaxMb * 1024 * 1024;
    const videoMaxBytes = effectiveMediaLimits.videoMaxMb * 1024 * 1024;

    const mapped: UploadedAsset[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;

      if (isImage && file.size > imageMaxBytes) {
        setBuilderMessage(
          isHebrew
            ? `קובץ תמונה "${file.name}" גדול מדי לתנאי הפלטפורמות שנבחרו.`
            : `Image "${file.name}" is too large for selected platform requirements.`
        );
        continue;
      }
      if (isVideo && file.size > videoMaxBytes) {
        setBuilderMessage(
          isHebrew
            ? `קובץ וידאו "${file.name}" גדול מדי לתנאי הפלטפורמות שנבחרו.`
            : `Video "${file.name}" is too large for selected platform requirements.`
        );
        continue;
      }

      let optimizedFile = file;
      let width: number | undefined;
      let height: number | undefined;
      if (isImage) {
        try {
          const optimized = await resizeImageForPlatforms(file);
          optimizedFile = optimized.file;
          width = optimized.width;
          height = optimized.height;
        } catch {
          optimizedFile = file;
        }
      }

      mapped.push({
        id: `${optimizedFile.name}-${optimizedFile.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: optimizedFile.name,
        size: optimizedFile.size,
        type: optimizedFile.type,
        file: optimizedFile,
        previewUrl: URL.createObjectURL(optimizedFile),
        mediaType: isVideo ? 'video' : 'image',
        width,
        height,
      });
    }

    if (mapped.length > 0) {
      setUploadedAssets((prev) => [...prev, ...mapped].slice(0, 12));
      setBuilderMessage(null);
    }
    event.target.value = '';
  };

  const removeAsset = (id: string) => {
    setUploadedAssets((prev) => {
      const target = prev.find((asset) => asset.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((asset) => asset.id !== id);
    });
  };

  const clearUploadedMedia = () => {
    setUploadedAssets((prev) => {
      prev.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
      return [];
    });
  };

  const toggleScheduleHour = (platform: string, day: DayKey, hour: number) => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      if (!next[platform]) next[platform] = createEmptyDaySchedule();
      const normalizedHour = normalizeHour(hour);
      const currentHours = Array.isArray(next[platform][day]) ? next[platform][day] : [];
      const hasHour = currentHours.includes(normalizedHour);
      next[platform] = {
        ...next[platform],
        [day]: hasHour
          ? currentHours.filter((value) => value !== normalizedHour)
          : sanitizeHours([...currentHours, normalizedHour]),
      };
      return next;
    });
  };

  const isFullDaySelected = (platform: string, day: DayKey) => {
    const hours = weeklySchedule[platform]?.[day] || [];
    return Array.isArray(hours) && hours.length === 24;
  };

  const toggleFullDay = (platform: string, day: DayKey) => {
    setWeeklySchedule((prev) => {
      const next: WeeklySchedule = { ...prev };
      if (!next[platform]) next[platform] = createEmptyDaySchedule();
      const currentHours = Array.isArray(next[platform][day]) ? next[platform][day] : [];
      const fullDay = Array.from({ length: 24 }, (_, hour) => hour);
      next[platform] = {
        ...next[platform],
        [day]: currentHours.length === 24 ? [] : fullDay,
      };
      return next;
    });
  };

  const getActiveSlotsCount = (platform: string): number => {
    const schedule = weeklySchedule[platform];
    if (!schedule) return 0;
    return DAY_KEYS.reduce((sum, day) => sum + (schedule[day]?.length || 0), 0);
  };

  const addTimeRule = () => {
    if (!rulePlatform) return;
    const startHour = normalizeHour(ruleStartHour);
    const endHour = normalizeHour(ruleEndHour);
    if (endHour <= startHour) {
      setBuilderMessage(
        isHebrew
          ? 'שעת סיום חייבת להיות גדולה משעת התחלה.'
          : 'End hour must be greater than start hour.'
      );
      return;
    }
    const next: TimeRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: rulePlatform,
      startHour,
      endHour,
      action: ruleAction,
      minRoas: ruleMinRoas,
      reason: ruleReason.trim() || undefined,
    };
    setTimeRules((prev) => [next, ...prev]);
    setRuleReason('');
  };

  const removeTimeRule = (id: string) => {
    setTimeRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const isEditablePlatformCampaign = (campaign: any) => {
    const platform = String(campaign?.platform || '');
    if (platform !== 'Google' && platform !== 'Meta' && platform !== 'TikTok') return false;
    const idValue = String(campaign?.campaignId || campaign?.id || '').trim();
    if (!idValue) return false;
    if (idValue.startsWith('local-') || idValue.startsWith('live-')) return false;
    return true;
  };

  const openEditCampaign = (campaign: any) => {
    const platform = String(campaign?.platform || '') as PlatformName;
    const campaignId = String(campaign?.campaignId || campaign?.id || '').trim();
    if (!campaignId || !isEditablePlatformCampaign(campaign)) {
      setEditMessage(text.editNotAvailable);
      return;
    }
    const normalizedStatus = normalizeCampaignStatus(campaign?.status);
    const status: EditableStatus = normalizedStatus === 'Paused' ? 'Paused' : 'Active';
    setEditMessage(null);
    setEditingCampaign({
      rowKey: `${platform}-${campaignId}`,
      platform,
      campaignId,
      name: String(campaign?.name || '').trim(),
      status,
      dailyBudget: toAmount(campaign?.budget) > 0 ? String(toAmount(campaign?.budget)) : '',
    });
  };

  const closeEditCampaign = () => {
    setEditingCampaign(null);
    setEditLoading(false);
  };

  const saveEditedCampaign = async () => {
    if (!editingCampaign) return;
    const trimmedName = editingCampaign.name.trim();
    if (!trimmedName) {
      setEditMessage(text.requireFields);
      return;
    }
    setEditLoading(true);
    setEditMessage(null);
    try {
      await ensureManagedApiSession();
      const parsedBudget = Number(editingCampaign.dailyBudget);
      const dailyBudget =
        editingCampaign.dailyBudget.trim().length > 0 && Number.isFinite(parsedBudget) && parsedBudget >= 0
          ? parsedBudget
          : null;
      const response = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          platform: editingCampaign.platform,
          campaignId: editingCampaign.campaignId,
          name: trimmedName,
          status: editingCampaign.status,
          dailyBudget,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || text.updateFailed);
      }

      const updateRow = (row: any) => {
        const rowId = String(row?.campaignId || row?.id || '').trim();
        const samePlatform = String(row?.platform || '') === editingCampaign.platform;
        if (!samePlatform || rowId !== editingCampaign.campaignId) return row;
        return {
          ...row,
          name: trimmedName,
          status: editingCampaign.status,
          budget: dailyBudget != null ? dailyBudget : row?.budget,
        };
      };

      setRealCampaigns((prev) => prev.map(updateRow));
      setCreatedCampaigns((prev) => prev.map(updateRow));
      setEditMessage(payload?.message || text.updateSuccess);
      setTimeout(() => {
        setEditingCampaign(null);
      }, 250);
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : text.updateFailed);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAutoAudienceAndStrategy = async () => {
    setBuilderMessage(null);
    setAiAudienceLoading(true);
    try {
      const aiKeys = getAIKeysFromConnections(connections);
      if (!hasAnyAIKey(aiKeys)) {
        setBuilderMessage(text.aiMissing);
        return;
      }
      const responseLanguage =
        language === 'he'
          ? 'Hebrew'
          : language === 'ru'
          ? 'Russian'
          : language === 'pt'
          ? 'Portuguese'
          : language === 'fr'
          ? 'French'
          : 'English';

      const platformTextRules = {
        Google: {
          titleMax: 30,
          descriptionMax: 90,
          note: 'Search-style short headline and concise value description.',
        },
        Meta: {
          titleMax: 40,
          descriptionMax: 125,
          note: 'Feed/Reels style hook headline and conversational primary text.',
        },
        TikTok: {
          titleMax: 40,
          descriptionMax: 100,
          note: 'Short hook and mobile-first caption style.',
        },
      };

      const wooContext = isWooConnected && useWooProductData
        ? {
            publishScope: wooPublishScope,
            category: selectedWooCategory || null,
            product:
              wooPublishScope === 'product' && selectedWooProduct
                ? {
                    id: selectedWooProduct.id,
                    name: selectedWooProduct.name,
                    categories: selectedWooProduct.categories,
                    price: selectedWooProduct.price || null,
                    shortDescription: selectedWooProduct.shortDescription || null,
                    description: selectedWooProduct.description || null,
                    sku: selectedWooProduct.sku || null,
                    stockQuantity: selectedWooProduct.stockQuantity ?? null,
                  }
                : null,
          }
        : null;

      const fallbackTitle = shortTitleInput.trim() || inferredWooTitle || campaignNameInput.trim();

      const contextPayload = {
        shortTitle: fallbackTitle,
        currentForm: {
          campaignNameInput,
          objective,
          contentType,
          productType,
          serviceTypeInput,
          campaignBrief,
        },
        connectedPlatforms: connectedAdPlatforms,
        selectedPlatforms,
        campaignData: realCampaigns.slice(0, 120),
        wooContext,
        platformTextRules,
      };

      const [strategyResult, audienceResult] = await Promise.all([
        getCampaignBuilderSuggestions(JSON.stringify(contextPayload), aiKeys, responseLanguage),
        getAudienceRecommendations(JSON.stringify(contextPayload), aiKeys),
      ]);

      setAiAudienceProvider('AI');

      if (strategyResult?.shortTitle) {
        setShortTitleInput(String(strategyResult.shortTitle).trim());
      } else if (!shortTitleInput.trim() && inferredWooTitle) {
        setShortTitleInput(inferredWooTitle);
      }
      if (strategyResult?.campaignName) setCampaignNameInput(strategyResult.campaignName);
      if (
        strategyResult?.objective &&
        ['sales', 'traffic', 'leads', 'awareness', 'retargeting'].includes(strategyResult.objective)
      ) {
        setObjective(strategyResult.objective);
      }
      if (
        strategyResult?.contentType &&
        ['product', 'offer', 'educational', 'testimonial', 'video'].includes(strategyResult.contentType)
      ) {
        setContentType(strategyResult.contentType);
      }
      if (
        strategyResult?.productType &&
        ['fashion', 'beauty', 'tech', 'home', 'fitness', 'services', 'other'].includes(strategyResult.productType)
      ) {
        setProductType(strategyResult.productType);
      }
      if (strategyResult?.serviceType) setServiceTypeInput(strategyResult.serviceType);

      const nextPlatformCopy: Partial<Record<PlatformName, PlatformCopyDraft>> = {};
      (['Google', 'Meta', 'TikTok'] as const).forEach((platform) => {
        const item = strategyResult?.platformCopy?.[platform];
        if (!item) return;
        nextPlatformCopy[platform] = {
          title: String(item.title || '').trim(),
          description: String(item.description || '').trim(),
        };
      });
      if (Object.keys(nextPlatformCopy).length > 0) {
        setPlatformCopyDrafts(nextPlatformCopy);
        const primaryPlatform = (selectedPlatforms[0] || 'Google') as PlatformName;
        const primaryCopy = nextPlatformCopy[primaryPlatform] || nextPlatformCopy.Google || null;
        if (primaryCopy) {
          if (primaryCopy.title) setCampaignNameInput(primaryCopy.title);
          if (primaryCopy.description) setCampaignBrief(primaryCopy.description);
        }
      } else {
        setPlatformCopyDrafts({});
      }

      const strategyAudiences = Array.isArray(strategyResult?.audiences)
        ? strategyResult.audiences.map((value) => String(value).trim()).filter(Boolean)
        : [];
      const aiAudienceNames =
        Array.isArray(audienceResult?.recommendations) && audienceResult.recommendations.length > 0
          ? audienceResult.recommendations
              .map((item) => String(item?.suggestedName || item?.title || '').trim())
              .filter(Boolean)
          : [];
      const mergedAudienceNames = [...new Set([...strategyAudiences, ...aiAudienceNames])];
      if (mergedAudienceNames.length > 0) {
        setAiGeneratedAudienceNames(mergedAudienceNames);
        setSelectedAudiences((prev) => [...new Set([...prev, ...mergedAudienceNames])]);
      }

      const recommendedHoursByPlatform = strategyResult?.recommendedHoursByPlatform || {};
      const sanitizedHourMap: Record<string, number[]> = {};
      (Object.keys(recommendedHoursByPlatform) as Array<'Google' | 'Meta' | 'TikTok'>).forEach((platform) => {
        const raw = Array.isArray(recommendedHoursByPlatform[platform])
          ? recommendedHoursByPlatform[platform]
          : [];
        sanitizedHourMap[platform] = sanitizeHours(raw.map((hour) => Number(hour)));
      });
      setAiRecommendedHoursByPlatform(sanitizedHourMap);
      if (Object.keys(sanitizedHourMap).length > 0) {
        setWeeklySchedule((prev) => {
          const next: WeeklySchedule = { ...prev };
          Object.entries(sanitizedHourMap).forEach(([platform, hours]) => {
            if (!next[platform]) next[platform] = createEmptyDaySchedule();
            DAY_KEYS.forEach((day) => {
              next[platform][day] = hours;
            });
          });
          return next;
        });
      }

      if (Array.isArray(strategyResult?.targetingRules) && strategyResult.targetingRules.length > 0) {
        const aiRules: TimeRule[] = strategyResult.targetingRules
          .map((rule, index) => {
            const platform = String(rule.platform || '').trim();
            if (!['Google', 'Meta', 'TikTok'].includes(platform)) return null;
            const startHour = normalizeHour(Number(rule.startHour));
            const endHour = normalizeHour(Number(rule.endHour));
            if (endHour <= startHour) return null;
            const action: RuleAction =
              rule.action === 'boost' || rule.action === 'limit' || rule.action === 'pause'
                ? rule.action
                : 'boost';
            return {
              id: `ai-rule-${Date.now()}-${index}`,
              platform: platform as PlatformName,
              startHour,
              endHour,
              action,
              minRoas: toAmount(rule.minRoas) || 2,
              reason: rule.reason ? String(rule.reason) : undefined,
            };
          })
          .filter(Boolean) as TimeRule[];
        if (aiRules.length > 0) {
          setTimeRules((prev) => [...aiRules, ...prev]);
        }
      }
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setAiAudienceLoading(false);
    }
  };

  const applyPlatformCopyToFields = (platform: PlatformName) => {
    const draft = platformCopyDrafts[platform];
    if (!draft) return;
    if (draft.title) setCampaignNameInput(draft.title);
    if (draft.description) setCampaignBrief(draft.description);
  };

  const buildLocalPlatformCopyDrafts = (): Partial<Record<PlatformName, PlatformCopyDraft>> => {
    const platforms = (selectedPlatforms.filter((p): p is PlatformName =>
      p === 'Google' || p === 'Meta' || p === 'TikTok'
    ) as PlatformName[]);
    const activePlatforms = platforms.length > 0 ? platforms : ['Google'];
    const baseTitle = shortTitleInput.trim() || campaignNameInput.trim();
    const baseDescription = campaignBrief.trim() || serviceTypeInput.trim();
    const trimByLength = (value: string, max: number) =>
      value.length > max ? `${value.slice(0, Math.max(0, max - 1)).trim()}…` : value;
    const drafts: Partial<Record<PlatformName, PlatformCopyDraft>> = {};

    activePlatforms.forEach((platform) => {
      if (platform === 'Google') {
        drafts.Google = {
          title: trimByLength(baseTitle || 'Google Ad', 30),
          description: trimByLength(baseDescription || 'High-intent ad copy for search traffic.', 90),
        };
      }
      if (platform === 'Meta') {
        drafts.Meta = {
          title: trimByLength(baseTitle || 'Meta Ad', 40),
          description: trimByLength(
            baseDescription || 'Engaging social-first primary text for Meta placements.',
            125
          ),
        };
      }
      if (platform === 'TikTok') {
        drafts.TikTok = {
          title: trimByLength(baseTitle || 'TikTok Ad', 40),
          description: trimByLength(
            baseDescription || 'Short hook-focused caption for TikTok audiences.',
            100
          ),
        };
      }
    });

    return drafts;
  };

  const handleGeneratePlatformAdCopies = async () => {
    setBuilderMessage(null);
    setAiAudienceLoading(true);
    try {
      if (!shortTitleInput.trim() && !campaignNameInput.trim()) {
        setBuilderMessage(text.requireFields);
        return;
      }
      const aiKeys = getAIKeysFromConnections(connections);
      if (!hasAnyAIKey(aiKeys)) {
        const fallbackDrafts = buildLocalPlatformCopyDrafts();
        setPlatformCopyDrafts(fallbackDrafts);
        setBuilderMessage(
          isHebrew
            ? 'אין חיבור AI פעיל, נוצרו מודעות מותאמות לפי כללי פלטפורמה מקומיים.'
            : 'No active AI connection. Platform-fit ads were generated using local rules.'
        );
        return;
      }

      const responseLanguage =
        language === 'he'
          ? 'Hebrew'
          : language === 'ru'
          ? 'Russian'
          : language === 'pt'
          ? 'Portuguese'
          : language === 'fr'
          ? 'French'
          : 'English';
      const contextPayload = {
        shortTitle: shortTitleInput.trim() || campaignNameInput.trim(),
        currentForm: {
          campaignNameInput,
          objective,
          contentType,
          productType,
          serviceTypeInput,
          campaignBrief,
        },
        connectedPlatforms: connectedAdPlatforms,
        selectedPlatforms,
      };
      const strategyResult = await getCampaignBuilderSuggestions(
        JSON.stringify(contextPayload),
        aiKeys,
        responseLanguage
      );
      const nextPlatformCopy: Partial<Record<PlatformName, PlatformCopyDraft>> = {};
      (['Google', 'Meta', 'TikTok'] as const).forEach((platform) => {
        const item = strategyResult?.platformCopy?.[platform];
        if (!item) return;
        nextPlatformCopy[platform] = {
          title: String(item.title || '').trim(),
          description: String(item.description || '').trim(),
        };
      });
      if (Object.keys(nextPlatformCopy).length > 0) {
        setPlatformCopyDrafts(nextPlatformCopy);
      } else {
        const fallbackDrafts = buildLocalPlatformCopyDrafts();
        setPlatformCopyDrafts(fallbackDrafts);
      }
    } catch (error) {
      setBuilderMessage(
        error instanceof Error ? error.message : isHebrew ? 'יצירת מודעות נכשלה.' : 'Ad generation failed.'
      );
    } finally {
      setAiAudienceLoading(false);
    }
  };

  const handleCreateScheduledCampaign = async () => {
    setBuilderMessage(null);
    setPublishResults([]);
    if (!campaignNameInput.trim() || selectedPlatforms.length === 0) {
      setBuilderMessage(text.requireFields);
      return;
    }
    if (uploadedAssets.length === 0) {
      setBuilderMessage(text.requireAsset);
      return;
    }
    if (useWooProductData && isWooConnected && wooProducts.length > 0) {
      if (wooPublishScope === 'category' && !selectedWooCategory) {
        setBuilderMessage(text.wooRequireTarget);
        return;
      }
      if (wooPublishScope === 'product' && !selectedWooProductId) {
        setBuilderMessage(text.wooRequireTarget);
        return;
      }
    }

    setIsCreatingCampaign(true);
    const mediaCount = uploadedAssets.length;
    try {
      await ensureManagedApiSession();
      const response = await fetch('/api/campaigns/scheduled', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          campaignName: campaignNameInput.trim(),
          shortTitle: shortTitleInput.trim(),
          objective,
          contentType,
          productType,
          serviceType: serviceTypeInput.trim(),
          brief: campaignBrief.trim(),
          platforms: selectedPlatforms,
          audiences: selectedAudiences,
          timeRules,
          weeklySchedule,
          wooPublishMode: isWooConnected && useWooProductData ? wooPublishScope : null,
          wooCategory:
            isWooConnected && useWooProductData && wooPublishScope === 'category'
              ? selectedWooCategory || null
              : null,
          wooProductId:
            isWooConnected && useWooProductData && wooPublishScope === 'product'
              ? selectedWooProductId || null
              : null,
          wooProductName:
            isWooConnected && useWooProductData && wooPublishScope === 'product'
              ? selectedWooProduct?.name || null
              : null,
          platformCopyDrafts,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message ||
            (isHebrew
              ? `יצירת קמפיין נכשלה (קוד ${response.status}).`
              : `Campaign creation failed (status ${response.status}).`)
        );
      }
      const results = Array.isArray(payload?.results) ? payload.results : [];
      if (results.length === 0 && payload?.success !== true) {
        throw new Error(
          payload?.message ||
            (isHebrew
              ? 'לא התקבלו תוצאות יצירה מהשרת. בדוק חיבורים ונסה שוב.'
              : 'No campaign creation results were returned by the server. Check your connections and retry.')
        );
      }
      setPublishResults(results);

      const created = selectedPlatforms.map((platform) => {
        const activeHours = getActiveSlotsCount(platform);
        const platformResult = results.find((item: any) => String(item?.platform || '') === platform);
        return {
          id: `live-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: campaignNameInput.trim(),
          platform,
          status:
            platformResult?.ok === true
              ? activeHours > 0
                ? 'Scheduled'
                : 'Draft'
              : 'Error',
          spend: 0,
          roas: 0,
          cpa: 0,
          objective,
          brief: campaignBrief.trim(),
          audiences: selectedAudiences,
          mediaCount,
          wooPublishMode: isWooConnected && useWooProductData ? wooPublishScope : null,
          wooCategory:
            isWooConnected && useWooProductData && wooPublishScope === 'category'
              ? selectedWooCategory || null
              : null,
          wooProductName:
            isWooConnected && useWooProductData && wooPublishScope === 'product'
              ? selectedWooProduct?.name || null
              : null,
        };
      });
      setCreatedCampaigns((prev) => [...created, ...prev]);

      const successCount = results.filter((item: any) => item?.ok).length;
      setBuilderMessage(
        successCount === selectedPlatforms.length
          ? text.publishedOk
          : successCount > 0
            ? text.publishedPartial
            : payload?.message || text.publishedPartial
      );

      setCampaignNameInput('');
      setShortTitleInput('');
      setCampaignBrief('');
      setSelectedAudiences([]);
      setAiGeneratedAudienceNames([]);
      setPlatformCopyDrafts({});
      setTimeRules([]);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : 'Failed to create scheduled campaign.');
    } finally {
      // Privacy-safe behavior: remove uploaded media after publish submission attempt.
      clearUploadedMedia();
      setIsCreatingCampaign(false);
    }
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
      const campaignName = String(campaign?.name || campaign?.campaignName || '');
      const campaignPlatform = String(campaign?.platform || '');
      const matchesSearch = campaignName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = platformFilter === 'All' || campaignPlatform === platformFilter;
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
          {editMessage && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              {editMessage}
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
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{text.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredAndSortedCampaigns.map((campaign, index) => {
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
                      const canEdit = isEditablePlatformCampaign(campaign);

                      return (
                        <tr
                          key={`campaign-row-${platform}-${String(campaign?.campaignId || campaign?.id || campaign?.name || index)}`}
                        >
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                            <div className="max-w-[220px] truncate" title={String(campaign?.name || campaign?.campaignName || '')}>
                              {campaign?.name || campaign?.campaignName || (isHebrew ? 'ללא שם' : 'Unnamed')}
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
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEditCampaign(campaign)}
                              title={!canEdit ? text.editNotAvailable : text.editCampaign}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold',
                                canEdit
                                  ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              )}
                            >
                              <Pencil className="w-3 h-3" />
                              {text.editCampaign}
                            </button>
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
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              {text.smartWindowTitle}
            </h4>
            <p className="text-xs text-indigo-700 mb-3">{text.smartWindowSubtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-start">
              <input
                value={shortTitleInput}
                onChange={(e) => setShortTitleInput(e.target.value)}
                className="w-full rounded-md border-indigo-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'למשל: קמפיין אביב למוצר חדש' : 'e.g. Spring launch for new product'}
              />
              <button
                type="button"
                onClick={handleAutoAudienceAndStrategy}
                disabled={aiAudienceLoading || !shortTitleInput.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {aiAudienceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {text.analyzeWithAi}
              </button>
              <button
                type="button"
                onClick={handleGeneratePlatformAdCopies}
                disabled={aiAudienceLoading || (!shortTitleInput.trim() && !campaignNameInput.trim())}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-indigo-300 bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 disabled:opacity-50"
              >
                {aiAudienceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {text.analyzePlatformAds}
              </button>
            </div>
            {aiAudienceProvider && (
              <p className="mt-2 text-[11px] text-indigo-700">
                {text.aiAudienceFromConnections} · {aiAudienceProvider}
              </p>
            )}
          </div>
          {Object.keys(platformCopyDrafts).length > 0 && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <h4 className="text-sm font-bold text-violet-900 mb-1">{text.platformCopyTitle}</h4>
              <p className="text-xs text-violet-700 mb-3">{text.platformCopySubtitle}</p>
              <div className="space-y-3">
                {(['Google', 'Meta', 'TikTok'] as const)
                  .filter((platform) => Boolean(platformCopyDrafts[platform]))
                  .map((platform) => {
                    const draft = platformCopyDrafts[platform] as PlatformCopyDraft;
                    return (
                      <div key={`platform-copy-${platform}`} className="rounded-lg border border-violet-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-bold text-violet-900">{platform}</p>
                          <button
                            type="button"
                            onClick={() => applyPlatformCopyToFields(platform)}
                            className="inline-flex items-center rounded-md border border-violet-300 px-2 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                          >
                            {text.applyPlatformCopy}
                          </button>
                        </div>
                        <input
                          value={draft.title}
                          onChange={(e) =>
                            setPlatformCopyDrafts((prev) => ({
                              ...prev,
                              [platform]: {
                                ...(prev[platform] || { title: '', description: '' }),
                                title: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs mb-2"
                          placeholder={isHebrew ? 'כותרת מותאמת פלטפורמה' : 'Platform title'}
                        />
                        <textarea
                          value={draft.description}
                          onChange={(e) =>
                            setPlatformCopyDrafts((prev) => ({
                              ...prev,
                              [platform]: {
                                ...(prev[platform] || { title: '', description: '' }),
                                description: e.target.value,
                              },
                            }))
                          }
                          rows={2}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                          placeholder={isHebrew ? 'תיאור מותאם פלטפורמה' : 'Platform description'}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.serviceType}</label>
              <input
                value={serviceTypeInput}
                onChange={(e) => setServiceTypeInput(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'לדוגמה: שירות פרימיום לעסקים' : 'e.g. Premium service for SMBs'}
              />
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
            {useWooProductData && wooPublishScope === 'product' && selectedWooProduct && (
              <p className="mt-1 text-[11px] text-sky-700">{text.wooAutoDescriptionHint}</p>
            )}
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
            <h4 className="text-sm font-bold text-sky-900 mb-1">{text.wooPublishTitle}</h4>
            <p className="text-xs text-sky-700 mb-3">{text.wooPublishSubtitle}</p>
            <div className="mb-3 rounded-md border border-sky-200 bg-white px-3 py-2.5">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-sky-900 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                  checked={useWooProductData}
                  onChange={(e) => setUseWooProductData(e.target.checked)}
                />
                {text.wooOptionalModeTitle}
              </label>
              <p className="mt-1 text-[11px] text-sky-700">{text.wooOptionalModeDesc}</p>
              {!useWooProductData && (
                <p className="mt-1 text-[11px] text-emerald-700">{text.wooManualModeActive}</p>
              )}
            </div>
            {!useWooProductData ? null : !isWooConnected ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {text.wooNotConnected}
              </p>
            ) : wooLoading ? (
              <div className="flex items-center gap-2 text-xs text-sky-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {text.wooLoading}
              </div>
            ) : wooProducts.length === 0 ? (
              <p className="text-xs text-gray-600">{text.wooNoProducts}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{text.wooScope}</label>
                  <select
                    value={wooPublishScope}
                    onChange={(e) => setWooPublishScope(e.target.value as WooPublishScope)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  >
                    <option value="category">{text.wooByCategory}</option>
                    <option value="product">{text.wooByProduct}</option>
                  </select>
                </div>

                {wooPublishScope === 'category' ? (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">{text.wooCategory}</label>
                    <select
                      value={selectedWooCategory}
                      onChange={(e) => setSelectedWooCategory(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    >
                      {!selectedWooCategory && <option value="">{text.wooChooseCategory}</option>}
                      {wooCategoryOptions.map((category) => (
                        <option key={`woo-category-${category}`} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">{text.wooProduct}</label>
                    <select
                      value={selectedWooProductId}
                      onChange={(e) => setSelectedWooProductId(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    >
                      {!selectedWooProductId && <option value="">{text.wooChooseProduct}</option>}
                      {wooProductsFiltered.map((product) => (
                        <option key={`woo-product-${product.id}`} value={String(product.id)}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    {selectedWooProduct && (
                      <div className="mt-2 rounded-md border border-sky-200 bg-white p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-sky-900 truncate" title={selectedWooProduct.name}>
                            {selectedWooProduct.name}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              importWooProductToBuilder(selectedWooProduct, {
                                overwriteExisting: true,
                                notify: true,
                              })
                            }
                            className="inline-flex items-center rounded-md border border-sky-300 px-2 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-50"
                          >
                            {text.wooImportProduct}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-600 line-clamp-3">
                          {selectedWooProduct.shortDescription ||
                            selectedWooProduct.description ||
                            selectedWooProduct.categories.join(', ') ||
                            selectedWooProduct.price ||
                            ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
            <p className="text-[11px] text-gray-500 mb-2">
              {isHebrew
                ? `תנאי התאמה נוכחיים: תמונה עד ${effectiveMediaLimits.imageMaxMb}MB, וידאו עד ${effectiveMediaLimits.videoMaxMb}MB, מקסימום ${effectiveMediaLimits.maxImageWidth}×${effectiveMediaLimits.maxImageHeight}.`
                : `Current compatibility limits: image up to ${effectiveMediaLimits.imageMaxMb}MB, video up to ${effectiveMediaLimits.videoMaxMb}MB, max ${effectiveMediaLimits.maxImageWidth}×${effectiveMediaLimits.maxImageHeight}.`}
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              {text.uploadButton}
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleAssetUpload} />
            </label>
            <p className="mt-2 text-[11px] text-gray-500">{text.noDataPersistenceNote}</p>
            {uploadedAssets.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {uploadedAssets.map((asset) => (
                  <div key={asset.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {asset.mediaType === 'video' ? (
                      <video src={asset.previewUrl} className="h-20 w-full object-cover" controls muted />
                    ) : (
                      <img src={asset.previewUrl} alt={asset.name} className="h-20 w-full object-cover" />
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-gray-600 truncate flex items-center gap-1">
                        {asset.mediaType === 'video' ? <Video className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
                        {asset.name}
                      </p>
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
                    {(aiRecommendedHoursByPlatform[platform] || []).length > 0 ? (
                      <span className="text-amber-800">
                        {(aiRecommendedHoursByPlatform[platform] || []).map((hour) => formatHour(hour)).join(' · ')}
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        {isHebrew ? 'אין מספיק נתוני שעות להמלצה כרגע.' : 'Not enough hourly data for recommendation yet.'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                <select
                  value={rulePlatform}
                  onChange={(e) => setRulePlatform(e.target.value as PlatformName)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {connectedAdPlatforms.map((platform) => (
                    <option key={`rule-${platform}`} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleStartHour}
                  onChange={(e) => setRuleStartHour(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {hourOptions.map((hour) => (
                    <option key={`start-${hour}`} value={hour}>
                      {isHebrew ? 'מתחיל' : 'Start'} {formatHour(hour)}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleEndHour}
                  onChange={(e) => setRuleEndHour(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {hourOptions.map((hour) => (
                    <option key={`end-${hour}`} value={hour}>
                      {isHebrew ? 'מסתיים' : 'End'} {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                </div>
                <input
                  value={ruleReason}
                  onChange={(e) => setRuleReason(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                  placeholder={isHebrew ? 'סיבה/הערה לחוק' : 'Rule reason / note'}
                />
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={addTimeRule}
                  className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                >
                  {text.addRule}
                </button>
              </div>
              {timeRules.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {timeRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between rounded-md bg-white border border-amber-100 px-2 py-1.5 text-xs">
                      <span>
                        <strong>{rule.platform}</strong> · {formatHourRange(rule.startHour, rule.endHour)} ·{' '}
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
                        {rule.reason ? ` · ${rule.reason}` : ''}
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
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {DAY_KEYS.map((day) => (
                      <button
                        key={`day-tab-${day}`}
                        type="button"
                        onClick={() => setSelectedScheduleDay(day)}
                        className={cn(
                          'px-2 py-1 rounded-md text-[11px] font-bold border',
                          selectedScheduleDay === day
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        )}
                      >
                        {dayLabels[day]}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleFullDay(selectedSchedulePlatform, selectedScheduleDay)}
                      className={cn(
                        'inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold',
                        isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100'
                          : 'border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50'
                      )}
                    >
                      {isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                        ? text.unmarkFullDay
                        : text.markFullDay}
                    </button>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-1.5">
                    {hourOptions.map((hour) => {
                      const active =
                        weeklySchedule[selectedSchedulePlatform]?.[selectedScheduleDay]?.includes(hour) || false;
                      return (
                        <button
                          key={`${selectedSchedulePlatform}-${selectedScheduleDay}-${hour}`}
                          type="button"
                          onClick={() => toggleScheduleHour(selectedSchedulePlatform, selectedScheduleDay, hour)}
                          className={cn(
                            'px-2 py-1 rounded-md border text-[10px] font-semibold',
                            active
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          )}
                        >
                          {formatHour(hour)}
                        </button>
                      );
                    })}
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
              disabled={selectedPlatforms.length === 0 || isCreatingCampaign}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreatingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {isCreatingCampaign ? text.creatingLiveCampaigns : text.createDraft}
            </button>
          </div>

          {publishResults.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1.5">
              {publishResults.map((result, index) => (
                <div key={`publish-${result.platform}-${index}`} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className={cn('font-bold', result.ok ? 'text-emerald-700' : 'text-rose-700')}>
                      {result.platform}
                    </span>{' '}
                    <span className="text-gray-600">{result.message}</span>
                  </div>
                  {result.campaignId && (
                    <span className="text-[11px] text-gray-500" dir="ltr">
                      #{result.campaignId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

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

      {editingCampaign && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">{text.editCampaign}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{text.editCampaignSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={closeEditCampaign}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{text.editName}</label>
                <input
                  value={editingCampaign.name}
                  onChange={(e) =>
                    setEditingCampaign((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{text.editStatus}</label>
                <select
                  value={editingCampaign.status}
                  onChange={(e) =>
                    setEditingCampaign((prev) =>
                      prev ? { ...prev, status: e.target.value as EditableStatus } : prev
                    )
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="Active">{isHebrew ? 'פעיל' : 'Active'}</option>
                  <option value="Paused">{isHebrew ? 'מושהה' : 'Paused'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">{text.editBudget}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editingCampaign.dailyBudget}
                  onChange={(e) =>
                    setEditingCampaign((prev) => (prev ? { ...prev, dailyBudget: e.target.value } : prev))
                  }
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  placeholder={isHebrew ? 'למשל 250' : 'e.g. 250'}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeEditCampaign}
                  className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  {text.cancel}
                </button>
                <button
                  type="button"
                  onClick={saveEditedCampaign}
                  disabled={editLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  {editLoading ? text.saving : text.saveChanges}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

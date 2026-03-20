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
  Eye,
  Video,
  Pencil,
  X,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { OneClickWizard } from '../components/campaigns/OneClickWizard';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import { fetchMetaCampaigns, fetchMetaAdsets, isMetaRateLimitMessage, type MetaAdset } from '../services/metaService';
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
import {
  type ContentType,
  type ProductType,
  type ObjectiveType,
  type DayKey,
  type RuleAction,
  type PlatformName,
  type UploadedAsset,
  type TimeRule,
  type DayHours,
  type WeeklySchedule,
  type MediaLimits,
  type EditableStatus,
  type EditCampaignDraft,
  type WooCampaignProduct,
  type WooPublishScope,
  type PlatformCopyDraft,
  DAY_KEYS,
  PLATFORM_MEDIA_LIMITS,
  SMART_AUDIENCE_BY_CONTENT,
  SMART_AUDIENCE_BY_PRODUCT,
  SMART_AUDIENCE_BY_OBJECTIVE,
  createEmptyDaySchedule,
  stripHtmlToText,
} from './campaigns/types';
import {
  toAmount,
  normalizeCampaignStatus,
  getStatusBadgeClass,
  formatPercent,
  hasMetaMetrics,
  hasGoogleMetrics,
  mergePlatformCampaignsPreferRich,
} from './campaigns/utils';
import { CampaignEditModal } from './campaigns/CampaignEditModal';
import { RecommendationsPanel } from './campaigns/RecommendationsPanel';

const mockCampaignData = [
  { id: 1, name: 'Summer Sale - Shoes', platform: 'Google', status: 'Active', spend: 1200, roas: 2.5, cpa: 45 },
  { id: 2, name: 'Retargeting - Abandoned Cart', platform: 'Meta', status: 'Active', spend: 800, roas: 4.2, cpa: 22 },
  { id: 3, name: 'New Collection - Video', platform: 'TikTok', status: 'Paused', spend: 400, roas: 1.1, cpa: 85 },
  { id: 4, name: 'Brand Search', platform: 'Google', status: 'Active', spend: 300, roas: 8.5, cpa: 12 },
];

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
    createSmartAd: isHebrew ? 'צור מודעה חכמה' : 'Create smart ad',
    smartAdRunning: isHebrew ? 'AI מעבד את המודעה...' : 'AI is processing the ad...',
    smartAdDuration: isHebrew ? 'זמן עיבוד' : 'Processing time',
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
    editApplyAds: isHebrew ? 'עדכן גם מודעות קיימות בקמפיין' : 'Also update existing ads in this campaign',
    editApplyAdsHint: isHebrew
      ? 'מעדכן סטטוס מודעות קיימות באותו קמפיין בפלטפורמה.'
      : 'Updates the status of existing ads under the same campaign on this platform.',
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
    wooImportInSmartWindow: isHebrew ? 'ייבוא מוצר ל‑AI מתוך WooCommerce' : 'Import WooCommerce product into AI',
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
    goToBuilder: isHebrew ? 'מעבר ליצירת מודעה' : 'Go to ad creation',
    applyPlatformCopy: isHebrew ? 'החל לשדות הקמפיין' : 'Apply to campaign fields',
    adPreview: isHebrew ? 'תצוגה מקדימה' : 'Ad preview',
    charLimit: isHebrew ? 'תווים' : 'chars',
    fromCreativeLab: isHebrew ? 'יובא ממעבדת היצירה' : 'Imported from Creative Lab',
    applyPlatformCopyDone: isHebrew ? 'טיוטת הפלטפורמה הוחלה על שדות הקמפיין.' : 'Platform draft applied to campaign fields.',
    disableWooImport: isHebrew ? 'בטל ייבוא Woo ועבור להזנה ידנית' : 'Disable Woo import and switch to manual input',
    manualTextMode: isHebrew ? 'מצב עריכה ידני' : 'Manual editing mode',
    wooTextMode: isHebrew ? 'מצב טקסט ממוצר Woo' : 'Woo product-assisted text mode',
    previewTitle: isHebrew ? 'תצוגה מקדימה לפני פרסום' : 'Pre-publish preview',
    previewSubtitle: isHebrew
      ? 'כך המודעה תיראה לפי כל פלטפורמה על בסיס הנתונים שמילאת.'
      : 'How your ad will look per platform based on entered data.',
    previewDataTitle: isHebrew ? 'נתונים שייכנסו לפרסום' : 'Publishing payload summary',
    previewObjective: isHebrew ? 'מטרה' : 'Objective',
    previewPlatforms: isHebrew ? 'פלטפורמות לפרסום' : 'Platforms to publish',
    previewMedia: isHebrew ? 'מדיה' : 'Media',
    previewAudiences: isHebrew ? 'קהלים' : 'Audiences',
    previewSchedule: isHebrew ? 'שעות פעילות' : 'Scheduled active slots',
    previewNoText: isHebrew ? 'אין עדיין טקסט. הזן כותרת ותיאור.' : 'No text yet. Enter title and description.',
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
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [adsetsByCampaignId, setAdsetsByCampaignId] = useState<Record<string, MetaAdset[]>>({});
  const [loadingAdsetsCampaignId, setLoadingAdsetsCampaignId] = useState<string | null>(null);
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

  // Read creative-lab prefill on mount (from the "Launch Campaign" button)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('bscale:creative-prefill');
      if (!raw) return;
      sessionStorage.removeItem('bscale:creative-prefill');
      const prefill = JSON.parse(raw) as Record<string, any>;
      if (prefill.campaignName) setCampaignNameInput(prefill.campaignName);
      if (prefill.shortTitle) setShortTitleInput(prefill.shortTitle);
      if (prefill.brief) setCampaignBrief(prefill.brief);
      if (prefill.platformCopy) setPlatformCopyDrafts(prefill.platformCopy);
    } catch {
      // ignore prefill errors
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
  const [smartAdRunStartedAt, setSmartAdRunStartedAt] = useState<number | null>(null);
  const [smartAdElapsedMs, setSmartAdElapsedMs] = useState(0);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [publishResults, setPublishResults] = useState<Array<{ platform: string; ok: boolean; message: string; campaignId?: string }>>([]);
  const [editingCampaign, setEditingCampaign] = useState<EditCampaignDraft | null>(null);
  const [editApplyToAds, setEditApplyToAds] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [oneClickOpen, setOneClickOpen] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [platformCopyDrafts, setPlatformCopyDrafts] = useState<Partial<Record<PlatformName, PlatformCopyDraft>>>({});
  const [selectedCopyPlatform, setSelectedCopyPlatform] = useState<PlatformName>('Google');
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<PlatformName>('Google');
  const [wooProducts, setWooProducts] = useState<WooCampaignProduct[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [useWooProductData, setUseWooProductData] = useState(false);
  const [wooPublishScope, setWooPublishScope] = useState<WooPublishScope>('category');
  const [selectedWooCategory, setSelectedWooCategory] = useState('');
  const [selectedWooProductId, setSelectedWooProductId] = useState<string>('');
  const wooAutoBriefRef = useRef('');
  const builderSectionRef = useRef<HTMLElement | null>(null);
  const shortTitleInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!aiAudienceLoading || !smartAdRunStartedAt) return;
    const intervalId = window.setInterval(() => {
      setSmartAdElapsedMs(Date.now() - smartAdRunStartedAt);
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [aiAudienceLoading, smartAdRunStartedAt]);

  const formatSmartElapsed = (elapsedMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

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

  const draftPlatforms = useMemo(
    () =>
      (['Google', 'Meta', 'TikTok'] as const).filter((platform) =>
        Boolean(platformCopyDrafts[platform])
      ) as PlatformName[],
    [platformCopyDrafts]
  );

  const previewPlatforms = useMemo(() => {
    const base = (selectedPlatforms.length > 0 ? selectedPlatforms : connectedAdPlatforms).filter(
      (platform): platform is PlatformName =>
        platform === 'Google' || platform === 'Meta' || platform === 'TikTok'
    );
    return base.length > 0 ? base : (['Google'] as PlatformName[]);
  }, [connectedAdPlatforms, selectedPlatforms]);

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

  const aiProcessingBrief = useMemo(() => {
    const baseBrief = campaignBrief.trim();
    const productBrief =
      useWooProductData && wooPublishScope === 'product' && selectedWooProduct
        ? buildWooProductBrief(selectedWooProduct)
        : '';
    if (!productBrief) return baseBrief;
    if (!baseBrief) return productBrief;
    if (baseBrief.includes(productBrief)) return baseBrief;
    return `${baseBrief}\n\n${isHebrew ? 'נתוני מוצר מ-WooCommerce:' : 'WooCommerce product data:'}\n${productBrief}`;
  }, [campaignBrief, useWooProductData, wooPublishScope, selectedWooProduct, isHebrew]);

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

    const priceStr = product.price ? ` – ₪${product.price}` : '';
    const titleWithPrice = `${product.name}${priceStr}`.slice(0, 90);
    setContentType('product');
    setShortTitleInput((prev) =>
      overwriteExisting || !prev.trim() ? titleWithPrice : prev
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

  const disableWooImportMode = () => {
    setUseWooProductData(false);
    setBuilderMessage(text.manualTextMode);
    window.setTimeout(() => shortTitleInputRef.current?.focus(), 0);
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
      return filtered.length ? filtered : [...connectedAdPlatforms];
    });
    setSelectedSchedulePlatform((prev) => (connectedAdPlatforms.includes(prev) ? prev : connectedAdPlatforms[0]));
    setRulePlatform((prev) =>
      connectedAdPlatforms.includes(prev)
        ? (prev as PlatformName)
        : ((connectedAdPlatforms[0] || 'Google') as PlatformName)
    );
  }, [connectedAdPlatforms]);

  useEffect(() => {
    if (!draftPlatforms.length) return;
    if (!draftPlatforms.includes(selectedCopyPlatform)) {
      setSelectedCopyPlatform(draftPlatforms[0]);
    }
  }, [draftPlatforms, selectedCopyPlatform]);

  useEffect(() => {
    if (!previewPlatforms.length) return;
    if (!previewPlatforms.includes(selectedPreviewPlatform)) {
      setSelectedPreviewPlatform(previewPlatforms[0]);
    }
  }, [previewPlatforms, selectedPreviewPlatform]);

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

  const toggleCampaignExpand = async (campaign: any) => {
    const campaignId = String(campaign?.campaignId || campaign?.id || '');
    if (!campaignId) return;

    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });

    // Fetch adsets if not already loaded and this is a Meta campaign
    if (String(campaign?.platform || '') === 'Meta' && !adsetsByCampaignId[campaignId]) {
      const metaConn = connections.find((c) => c.id === 'meta');
      const token = metaConn?.settings?.metaToken || 'server-managed';
      const adAccountId = metaConn?.settings?.metaAdsId || metaConn?.settings?.adAccountId || '';
      setLoadingAdsetsCampaignId(campaignId);
      try {
        const adsets = await fetchMetaAdsets(token, adAccountId || undefined, [campaignId], startDateIso, endDateIso);
        setAdsetsByCampaignId((prev) => ({ ...prev, [campaignId]: adsets }));
      } catch (err) {
        console.warn('Failed to fetch adsets for campaign', campaignId, err);
        setAdsetsByCampaignId((prev) => ({ ...prev, [campaignId]: [] }));
      } finally {
        setLoadingAdsetsCampaignId(null);
      }
    }
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
      (await new Promise<import('firebase/auth').User | null>((resolve) => {
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
    setEditApplyToAds(false);
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
    setEditApplyToAds(false);
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
          applyToAds: editApplyToAds,
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
        setEditApplyToAds(false);
      }, 250);
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : text.updateFailed);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAutoAudienceAndStrategy = async () => {
    const runStartedAt = Date.now();
    setBuilderMessage(null);
    setSmartAdRunStartedAt(runStartedAt);
    setSmartAdElapsedMs(0);
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

      const fallbackTitle =
        shortTitleInput.trim() ||
        inferredWooTitle ||
        selectedWooProduct?.name ||
        campaignNameInput.trim();

      const contextPayload = {
        shortTitle: fallbackTitle,
        currentForm: {
          campaignNameInput,
          objective,
          contentType,
          productType,
          serviceTypeInput,
          campaignBrief: aiProcessingBrief,
        },
        connectedPlatforms: connectedAdPlatforms,
        selectedPlatforms,
        campaignData: realCampaigns.slice(0, 120),
        wooContext,
        aiInputText: aiProcessingBrief,
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
      setSmartAdElapsedMs(Date.now() - runStartedAt);
      setAiAudienceLoading(false);
    }
  };

  const applyPlatformCopyToFields = (platform: PlatformName) => {
    const draft = platformCopyDrafts[platform];
    if (!draft) return;
    if (draft.title) {
      setCampaignNameInput(draft.title);
      setShortTitleInput(draft.title);
    }
    if (draft.description) setCampaignBrief(draft.description);
    setSelectedPreviewPlatform(platform);
    setBuilderMessage(text.applyPlatformCopyDone);
  };

  const getPlatformTitleLimit = (platform: PlatformName) => (platform === 'Google' ? 30 : 40);
  const getPlatformDescriptionLimit = (platform: PlatformName) =>
    platform === 'Google' ? 90 : platform === 'Meta' ? 125 : 100;

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
        shortTitle:
          shortTitleInput.trim() || selectedWooProduct?.name || inferredWooTitle || campaignNameInput.trim(),
        currentForm: {
          campaignNameInput,
          objective,
          contentType,
          productType,
          serviceTypeInput,
          campaignBrief: aiProcessingBrief,
        },
        connectedPlatforms: connectedAdPlatforms,
        selectedPlatforms,
        aiInputText: aiProcessingBrief,
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

  const scrollToBuilderSection = () => {
    builderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCreateScheduledCampaign = async () => {
    setBuilderMessage(null);
    setPublishResults([]);
    const resolvedPlatforms = (
      (selectedPlatforms.length > 0 ? selectedPlatforms : connectedAdPlatforms).filter((platform) =>
        connectedAdPlatforms.includes(platform)
      ) as PlatformName[]
    );
    const resolvedCampaignName =
      campaignNameInput.trim() ||
      shortTitleInput.trim() ||
      inferredWooTitle ||
      selectedWooProduct?.name ||
      '';

    if (!resolvedCampaignName || resolvedPlatforms.length === 0) {
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
          campaignName: resolvedCampaignName,
          shortTitle: shortTitleInput.trim(),
          objective,
          contentType,
          productType,
          serviceType: serviceTypeInput.trim(),
          brief: campaignBrief.trim(),
          platforms: resolvedPlatforms,
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

      const created = resolvedPlatforms.map((platform) => {
        const activeHours = getActiveSlotsCount(platform);
        const platformResult = results.find((item: any) => String(item?.platform || '') === platform);
        return {
          id: `live-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: resolvedCampaignName,
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
        successCount === resolvedPlatforms.length
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
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <button
            onClick={() => setOneClickOpen(true)}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Sparkles className="w-4 h-4" />
            {isHebrew ? 'קמפיין בלחיצה אחת' : 'One Click Campaign'}
          </button>
          <button
            onClick={scrollToBuilderSection}
            className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-md shadow-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Target className="w-4 h-4 ml-2" />
            {text.goToBuilder}
          </button>
          <button 
            onClick={fetchRecommendations}
            disabled={loading}
            className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Zap className="w-4 h-4 ml-2" />}
            {t('campaigns.refreshAi')}
          </button>
        </div>
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
                      <th className="px-2 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide w-6"></th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.campaignName')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.platform')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.status')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'סוג / יעד' : 'Type / Obj.'}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Impr.</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Reach</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Clicks</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CTR</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CPC</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CPM</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Freq.</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.spend')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.roas')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.cpa')}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Conv.</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'הכנסה מיוחסת' : 'Conv. Val.'}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'תקציב יומי' : 'Daily Bud.'}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'מקור' : 'Source'}</th>
                      <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{text.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredAndSortedCampaigns.map((campaign, index) => {
                      const unifiedStatus = normalizeCampaignStatus(campaign.status);
                      const platform = String(campaign.platform || '');
                      const campaignRowId = String(campaign?.campaignId || campaign?.id || campaign?.name || index);
                      const isExpanded = expandedCampaigns.has(campaignRowId);
                      const isLoadingAdsets = loadingAdsetsCampaignId === campaignRowId;
                      const campaignAdsets = adsetsByCampaignId[campaignRowId] || [];
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
                      const dailyBudget = toAmount(campaign.dailyBudget);
                      const lifetimeBudget = toAmount(campaign.lifetimeBudget);
                      const displayBudget = dailyBudget > 0 ? dailyBudget : lifetimeBudget > 0 ? lifetimeBudget : 0;

                      return (
                        <React.Fragment key={`campaign-row-${platform}-${campaignRowId}`}>
                          <tr className={cn(isExpanded ? 'bg-indigo-50/30' : '')}>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleCampaignExpand({ ...campaign, campaignId: campaignRowId })}
                                className="text-gray-400 hover:text-indigo-600"
                                title={isExpanded ? (isHebrew ? 'סגור' : 'Collapse') : (isHebrew ? 'פרט קבוצות מודעות' : 'Expand adsets')}
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                              <div className="max-w-[200px] truncate" title={String(campaign?.name || campaign?.campaignName || '')}>
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
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600 max-w-[100px] truncate">{typeOrObjective}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.impressions).toLocaleString()}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.reach) > 0 ? toAmount(campaign.reach).toLocaleString() : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.clicks).toLocaleString()}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{formatPercent(campaign.ctr)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpc) > 0 ? formatCurrency(toAmount(campaign.cpc)) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpm) > 0 ? formatCurrency(toAmount(campaign.cpm)) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.frequency) > 0 ? toAmount(campaign.frequency).toFixed(2) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(toAmount(campaign.spend))}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.roas).toFixed(2)}x</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpa) > 0 ? formatCurrency(toAmount(campaign.cpa)) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.conversions) > 0 ? toAmount(campaign.conversions).toLocaleString() : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.conversionValue) > 0 ? formatCurrency(toAmount(campaign.conversionValue)) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{displayBudget > 0 ? formatCurrency(displayBudget) : '—'}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                                hasMetrics ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              )}>
                                {hasMetrics ? (isHebrew ? 'חי' : 'Live') : (isHebrew ? 'חסר' : 'No data')}
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
                          {isExpanded && (
                            <tr>
                              <td colSpan={20} className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                                {isLoadingAdsets ? (
                                  <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    {isHebrew ? 'טוען קבוצות מודעות...' : 'Loading ad sets...'}
                                  </div>
                                ) : campaignAdsets.length === 0 ? (
                                  <p className="text-xs text-gray-500 py-1">{isHebrew ? 'אין קבוצות מודעות עם נתונים לתקופה הנבחרת.' : 'No ad sets with data for the selected period.'}</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">{isHebrew ? 'קבוצות מודעות' : 'Ad Sets'} ({campaignAdsets.length})</p>
                                    <table className="min-w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-200">
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'שם קבוצת מודעות' : 'Ad Set Name'}</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'סטטוס' : 'Status'}</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'יעד אופטימיזציה' : 'Optimization'}</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">Impr.</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">Reach</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">Clicks</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">CTR</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPC</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPM</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">Freq.</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'הוצאה' : 'Spend'}</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">ROAS</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPA</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">Conv.</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'הכנסה' : 'Conv. Val.'}</th>
                                          <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'תקציב יומי' : 'Daily Bud.'}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {campaignAdsets.map((adset) => (
                                          <tr key={adset.id} className="border-b border-gray-100 hover:bg-white">
                                            <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[180px] truncate" title={adset.name}>{adset.name}</td>
                                            <td className="px-3 py-1.5">
                                              <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', getStatusBadgeClass(normalizeCampaignStatus(adset.status)))}>
                                                {normalizeCampaignStatus(adset.status)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.optimizationGoal || '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.impressions > 0 ? adset.impressions.toLocaleString() : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.reach > 0 ? adset.reach.toLocaleString() : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.clicks > 0 ? adset.clicks.toLocaleString() : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.ctr > 0 ? `${adset.ctr.toFixed(2)}%` : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.cpc > 0 ? formatCurrency(adset.cpc) : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.cpm > 0 ? formatCurrency(adset.cpm) : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.frequency > 0 ? adset.frequency.toFixed(2) : '—'}</td>
                                            <td className="px-3 py-1.5 font-semibold text-gray-800">{adset.spend > 0 ? formatCurrency(adset.spend) : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.roas > 0 ? `${adset.roas.toFixed(2)}x` : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.cpa > 0 ? formatCurrency(adset.cpa) : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.conversions > 0 ? adset.conversions.toLocaleString() : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.conversionValue > 0 ? formatCurrency(adset.conversionValue) : '—'}</td>
                                            <td className="px-3 py-1.5 text-gray-600">{adset.dailyBudget > 0 ? formatCurrency(adset.dailyBudget) : adset.lifetimeBudget > 0 ? formatCurrency(adset.lifetimeBudget) : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <RecommendationsPanel
        recommendations={recommendations}
        loading={loading}
        appliedRecs={appliedRecs}
        expandedRecs={expandedRecs}
        sendingEmail={sendingEmail}
        onApply={handleApply}
        onToggleExpanded={toggleRecExpanded}
        onSendEmail={handleSendEmail}
        t={t}
      />

      <section ref={builderSectionRef} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-indigo-50/60">
          <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            {text.builderTitle}
          </h3>
          <p className="text-sm text-indigo-200 mt-0.5">{text.builderSubtitle}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-indigo-900">{text.smartWindowTitle}</h4>
                <p className="text-xs text-indigo-600">{text.smartWindowSubtitle}</p>
              </div>
            </div>

            {/* WooCommerce inline strip */}
            {isWooConnected && (
              <div className="mb-3 flex flex-wrap items-center gap-2 bg-sky-50 rounded-xl border border-sky-200 px-3 py-2">
                <ShoppingCart className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="text-xs font-bold text-sky-900">WooCommerce</span>
                <select
                  value={wooPublishScope}
                  onChange={(e) => setWooPublishScope(e.target.value as WooPublishScope)}
                  className="rounded-md border-sky-200 text-xs py-1 bg-white focus:border-sky-400 focus:ring-sky-300"
                >
                  <option value="category">{text.wooByCategory}</option>
                  <option value="product">{text.wooByProduct}</option>
                </select>
                {wooPublishScope === 'category' ? (
                  <select
                    value={selectedWooCategory}
                    onChange={(e) => setSelectedWooCategory(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border-sky-200 text-xs py-1 bg-white focus:border-sky-400 focus:ring-sky-300"
                  >
                    {!selectedWooCategory && <option value="">{text.wooChooseCategory}</option>}
                    {wooCategoryOptions.map((cat) => (
                      <option key={`woo-cat-inline-${cat}`} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedWooProductId}
                    onChange={(e) => setSelectedWooProductId(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border-sky-200 text-xs py-1 bg-white focus:border-sky-400 focus:ring-sky-300"
                  >
                    {!selectedWooProductId && <option value="">{text.wooChooseProduct}</option>}
                    {wooProductsFiltered.map((product) => (
                      <option key={`woo-prod-inline-${product.id}`} value={String(product.id)}>
                        {product.name}{product.price ? ` – ₪${product.price}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedWooProduct?.price && (
                  <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ₪{selectedWooProduct.price}
                  </span>
                )}
                {selectedWooProduct && (
                  <button
                    type="button"
                    onClick={() => importWooProductToBuilder(selectedWooProduct, { overwriteExisting: true, notify: true })}
                    className="shrink-0 text-xs font-bold text-sky-700 bg-white border border-sky-300 rounded-md px-2 py-1 hover:bg-sky-50"
                  >
                    {text.wooImportProduct}
                  </button>
                )}
              </div>
            )}

            {/* Short title with 90-char counter */}
            <div className="relative mb-3">
              <input
                ref={shortTitleInputRef}
                value={shortTitleInput}
                onChange={(e) => setShortTitleInput(e.target.value.slice(0, 90))}
                className={cn(
                  "w-full rounded-xl border shadow-sm focus:ring-2 sm:text-sm py-2.5 px-3 pr-16",
                  shortTitleInput.length >= 85
                    ? "border-amber-300 focus:border-amber-400 focus:ring-amber-200"
                    : "border-indigo-300 focus:border-indigo-400 focus:ring-indigo-200"
                )}
                placeholder={isHebrew ? 'כותרת ראשית עד 90 תווים...' : 'Main title up to 90 chars...'}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoAudienceAndStrategy}
                  disabled={aiAudienceLoading || (!shortTitleInput.trim() && !campaignNameInput.trim())}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiAudienceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {text.createSmartAd}
                </button>
                {useWooProductData && (
                  <button
                    type="button"
                    onClick={disableWooImportMode}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50"
                  >
                    {text.disableWooImport}
                  </button>
                )}
              </div>
            </div>
            {(aiAudienceLoading || smartAdElapsedMs > 0) && (
              <p className="mt-2 text-[11px] text-indigo-700 inline-flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5" />
                {aiAudienceLoading ? text.smartAdRunning : text.smartAdDuration}:{' '}
                <span className="font-bold">{formatSmartElapsed(smartAdElapsedMs)}</span>
              </p>
            )}
            {isWooConnected && (
              <div className="mt-3 rounded-md border border-indigo-200 bg-white px-3 py-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-[11px] font-bold text-indigo-900">{text.wooImportInSmartWindow}</p>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <select
                      value={selectedWooProductId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setUseWooProductData(true);
                        setWooPublishScope('product');
                        setSelectedWooProductId(nextId);
                      }}
                      className="min-w-[210px] rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                      disabled={wooLoading || wooProducts.length === 0}
                    >
                      {!selectedWooProductId && <option value="">{text.wooChooseProduct}</option>}
                      {wooProducts.map((product) => (
                        <option key={`smart-woo-product-${product.id}`} value={String(product.id)}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedWooProduct) return;
                        setUseWooProductData(true);
                        setWooPublishScope('product');
                        importWooProductToBuilder(selectedWooProduct, {
                          overwriteExisting: true,
                          notify: true,
                        });
                      }}
                      disabled={!selectedWooProduct || wooLoading}
                      className="inline-flex items-center rounded-md border border-indigo-300 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    >
                      {text.wooImportProduct}
                    </button>
                    {useWooProductData && (
                      <button
                        type="button"
                        onClick={disableWooImportMode}
                        className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        {text.disableWooImport}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {aiAudienceProvider && (
              <p className="mt-2 text-[11px] text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1">
                {text.aiAudienceFromConnections} · {aiAudienceProvider}
              </p>
            )}
          </div>
          {draftPlatforms.length > 0 && (
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/50 p-4">
              <h4 className="text-sm font-bold text-violet-900 mb-1">{text.platformCopyTitle}</h4>
              <p className="text-xs text-violet-700 mb-3">{text.platformCopySubtitle}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {draftPlatforms.map((platform) => {
                  const selected = selectedCopyPlatform === platform;
                  const titleLength = (platformCopyDrafts[platform]?.title || '').trim().length;
                  const descriptionLength = (platformCopyDrafts[platform]?.description || '').trim().length;
                  return (
                    <button
                      key={`platform-copy-tab-${platform}`}
                      type="button"
                      onClick={() => setSelectedCopyPlatform(platform)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                        selected
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
                      )}
                    >
                      {platform}
                      <span className={cn('text-[10px]', selected ? 'text-violet-100' : 'text-violet-500')}>
                        {titleLength}/{descriptionLength}
                      </span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const platform = selectedCopyPlatform;
                const draft = platformCopyDrafts[platform];
                if (!draft) return null;
                const titleLimit = getPlatformTitleLimit(platform);
                const descriptionLimit = getPlatformDescriptionLimit(platform);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-violet-900">{platform}</p>
                        <button
                          type="button"
                          onClick={() => applyPlatformCopyToFields(platform)}
                          className="inline-flex items-center rounded-md border border-violet-300 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                        >
                          {text.applyPlatformCopy}
                        </button>
                      </div>
                      <label className="text-[11px] font-semibold text-gray-600">
                        {isHebrew ? 'כותרת' : 'Title'} · {draft.title.trim().length}/{titleLimit}
                      </label>
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
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs mb-2"
                        placeholder={isHebrew ? 'כותרת מותאמת פלטפורמה' : 'Platform title'}
                      />
                      <label className="text-[11px] font-semibold text-gray-600">
                        {isHebrew ? 'טקסט מודעה' : 'Ad text'} · {draft.description.trim().length}/{descriptionLimit}
                      </label>
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
                        rows={3}
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                        placeholder={isHebrew ? 'תיאור מותאם פלטפורמה' : 'Platform description'}
                      />
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                      <p className="text-[11px] font-bold text-violet-900 inline-flex items-center gap-1.5 mb-2">
                        <Eye className="w-3.5 h-3.5" />
                        {isHebrew ? 'תצוגה מהירה של הטיוטה' : 'Quick draft preview'}
                      </p>
                      <div className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1.5">
                        <p className="text-[12px] font-extrabold text-gray-900">
                          {draft.title.trim() || (isHebrew ? 'כותרת מודעה' : 'Ad headline')}
                        </p>
                        <p className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                          {draft.description.trim() || text.previewNoText}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
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

          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/20 to-violet-50/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-bold text-indigo-900">{text.description}</label>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                    useWooProductData
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  )}
                >
                  {useWooProductData ? text.wooTextMode : text.manualTextMode}
                </span>
                <span className="text-[10px] font-semibold text-indigo-700">
                  {campaignBrief.trim().length}/{getPlatformDescriptionLimit(selectedPreviewPlatform)}
                </span>
              </div>
            </div>
            <textarea
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              rows={4}
              className="w-full rounded-lg border-indigo-200 bg-white/90 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder={
                isHebrew
                  ? 'כתוב מה הפוסט/המוצר, למי הוא מיועד ומה המסר.'
                  : 'Describe the post/product, target user, and campaign message.'
              }
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {useWooProductData && (
                <button
                  type="button"
                  onClick={disableWooImportMode}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  {text.disableWooImport}
                </button>
              )}
              {useWooProductData && wooPublishScope === 'product' && selectedWooProduct && (
                <p className="text-[11px] text-sky-700">{text.wooAutoDescriptionHint}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
            <h4 className="text-sm font-bold text-sky-900 mb-1">{text.wooPublishTitle}</h4>
            <p className="text-xs text-sky-700 mb-3">{text.wooPublishSubtitle}</p>
            <div className="mb-3 rounded-md border border-sky-200 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-sky-900 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                    checked={useWooProductData}
                    onChange={(e) => setUseWooProductData(e.target.checked)}
                  />
                  {text.wooOptionalModeTitle}
                </label>
                {useWooProductData && (
                  <button
                    type="button"
                    onClick={disableWooImportMode}
                    className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {text.disableWooImport}
                  </button>
                )}
              </div>
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

          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-4">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">{text.previewTitle}</h4>
            <p className="text-xs text-indigo-700 mb-3">{text.previewSubtitle}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {previewPlatforms.map((platform) => (
                <button
                  key={`preview-tab-${platform}`}
                  type="button"
                  onClick={() => setSelectedPreviewPlatform(platform)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                    selectedPreviewPlatform === platform
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                  )}
                >
                  {platform}
                </button>
              ))}
            </div>
            {(() => {
              const platform = selectedPreviewPlatform;
              const platformDraft = platformCopyDrafts[platform];
              const previewTitle =
                platformDraft?.title?.trim() ||
                shortTitleInput.trim() ||
                campaignNameInput.trim() ||
                (isHebrew ? 'כותרת מודעה' : 'Ad headline');
              const previewDescription =
                platformDraft?.description?.trim() ||
                campaignBrief.trim() ||
                (isHebrew ? 'הטקסט יוצג כאן לפי הנתונים שהוזנו.' : 'Ad body will appear here based on the data entered.');
              const mediaCount = uploadedAssets.length;
              const audienceCount = selectedAudiences.length;
              const activeSlots = getActiveSlotsCount(platform);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3">
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-indigo-900">{platform}</p>
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {isHebrew ? 'תצוגה חיה' : 'Live preview'}
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-[13px] font-extrabold text-gray-900 break-words">{previewTitle}</p>
                      <p className="text-[12px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                        {previewDescription}
                      </p>
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">
                          {text.previewObjective}: {objectiveOptions.find((item) => item.value === objective)?.label || objective}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-[10px] font-semibold">
                          {text.previewMedia}: {mediaCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                    <p className="text-[11px] font-bold text-indigo-900 mb-2">{text.previewDataTitle}</p>
                    <ul className="space-y-1.5 text-xs text-indigo-800">
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewPlatforms}</span>
                        <span className="font-bold text-right">{previewPlatforms.join(', ')}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewAudiences}</span>
                        <span className="font-bold">{audienceCount}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewSchedule}</span>
                        <span className="font-bold">{activeSlots}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewMedia}</span>
                        <span className="font-bold">{mediaCount}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })()}
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
              disabled={connectedAdPlatforms.length === 0 || isCreatingCampaign}
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
        <CampaignEditModal
          editingCampaign={editingCampaign}
          editApplyToAds={editApplyToAds}
          editLoading={editLoading}
          isHebrew={isHebrew}
          text={{
            editCampaign: text.editCampaign,
            editCampaignSubtitle: text.editCampaignSubtitle,
            editName: text.editName,
            editStatus: text.editStatus,
            editBudget: text.editBudget,
            editApplyAds: text.editApplyAds,
            editApplyAdsHint: text.editApplyAdsHint,
            cancel: text.cancel,
            saveChanges: text.saveChanges,
            saving: text.saving,
          }}
          closeEditCampaign={closeEditCampaign}
          saveEditedCampaign={saveEditedCampaign}
          setEditApplyToAds={setEditApplyToAds}
          setEditingCampaign={setEditingCampaign}
        />
      )}

      <OneClickWizard open={oneClickOpen} onClose={() => setOneClickOpen(false)} />
    </div>
  );
}

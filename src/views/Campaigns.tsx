"use client";

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
import { CampaignTable } from './campaigns/CampaignTable';
import { CampaignBuilder } from './campaigns/CampaignBuilder';

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

      <CampaignTable
        filteredAndSortedCampaigns={filteredAndSortedCampaigns}
        platforms={platforms}
        statuses={statuses}
        searchQuery={searchQuery}
        platformFilter={platformFilter}
        statusFilter={statusFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        isSyncing={isSyncing}
        metaSyncNotice={metaSyncNotice}
        editMessage={editMessage}
        hasConnectedAdPlatform={hasConnectedAdPlatform}
        expandedCampaigns={expandedCampaigns}
        adsetsByCampaignId={adsetsByCampaignId}
        loadingAdsetsCampaignId={loadingAdsetsCampaignId}
        isHebrew={isHebrew}
        text={{
          createdCampaigns: text.createdCampaigns,
          syncLive: text.syncLive,
          actions: text.actions,
          editCampaign: text.editCampaign,
          editNotAvailable: text.editNotAvailable,
        }}
        setSearchQuery={setSearchQuery}
        setPlatformFilter={setPlatformFilter}
        setStatusFilter={setStatusFilter}
        setSortField={setSortField}
        setSortOrder={setSortOrder}
        toggleCampaignExpand={toggleCampaignExpand}
        openEditCampaign={openEditCampaign}
        isEditablePlatformCampaign={isEditablePlatformCampaign}
        formatCurrency={formatCurrency}
        t={t}
      />

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

      <CampaignBuilder
        builderSectionRef={builderSectionRef}
        shortTitleInputRef={shortTitleInputRef}
        aiAudienceLoading={aiAudienceLoading}
        isCreatingCampaign={isCreatingCampaign}
        isHebrew={isHebrew}
        isWooConnected={isWooConnected}
        useWooProductData={useWooProductData}
        wooLoading={wooLoading}
        aiAudienceProvider={aiAudienceProvider}
        builderMessage={builderMessage}
        campaignBrief={campaignBrief}
        campaignNameInput={campaignNameInput}
        contentType={contentType}
        customAudience={customAudience}
        objective={objective}
        productType={productType}
        ruleAction={ruleAction}
        ruleReason={ruleReason}
        rulePlatform={rulePlatform}
        selectedCopyPlatform={selectedCopyPlatform}
        selectedPreviewPlatform={selectedPreviewPlatform}
        selectedScheduleDay={selectedScheduleDay}
        selectedSchedulePlatform={selectedSchedulePlatform}
        selectedWooCategory={selectedWooCategory}
        selectedWooProductId={selectedWooProductId}
        serviceTypeInput={serviceTypeInput}
        shortTitleInput={shortTitleInput}
        wooPublishScope={wooPublishScope}
        ruleEndHour={ruleEndHour}
        ruleMinRoas={ruleMinRoas}
        ruleStartHour={ruleStartHour}
        smartAdElapsedMs={smartAdElapsedMs}
        aiRecommendedHoursByPlatform={aiRecommendedHoursByPlatform}
        audienceSuggestions={audienceSuggestions}
        connectedAdPlatforms={connectedAdPlatforms}
        contentTypeOptions={contentTypeOptions}
        dayLabels={dayLabels}
        draftPlatforms={draftPlatforms}
        effectiveMediaLimits={effectiveMediaLimits}
        hourOptions={hourOptions}
        objectiveOptions={objectiveOptions}
        platformCopyDrafts={platformCopyDrafts}
        previewPlatforms={previewPlatforms}
        productTypeOptions={productTypeOptions}
        selectedWooProduct={selectedWooProduct}
        text={text}
        timeRules={timeRules}
        uploadedAssets={uploadedAssets}
        weeklySchedule={weeklySchedule}
        wooCategoryOptions={wooCategoryOptions}
        publishResults={publishResults}
        selectedAudiences={selectedAudiences}
        selectedPlatforms={selectedPlatforms}
        wooProducts={wooProducts}
        wooProductsFiltered={wooProductsFiltered}
        setCampaignBrief={setCampaignBrief}
        setCampaignNameInput={setCampaignNameInput}
        setContentType={setContentType}
        setCustomAudience={setCustomAudience}
        setObjective={setObjective}
        setPlatformCopyDrafts={setPlatformCopyDrafts}
        setProductType={setProductType}
        setRuleAction={setRuleAction}
        setRuleEndHour={setRuleEndHour}
        setRuleMinRoas={setRuleMinRoas}
        setRulePlatform={setRulePlatform}
        setRuleReason={setRuleReason}
        setRuleStartHour={setRuleStartHour}
        setSelectedCopyPlatform={setSelectedCopyPlatform}
        setSelectedPreviewPlatform={setSelectedPreviewPlatform}
        setSelectedScheduleDay={setSelectedScheduleDay}
        setSelectedSchedulePlatform={setSelectedSchedulePlatform}
        setSelectedWooCategory={setSelectedWooCategory}
        setSelectedWooProductId={setSelectedWooProductId}
        setServiceTypeInput={setServiceTypeInput}
        setShortTitleInput={setShortTitleInput}
        setUseWooProductData={setUseWooProductData}
        setWooPublishScope={setWooPublishScope}
        addCustomAudience={addCustomAudience}
        addTimeRule={addTimeRule}
        applyPlatformCopyToFields={applyPlatformCopyToFields}
        disableWooImportMode={disableWooImportMode}
        formatHour={formatHour}
        formatHourRange={formatHourRange}
        formatSmartElapsed={formatSmartElapsed}
        getActiveSlotsCount={getActiveSlotsCount}
        getPlatformDescriptionLimit={getPlatformDescriptionLimit}
        getPlatformTitleLimit={getPlatformTitleLimit}
        handleAssetUpload={handleAssetUpload}
        handleAutoAudienceAndStrategy={handleAutoAudienceAndStrategy}
        handleCreateScheduledCampaign={handleCreateScheduledCampaign}
        importWooProductToBuilder={importWooProductToBuilder}
        isFullDaySelected={isFullDaySelected}
        removeAsset={removeAsset}
        removeTimeRule={removeTimeRule}
        toggleAudienceSelection={toggleAudienceSelection}
        toggleFullDay={toggleFullDay}
        togglePlatformSelection={togglePlatformSelection}
        toggleScheduleHour={toggleScheduleHour}
      />

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

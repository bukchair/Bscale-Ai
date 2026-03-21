"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Eye,
  Video,
  Pencil,
  X,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  type CampaignRow,
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
import { useCampaignData } from './campaigns/useCampaignData';
import { useCampaignBuilder } from './campaigns/useCampaignBuilder';
import { useCampaignEdit } from './campaigns/useCampaignEdit';
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
    goToBuilder: isHebrew ? 'מעבר ליצירת קמפיין' : 'Go to campaign builder',
    budgetGeoTitle: isHebrew ? 'תקציב, מיקום ושפת קמפיין' : 'Budget, geo & campaign language',
    dailyBudgetLabel: isHebrew ? 'תקציב יומי' : 'Daily budget',
    perDay: isHebrew ? 'יום' : 'day',
    countryLabel: isHebrew ? 'מדינת יעד' : 'Target country',
    campaignLanguageLabel: isHebrew ? 'שפת הקמפיין' : 'Campaign language',
    activateImmediatelyLabel: isHebrew ? 'הפעלה מיידית בפלטפורמה' : 'Activate immediately on platform',
    activateImmediatelyHint: isHebrew
      ? 'כבוי: הקמפיין נשמר כטיוטה או פעיל רק בשעות שסימנת בלוח. מופעל: מופעל בפלטפורמה מיד (כמו "בלחיצה אחת").'
      : 'Off: draft or only runs in hours you set in the weekly schedule. On: ENABLED/ACTIVE on the ad platform immediately.',
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

  // ── Custom hooks ──────────────────────────────────────────────────
  const {
    realCampaigns, setRealCampaigns,
    createdCampaigns, setCreatedCampaigns,
    isSyncing,
    metaSyncNotice,
    expandedCampaigns,
    adsetsByCampaignId,
    loadingAdsetsCampaignId,
    toggleCampaignExpand,
    recommendations,
    loading,
    appliedRecs,
    expandedRecs,
    fetchRecommendations,
    handleApply,
    toggleRecExpanded,
    sendingEmail,
    handleSendEmail,
  } = useCampaignData({
    connections,
    startDateIso,
    endDateIso,
    language,
    isHebrew,
  });

  const builder = useCampaignBuilder({
    connections,
    connectedAdPlatforms,
    isHebrew,
    language,
    isWooConnected,
    wooConnection,
    realCampaigns,
    onCampaignsCreated: (created) => setCreatedCampaigns((prev) => [...created, ...prev]),
  });

  const {
    campaignNameInput, setCampaignNameInput,
    shortTitleInput, setShortTitleInput,
    objective, setObjective,
    contentType, setContentType,
    productType, setProductType,
    serviceTypeInput, setServiceTypeInput,
    campaignBrief, setCampaignBrief,
    selectedPlatforms, setSelectedPlatforms,
    selectedAudiences, setSelectedAudiences,
    customAudience, setCustomAudience,
    builderMessage, setBuilderMessage,
    platformCopyDrafts, setPlatformCopyDrafts,
    selectedCopyPlatform, setSelectedCopyPlatform,
    selectedPreviewPlatform, setSelectedPreviewPlatform,
    draftPlatforms,
    previewPlatforms,
    dailyBudgetInput,
    setDailyBudgetInput,
    targetCountry,
    setTargetCountry,
    campaignLanguage,
    setCampaignLanguage,
    activateImmediately,
    setActivateImmediately,
    builderSectionRef,
    shortTitleInputRef,
    audienceSuggestions,
    audienceSuggestionsWithAi,
    effectiveMediaLimits,
    aiProcessingBrief,
    togglePlatformSelection,
    toggleAudienceSelection,
    addCustomAudience,
    scrollToBuilderSection,
    uploadedAssets,
    handleAssetUpload,
    removeAsset,
    clearUploadedMedia,
    normalizeHour,
    sanitizeHours,
    weeklySchedule, setWeeklySchedule,
    selectedSchedulePlatform, setSelectedSchedulePlatform,
    selectedScheduleDay, setSelectedScheduleDay,
    toggleScheduleHour,
    isFullDaySelected,
    toggleFullDay,
    getActiveSlotsCount,
    timeRules, setTimeRules,
    rulePlatform, setRulePlatform,
    ruleStartHour, setRuleStartHour,
    ruleEndHour, setRuleEndHour,
    ruleAction, setRuleAction,
    ruleMinRoas, setRuleMinRoas,
    ruleReason, setRuleReason,
    addTimeRule,
    removeTimeRule,
    aiAudienceLoading,
    aiAudienceProvider,
    aiGeneratedAudienceNames, setAiGeneratedAudienceNames,
    aiRecommendedHoursByPlatform,
    smartAdRunStartedAt,
    smartAdElapsedMs,
    formatSmartElapsed,
    getPlatformTitleLimit,
    getPlatformDescriptionLimit,
    applyPlatformCopyToFields,
    handleAutoAudienceAndStrategy,
    handleGeneratePlatformAdCopies,
    isCreatingCampaign,
    publishResults,
    handleCreateScheduledCampaign,
    wooProducts,
    wooLoading,
    useWooProductData, setUseWooProductData,
    wooPublishScope, setWooPublishScope,
    selectedWooCategory, setSelectedWooCategory,
    selectedWooProductId, setSelectedWooProductId,
    wooCategoryOptions,
    wooProductsFiltered,
    selectedWooProduct,
    inferredWooTitle,
    buildWooProductBrief,
    importWooProductToBuilder,
    disableWooImportMode,
  } = builder;

  const {
    editingCampaign, setEditingCampaign,
    editApplyToAds, setEditApplyToAds,
    editLoading,
    editMessage, setEditMessage,
    isEditablePlatformCampaign,
    openEditCampaign,
    closeEditCampaign,
    saveEditedCampaign,
  } = useCampaignEdit({
    isHebrew,
    onUpdateCampaigns: (updater) => {
      setRealCampaigns(updater);
      setCreatedCampaigns(updater);
    },
  });

  // ── Remaining local state ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Creative-lab prefill on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('bscale:creative-prefill');
      if (!raw) return;
      sessionStorage.removeItem('bscale:creative-prefill');
      const prefill = JSON.parse(raw) as Record<string, unknown>;
      if (prefill.campaignName) setCampaignNameInput(String(prefill.campaignName));
      if (prefill.shortTitle) setShortTitleInput(String(prefill.shortTitle));
      if (prefill.brief) setCampaignBrief(String(prefill.brief));
      if (prefill.platformCopy) setPlatformCopyDrafts(prefill.platformCopy as typeof platformCopyDrafts);
    } catch {
      // ignore prefill errors
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const objectiveOptions: Array<{ value: ObjectiveType; label: string }> = [
    { value: 'sales', label: isHebrew ? 'מכירות' : 'Sales' },
    { value: 'traffic', label: isHebrew ? 'תנועה לאתר' : 'Website Traffic' },
    { value: 'leads', label: isHebrew ? 'לידים' : 'Leads' },
    { value: 'awareness', label: isHebrew ? 'מודעות למותג' : 'Brand Awareness' },
    { value: 'retargeting', label: isHebrew ? 'רטרגטינג' : 'Retargeting' },
  ];

  const contentTypeOptions: Array<{ value: ContentType; label: string }> = [
    { value: 'product', label: isHebrew ? 'מוצר ספציפי' : 'Specific Product' },
    { value: 'offer', label: isHebrew ? 'מבצע / הנחה' : 'Offer / Discount' },
    { value: 'educational', label: isHebrew ? 'תוכן חינוכי' : 'Educational Content' },
    { value: 'testimonial', label: isHebrew ? 'המלצה / ביקורת' : 'Testimonial / Review' },
    { value: 'video', label: isHebrew ? 'וידאו / ריל' : 'Video / Reel' },
  ];

  const productTypeOptions: Array<{ value: ProductType; label: string }> = [
    { value: 'fashion', label: isHebrew ? 'אופנה ואקססוריז' : 'Fashion & Accessories' },
    { value: 'beauty', label: isHebrew ? 'יופי וטיפוח' : 'Beauty & Grooming' },
    { value: 'tech', label: isHebrew ? 'טכנולוגיה ואלקטרוניקה' : 'Tech & Electronics' },
    { value: 'home', label: isHebrew ? 'בית וגינה' : 'Home & Garden' },
    { value: 'fitness', label: isHebrew ? 'בריאות וכושר' : 'Health & Fitness' },
    { value: 'services', label: isHebrew ? 'שירותים / B2B' : 'Services / B2B' },
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

  const hasConnectedAdPlatform = Boolean(
    connections.find(
      (c) =>
        (c.id === 'google' || c.id === 'meta' || c.id === 'tiktok') &&
        c.status === 'connected'
    )
  );

  const allCampaigns: CampaignRow[] = [
    ...createdCampaigns,
    ...(realCampaigns.length > 0
      ? realCampaigns
      : hasConnectedAdPlatform
      ? []
      : (mockCampaignData as CampaignRow[])),
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
      let valA: string | number;
      let valB: string | number;

      if (sortField === 'spend' || sortField === 'cpa' || sortField === 'roas') {
        valA = toAmount(a[sortField as keyof typeof a]);
        valB = toAmount(b[sortField as keyof typeof b]);
      } else if (sortField === 'status') {
        valA = normalizeCampaignStatus(a.status).toLowerCase();
        valB = normalizeCampaignStatus(b.status).toLowerCase();
      } else {
        valA = String(a[sortField as keyof typeof a] || '').toLowerCase();
        valB = String(b[sortField as keyof typeof b] || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const platforms = ['All', ...new Set(allCampaigns.map(c => String(c.platform || '')))];
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
            onClick={scrollToBuilderSection}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Target className="w-4 h-4" />
            {isHebrew ? 'יצירת קמפיין' : 'Create campaign'}
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
        dailyBudgetInput={dailyBudgetInput}
        targetCountry={targetCountry}
        campaignLanguage={campaignLanguage}
        activateImmediately={activateImmediately}
        ruleEndHour={ruleEndHour}
        ruleMinRoas={ruleMinRoas}
        ruleStartHour={ruleStartHour}
        smartAdElapsedMs={smartAdElapsedMs}
        aiRecommendedHoursByPlatform={aiRecommendedHoursByPlatform}
        audienceSuggestions={audienceSuggestionsWithAi}
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
        setDailyBudgetInput={setDailyBudgetInput}
        setTargetCountry={setTargetCountry}
        setCampaignLanguage={setCampaignLanguage}
        setActivateImmediately={setActivateImmediately}
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

    </div>
  );
}

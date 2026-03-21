import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAIKeysFromConnections,
  hasAnyAIKey,
  getAudienceRecommendations,
  getCampaignBuilderSuggestions,
} from '../../lib/gemini';
import { auth, onAuthStateChanged } from '../../lib/firebase';
import { toAmount } from './utils';
import type {
  ContentType,
  ProductType,
  ObjectiveType,
  RuleAction,
  PlatformName,
  TimeRule,
  WeeklySchedule,
  MediaLimits,
  PlatformCopyDraft,
  CampaignRow,
} from './types';
import {
  DAY_KEYS,
  PLATFORM_MEDIA_LIMITS,
  SMART_AUDIENCE_BY_CONTENT,
  SMART_AUDIENCE_BY_PRODUCT,
  SMART_AUDIENCE_BY_OBJECTIVE,
  createEmptyDaySchedule,
} from './types';
import type { Connection } from '../../contexts/ConnectionsContext';
import { useWooProducts } from './useWooProducts';
import { useMediaAssets } from './useMediaAssets';
import { useCampaignSchedule, normalizeHour, sanitizeHours } from './useCampaignSchedule';

export interface UseCampaignBuilderProps {
  connections: Connection[];
  connectedAdPlatforms: string[];
  isHebrew: boolean;
  language: string;
  isWooConnected: boolean;
  wooConnection: Connection | undefined;
  realCampaigns: CampaignRow[];
  onCampaignsCreated: (campaigns: CampaignRow[]) => void;
}

export function useCampaignBuilder({
  connections,
  connectedAdPlatforms,
  isHebrew,
  language,
  isWooConnected,
  wooConnection,
  realCampaigns,
  onCampaignsCreated,
}: UseCampaignBuilderProps) {
  // ── Form fields ──────────────────────────────────────────────────────────
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
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);

  // ── Platform copy & preview ──────────────────────────────────────────────
  const [platformCopyDrafts, setPlatformCopyDrafts] = useState<Partial<Record<PlatformName, PlatformCopyDraft>>>({});
  const [selectedCopyPlatform, setSelectedCopyPlatform] = useState<PlatformName>('Google');
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<PlatformName>('Google');
  const [oneClickOpen, setOneClickOpen] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const builderSectionRef = useRef<HTMLElement | null>(null);
  const shortTitleInputRef = useRef<HTMLInputElement | null>(null);

  // ── Audience suggestions ─────────────────────────────────────────────────
  const audienceSuggestions = useMemo(() => {
    const combined = [
      ...SMART_AUDIENCE_BY_CONTENT[contentType],
      ...SMART_AUDIENCE_BY_PRODUCT[productType],
      ...SMART_AUDIENCE_BY_OBJECTIVE[objective],
    ];
    return [...new Set(combined)];
  }, [contentType, productType, objective]);

  // Sync selected platforms with connected platforms
  useEffect(() => {
    if (connectedAdPlatforms.length === 0) {
      setSelectedPlatforms([]);
      return;
    }
    setSelectedPlatforms((prev) => {
      const filtered = prev.filter((p) => connectedAdPlatforms.includes(p));
      return filtered.length ? filtered : [...connectedAdPlatforms];
    });
  }, [connectedAdPlatforms]);

  // Auto-select copy/preview platform when drafts change
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

  const scrollToBuilderSection = () => {
    builderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Media limits (computed from selected platforms) ──────────────────────
  const effectiveMediaLimits = useMemo((): MediaLimits => {
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

  // ── Sub-hooks ────────────────────────────────────────────────────────────
  const woo = useWooProducts({
    wooConnection, isHebrew, isWooConnected,
    setBuilderMessage, setContentType, setShortTitleInput,
    setCampaignNameInput, setServiceTypeInput, setCampaignBrief,
  });

  const media = useMediaAssets({
    effectiveMediaLimits,
    isHebrew,
    onMessage: setBuilderMessage,
  });

  const schedule = useCampaignSchedule({
    connectedAdPlatforms,
    selectedPlatforms,
    isHebrew,
    onMessage: setBuilderMessage,
  });

  const disableWooImportMode = () => {
    woo.setUseWooProductData(false);
    setBuilderMessage(isHebrew ? 'מצב עריכה ידני' : 'Manual editing mode');
    window.setTimeout(() => shortTitleInputRef.current?.focus(), 0);
  };

  // ── AI processing brief ──────────────────────────────────────────────────
  const aiProcessingBrief = useMemo(() => {
    const baseBrief = campaignBrief.trim();
    const productBrief =
      woo.useWooProductData && woo.wooPublishScope === 'product' && woo.selectedWooProduct
        ? woo.buildWooProductBrief(woo.selectedWooProduct)
        : '';
    if (!productBrief) return baseBrief;
    if (!baseBrief) return productBrief;
    if (baseBrief.includes(productBrief)) return baseBrief;
    return `${baseBrief}\n\n${isHebrew ? 'נתוני מוצר מ-WooCommerce:' : 'WooCommerce product data:'}\n${productBrief}`;
  }, [campaignBrief, woo.useWooProductData, woo.wooPublishScope, woo.selectedWooProduct, isHebrew]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI state ─────────────────────────────────────────────────────────────
  const [aiAudienceLoading, setAiAudienceLoading] = useState(false);
  const [aiAudienceProvider, setAiAudienceProvider] = useState<string>('');
  const [aiGeneratedAudienceNames, setAiGeneratedAudienceNames] = useState<string[]>([]);
  const [aiRecommendedHoursByPlatform, setAiRecommendedHoursByPlatform] = useState<Record<string, number[]>>({});
  const [smartAdRunStartedAt, setSmartAdRunStartedAt] = useState<number | null>(null);
  const [smartAdElapsedMs, setSmartAdElapsedMs] = useState(0);

  // AI elapsed timer
  useEffect(() => {
    if (!aiAudienceLoading || !smartAdRunStartedAt) return;
    const intervalId = window.setInterval(() => {
      setSmartAdElapsedMs(Date.now() - smartAdRunStartedAt);
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [aiAudienceLoading, smartAdRunStartedAt]);

  const formatSmartElapsed = (elapsedMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const resolveLanguage = () =>
    language === 'he' ? 'Hebrew'
    : language === 'ru' ? 'Russian'
    : language === 'pt' ? 'Portuguese'
    : language === 'fr' ? 'French'
    : 'English';

  // Merge AI audience names into suggestions
  const audienceSuggestionsWithAi = useMemo(() => {
    const combined = [
      ...aiGeneratedAudienceNames,
      ...SMART_AUDIENCE_BY_CONTENT[contentType],
      ...SMART_AUDIENCE_BY_PRODUCT[productType],
      ...SMART_AUDIENCE_BY_OBJECTIVE[objective],
    ];
    return [...new Set(combined)];
  }, [aiGeneratedAudienceNames, contentType, productType, objective]);

  const getPlatformTitleLimit = (platform: PlatformName) => (platform === 'Google' ? 30 : 40);
  const getPlatformDescriptionLimit = (platform: PlatformName) =>
    platform === 'Google' ? 90 : platform === 'Meta' ? 125 : 100;

  const buildLocalPlatformCopyDrafts = (): Partial<Record<PlatformName, PlatformCopyDraft>> => {
    const platforms = selectedPlatforms.filter((p): p is PlatformName =>
      p === 'Google' || p === 'Meta' || p === 'TikTok'
    );
    const activePlatforms: Array<string> = platforms.length > 0 ? platforms : ['Google'];
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
          description: trimByLength(baseDescription || 'Engaging social-first primary text for Meta placements.', 125),
        };
      }
      if (platform === 'TikTok') {
        drafts.TikTok = {
          title: trimByLength(baseTitle || 'TikTok Ad', 40),
          description: trimByLength(baseDescription || 'Short hook-focused caption for TikTok audiences.', 100),
        };
      }
    });
    return drafts;
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
    setBuilderMessage(isHebrew ? 'טיוטת הפלטפורמה הוחלה על שדות הקמפיין.' : 'Platform draft applied to campaign fields.');
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
        setBuilderMessage(isHebrew ? 'אין כרגע חיבור למנוע AI פעיל.' : 'No active AI engine connection found.');
        return;
      }
      const responseLanguage = resolveLanguage();
      const platformTextRules = {
        Google: { titleMax: 30, descriptionMax: 90, note: 'Search-style short headline and concise value description.' },
        Meta: { titleMax: 40, descriptionMax: 125, note: 'Feed/Reels style hook headline and conversational primary text.' },
        TikTok: { titleMax: 40, descriptionMax: 100, note: 'Short hook and mobile-first caption style.' },
      };
      const wooContext = isWooConnected && woo.useWooProductData
        ? {
            publishScope: woo.wooPublishScope,
            category: woo.selectedWooCategory || null,
            product:
              woo.wooPublishScope === 'product' && woo.selectedWooProduct
                ? {
                    id: woo.selectedWooProduct.id,
                    name: woo.selectedWooProduct.name,
                    categories: woo.selectedWooProduct.categories,
                    price: woo.selectedWooProduct.price || null,
                    shortDescription: woo.selectedWooProduct.shortDescription || null,
                    description: woo.selectedWooProduct.description || null,
                    sku: woo.selectedWooProduct.sku || null,
                    stockQuantity: woo.selectedWooProduct.stockQuantity ?? null,
                  }
                : null,
          }
        : null;
      const fallbackTitle =
        shortTitleInput.trim() || woo.inferredWooTitle || woo.selectedWooProduct?.name || campaignNameInput.trim();
      const contextPayload = {
        shortTitle: fallbackTitle,
        currentForm: { campaignNameInput, objective, contentType, productType, serviceTypeInput, campaignBrief: aiProcessingBrief },
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
      if (strategyResult?.shortTitle) setShortTitleInput(String(strategyResult.shortTitle).trim());
      else if (!shortTitleInput.trim() && woo.inferredWooTitle) setShortTitleInput(woo.inferredWooTitle);
      if (strategyResult?.campaignName) setCampaignNameInput(strategyResult.campaignName);
      if (strategyResult?.objective && ['sales','traffic','leads','awareness','retargeting'].includes(strategyResult.objective))
        setObjective(strategyResult.objective);
      if (strategyResult?.contentType && ['product','offer','educational','testimonial','video'].includes(strategyResult.contentType))
        setContentType(strategyResult.contentType);
      if (strategyResult?.productType && ['fashion','beauty','tech','home','fitness','services','other'].includes(strategyResult.productType))
        setProductType(strategyResult.productType);
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
        const raw = Array.isArray(recommendedHoursByPlatform[platform]) ? recommendedHoursByPlatform[platform] : [];
        sanitizedHourMap[platform] = sanitizeHours(raw.map((hour) => Number(hour)));
      });
      setAiRecommendedHoursByPlatform(sanitizedHourMap);
      if (Object.keys(sanitizedHourMap).length > 0) {
        schedule.setWeeklySchedule((prev) => {
          const next: WeeklySchedule = { ...prev };
          Object.entries(sanitizedHourMap).forEach(([platform, hours]) => {
            if (!next[platform]) next[platform] = createEmptyDaySchedule();
            DAY_KEYS.forEach((day) => { next[platform][day] = hours; });
          });
          return next;
        });
      }
      if (Array.isArray(strategyResult?.targetingRules) && strategyResult.targetingRules.length > 0) {
        const aiRules: TimeRule[] = strategyResult.targetingRules
          .map((rule: Record<string, unknown>, index: number) => {
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
        if (aiRules.length > 0) schedule.setTimeRules((prev) => [...aiRules, ...prev]);
      }
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setSmartAdElapsedMs(Date.now() - (smartAdRunStartedAt || Date.now()));
      setAiAudienceLoading(false);
    }
  };

  const handleGeneratePlatformAdCopies = async () => {
    setBuilderMessage(null);
    setAiAudienceLoading(true);
    try {
      if (!shortTitleInput.trim() && !campaignNameInput.trim()) {
        setBuilderMessage(isHebrew ? 'נדרש שם קמפיין ובחירת לפחות פלטפורמה אחת.' : 'Campaign name and at least one platform are required.');
        return;
      }
      const aiKeys = getAIKeysFromConnections(connections);
      if (!hasAnyAIKey(aiKeys)) {
        setPlatformCopyDrafts(buildLocalPlatformCopyDrafts());
        setBuilderMessage(
          isHebrew
            ? 'אין חיבור AI פעיל, נוצרו מודעות מותאמות לפי כללי פלטפורמה מקומיים.'
            : 'No active AI connection. Platform-fit ads were generated using local rules.'
        );
        return;
      }
      const responseLanguage = resolveLanguage();
      const contextPayload = {
        shortTitle: shortTitleInput.trim() || woo.selectedWooProduct?.name || woo.inferredWooTitle || campaignNameInput.trim(),
        currentForm: { campaignNameInput, objective, contentType, productType, serviceTypeInput, campaignBrief: aiProcessingBrief },
        connectedPlatforms: connectedAdPlatforms,
        selectedPlatforms,
        aiInputText: aiProcessingBrief,
      };
      const strategyResult = await getCampaignBuilderSuggestions(JSON.stringify(contextPayload), aiKeys, responseLanguage);
      const nextPlatformCopy: Partial<Record<PlatformName, PlatformCopyDraft>> = {};
      (['Google', 'Meta', 'TikTok'] as const).forEach((platform) => {
        const item = strategyResult?.platformCopy?.[platform];
        if (!item) return;
        nextPlatformCopy[platform] = {
          title: String(item.title || '').trim(),
          description: String(item.description || '').trim(),
        };
      });
      setPlatformCopyDrafts(
        Object.keys(nextPlatformCopy).length > 0 ? nextPlatformCopy : buildLocalPlatformCopyDrafts()
      );
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : isHebrew ? 'יצירת מודעות נכשלה.' : 'Ad generation failed.');
    } finally {
      setAiAudienceLoading(false);
    }
  };

  // ── Campaign creation ────────────────────────────────────────────────────
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [publishResults, setPublishResults] = useState<Array<{ platform: string; ok: boolean; message: string; campaignId?: string }>>([]);

  const ensureManagedApiSession = async () => {
    const currentUser =
      auth.currentUser ||
      (await new Promise<import('firebase/auth').User | null>((resolve) => {
        const timeoutId = window.setTimeout(() => { unsubscribe(); resolve(auth.currentUser); }, 3000);
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

  const handleCreateScheduledCampaign = async () => {
    setBuilderMessage(null);
    setPublishResults([]);
    const resolvedPlatforms = (
      (selectedPlatforms.length > 0 ? selectedPlatforms : connectedAdPlatforms).filter((platform) =>
        connectedAdPlatforms.includes(platform)
      ) as PlatformName[]
    );
    const resolvedCampaignName =
      campaignNameInput.trim() || shortTitleInput.trim() || woo.inferredWooTitle || woo.selectedWooProduct?.name || '';
    if (!resolvedCampaignName || resolvedPlatforms.length === 0) {
      setBuilderMessage(isHebrew ? 'נדרש שם קמפיין ובחירת לפחות פלטפורמה אחת.' : 'Campaign name and at least one platform are required.');
      return;
    }
    if (media.uploadedAssets.length === 0) {
      setBuilderMessage(isHebrew ? 'יש להעלות לפחות קובץ מדיה אחד כדי ליצור קמפיין.' : 'Upload at least one media file to create campaign.');
      return;
    }
    if (woo.useWooProductData && isWooConnected && woo.wooProducts.length > 0) {
      if (woo.wooPublishScope === 'category' && !woo.selectedWooCategory) {
        setBuilderMessage(isHebrew ? 'בחר קטגוריה או מוצר לפרסום מתוך WooCommerce.' : 'Select a WooCommerce category or product to promote.');
        return;
      }
      if (woo.wooPublishScope === 'product' && !woo.selectedWooProductId) {
        setBuilderMessage(isHebrew ? 'בחר קטגוריה או מוצר לפרסום מתוך WooCommerce.' : 'Select a WooCommerce category or product to promote.');
        return;
      }
    }
    setIsCreatingCampaign(true);
    const mediaCount = media.uploadedAssets.length;
    try {
      await ensureManagedApiSession();
      const response = await fetch('/api/campaigns/scheduled', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          campaignName: resolvedCampaignName,
          shortTitle: shortTitleInput.trim(),
          objective, contentType, productType,
          serviceType: serviceTypeInput.trim(),
          brief: campaignBrief.trim(),
          platforms: resolvedPlatforms,
          audiences: selectedAudiences,
          timeRules: schedule.timeRules,
          weeklySchedule: schedule.weeklySchedule,
          wooPublishMode: isWooConnected && woo.useWooProductData ? woo.wooPublishScope : null,
          wooCategory: isWooConnected && woo.useWooProductData && woo.wooPublishScope === 'category' ? woo.selectedWooCategory || null : null,
          wooProductId: isWooConnected && woo.useWooProductData && woo.wooPublishScope === 'product' ? woo.selectedWooProductId || null : null,
          wooProductName: isWooConnected && woo.useWooProductData && woo.wooPublishScope === 'product' ? woo.selectedWooProduct?.name || null : null,
          platformCopyDrafts,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message ||
            (isHebrew ? `יצירת קמפיין נכשלה (קוד ${response.status}).` : `Campaign creation failed (status ${response.status}).`)
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
        const activeHours = schedule.getActiveSlotsCount(platform);
        const platformResult = results.find((item: Record<string, unknown>) => String(item?.platform || '') === platform);
        return {
          id: `live-${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: resolvedCampaignName,
          platform,
          status: platformResult?.ok === true ? (activeHours > 0 ? 'Scheduled' : 'Draft') : 'Error',
          spend: 0, roas: 0, cpa: 0,
          objective,
          brief: campaignBrief.trim(),
          audiences: selectedAudiences,
          mediaCount,
          wooPublishMode: isWooConnected && woo.useWooProductData ? woo.wooPublishScope : null,
          wooCategory: isWooConnected && woo.useWooProductData && woo.wooPublishScope === 'category' ? woo.selectedWooCategory || null : null,
          wooProductName: isWooConnected && woo.useWooProductData && woo.wooPublishScope === 'product' ? woo.selectedWooProduct?.name || null : null,
        };
      });
      onCampaignsCreated(created);
      const successCount = results.filter((item: Record<string, unknown>) => item?.ok).length;
      setBuilderMessage(
        successCount === resolvedPlatforms.length
          ? (isHebrew ? 'הקמפיינים נוצרו בהצלחה בפלטפורמות שנבחרו.' : 'Campaigns were created successfully on selected platforms.')
          : successCount > 0
          ? (isHebrew ? 'חלק מהפלטפורמות נכשלו. בדוק פירוט תוצאות.' : 'Some platforms failed. Check detailed results.')
          : payload?.message || (isHebrew ? 'חלק מהפלטפורמות נכשלו. בדוק פירוט תוצאות.' : 'Some platforms failed. Check detailed results.')
      );
      setCampaignNameInput('');
      setShortTitleInput('');
      setCampaignBrief('');
      setSelectedAudiences([]);
      setAiGeneratedAudienceNames([]);
      setPlatformCopyDrafts({});
      schedule.setTimeRules([]);
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : 'Failed to create scheduled campaign.');
    } finally {
      media.clearUploadedMedia();
      setIsCreatingCampaign(false);
    }
  };

  return {
    // form fields
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
    // copy / preview
    platformCopyDrafts, setPlatformCopyDrafts,
    selectedCopyPlatform, setSelectedCopyPlatform,
    selectedPreviewPlatform, setSelectedPreviewPlatform,
    draftPlatforms,
    previewPlatforms,
    oneClickOpen, setOneClickOpen,
    // refs
    builderSectionRef,
    shortTitleInputRef,
    // computed
    audienceSuggestions,
    effectiveMediaLimits,
    aiProcessingBrief,
    // handlers
    togglePlatformSelection,
    toggleAudienceSelection,
    addCustomAudience,
    scrollToBuilderSection,
    // media (from sub-hook)
    ...media,
    normalizeHour,
    sanitizeHours,
    // schedule (from sub-hook)
    ...schedule,
    // AI
    aiAudienceLoading,
    aiAudienceProvider,
    aiGeneratedAudienceNames, setAiGeneratedAudienceNames,
    aiRecommendedHoursByPlatform,
    smartAdRunStartedAt,
    smartAdElapsedMs,
    audienceSuggestionsWithAi,
    formatSmartElapsed,
    getPlatformTitleLimit,
    getPlatformDescriptionLimit,
    applyPlatformCopyToFields,
    handleAutoAudienceAndStrategy,
    handleGeneratePlatformAdCopies,
    // campaign creation
    isCreatingCampaign,
    publishResults,
    handleCreateScheduledCampaign,
    // woo (from sub-hook)
    ...woo,
    disableWooImportMode,
  };
}

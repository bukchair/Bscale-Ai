import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ContentType,
  ProductType,
  ObjectiveType,
  DayKey,
  RuleAction,
  PlatformName,
  UploadedAsset,
  TimeRule,
  WeeklySchedule,
  MediaLimits,
  PlatformCopyDraft,
  WooCampaignProduct,
  WooPublishScope,
  CampaignRow,
} from './types';
import {
  DAY_KEYS,
  PLATFORM_MEDIA_LIMITS,
  SMART_AUDIENCE_BY_CONTENT,
  SMART_AUDIENCE_BY_PRODUCT,
  SMART_AUDIENCE_BY_OBJECTIVE,
  createEmptyDaySchedule,
  stripHtmlToText,
} from './types';
import type { Connection } from '../../contexts/ConnectionsContext';
import { fetchWooCommerceProducts } from '../../services/woocommerceService';

export interface UseCampaignBuilderProps {
  connections: Connection[];
  connectedAdPlatforms: string[];
  isHebrew: boolean;
  language: string;
  isWooConnected: boolean;
  wooConnection: Connection | undefined;
}

export function useCampaignBuilder({
  connections,
  connectedAdPlatforms,
  isHebrew,
  language,
  isWooConnected,
  wooConnection,
}: UseCampaignBuilderProps) {
  // ── Form fields ──────────────────────────────────────────────────
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

  // ── Platform copy & preview ──────────────────────────────────────
  const [platformCopyDrafts, setPlatformCopyDrafts] = useState<Partial<Record<PlatformName, PlatformCopyDraft>>>({});
  const [selectedCopyPlatform, setSelectedCopyPlatform] = useState<PlatformName>('Google');
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<PlatformName>('Google');
  const [oneClickOpen, setOneClickOpen] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────
  const builderSectionRef = useRef<HTMLElement | null>(null);
  const shortTitleInputRef = useRef<HTMLInputElement | null>(null);

  // ── Audience suggestions ─────────────────────────────────────────
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

  // ── Media limits (computed from selected platforms) ──────────────
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

  // ── WooCommerce state ────────────────────────────────────────────
  const wooAutoBriefRef = useRef('');
  const [wooProducts, setWooProducts] = useState<WooCampaignProduct[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [useWooProductData, setUseWooProductData] = useState(false);
  const [wooPublishScope, setWooPublishScope] = useState<WooPublishScope>('category');
  const [selectedWooCategory, setSelectedWooCategory] = useState('');
  const [selectedWooProductId, setSelectedWooProductId] = useState<string>('');

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
    if (wooPublishScope === 'product' && selectedWooProduct?.name) return selectedWooProduct.name;
    if (wooPublishScope === 'category' && selectedWooCategory) return `${selectedWooCategory} Campaign`;
    return '';
  }, [useWooProductData, isWooConnected, wooPublishScope, selectedWooProduct?.name, selectedWooCategory]);

  // Load Woo products when wooConnection changes
  useEffect(() => {
    if (!wooConnection?.settings) {
      setWooProducts([]);
      setSelectedWooCategory('');
      setSelectedWooProductId('');
      return;
    }
    const { storeUrl, wooKey, wooSecret } = (wooConnection.settings || {}) as Record<string, string>;
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
          .map((item: Record<string, unknown>) => ({
            id: Number(item?.id || 0),
            name: stripHtmlToText(String(item?.name || '')),
            categories: Array.isArray(item?.categories)
              ? (item.categories as Record<string, unknown>[])
                  .map((category) => stripHtmlToText(String(category?.name || '')))
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
        if (!cancelled) setWooProducts([]);
      })
      .finally(() => {
        if (!cancelled) setWooLoading(false);
      });
    return () => { cancelled = true; };
  }, [wooConnection?.settings]);

  // Auto-select woo category
  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope === 'product') return;
    if (!selectedWooCategory && wooCategoryOptions.length > 0) {
      setSelectedWooCategory(wooCategoryOptions[0]);
    }
  }, [useWooProductData, wooPublishScope, wooCategoryOptions, selectedWooCategory]);

  // Auto-select woo product
  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product') return;
    if (!selectedWooProductId && wooProductsFiltered.length > 0) {
      setSelectedWooProductId(String(wooProductsFiltered[0].id));
    }
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  // Keep selected product valid when filtered list changes
  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product') return;
    if (!selectedWooProductId) return;
    const exists = wooProductsFiltered.some(
      (product) => String(product.id) === String(selectedWooProductId)
    );
    if (!exists) {
      setSelectedWooProductId(wooProductsFiltered.length > 0 ? String(wooProductsFiltered[0].id) : '');
    }
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  // Auto-fill title from woo
  useEffect(() => {
    if (!useWooProductData) return;
    if (!inferredWooTitle) return;
    setShortTitleInput((prev) => (prev.trim() ? prev : inferredWooTitle));
    setCampaignNameInput((prev) => (prev.trim() ? prev : inferredWooTitle));
  }, [useWooProductData, inferredWooTitle]);

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
      if (notify)
        setBuilderMessage(
          isHebrew ? 'למוצר הנבחר אין מספיק פרטים לייבוא.' : 'Selected product has insufficient data for import.'
        );
      return;
    }
    const priceStr = product.price ? ` – ₪${product.price}` : '';
    const titleWithPrice = `${product.name}${priceStr}`.slice(0, 90);
    setContentType('product');
    setShortTitleInput((prev) => (overwriteExisting || !prev.trim() ? titleWithPrice : prev));
    setCampaignNameInput((prev) => (overwriteExisting || !prev.trim() ? product.name : prev));
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
    if (notify)
      setBuilderMessage(
        isHebrew ? 'פרטי המוצר יובאו בהצלחה מ-WooCommerce.' : 'Product details imported successfully from WooCommerce.'
      );
  };

  const disableWooImportMode = () => {
    setUseWooProductData(false);
    setBuilderMessage(isHebrew ? 'מצב עריכה ידני' : 'Manual editing mode');
    window.setTimeout(() => shortTitleInputRef.current?.focus(), 0);
  };

  // Auto-import product when selected woo product changes
  useEffect(() => {
    if (!useWooProductData) return;
    if (wooPublishScope !== 'product' || !selectedWooProduct) return;
    importWooProductToBuilder(selectedWooProduct, { overwriteExisting: false, notify: false });
  }, [useWooProductData, wooPublishScope, selectedWooProduct]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Media upload ─────────────────────────────────────────────────
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);

  // Revoke object URLs on unmount / change
  useEffect(() => {
    return () => {
      uploadedAssets.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    };
  }, [uploadedAssets]);

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
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')); };
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
    if (scale >= 1) return { file, width, height };
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, width, height };
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
    return { file: nextFile, width: targetWidth, height: targetHeight };
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

  // ── Schedule ─────────────────────────────────────────────────────
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [selectedSchedulePlatform, setSelectedSchedulePlatform] = useState<string>('Google');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<DayKey>('mon');

  // Sync weekly schedule keys with selected platforms
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

  // Sync schedule platform selector
  useEffect(() => {
    if (connectedAdPlatforms.length === 0) return;
    setSelectedSchedulePlatform((prev) =>
      connectedAdPlatforms.includes(prev) ? prev : connectedAdPlatforms[0]
    );
  }, [connectedAdPlatforms]);

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

  // ── Time rules ───────────────────────────────────────────────────
  const [timeRules, setTimeRules] = useState<TimeRule[]>([]);
  const [rulePlatform, setRulePlatform] = useState<PlatformName>('Google');
  const [ruleStartHour, setRuleStartHour] = useState<number>(18);
  const [ruleEndHour, setRuleEndHour] = useState<number>(22);
  const [ruleAction, setRuleAction] = useState<RuleAction>('boost');
  const [ruleMinRoas, setRuleMinRoas] = useState<number>(3);
  const [ruleReason, setRuleReason] = useState<string>('');

  // Sync rule platform with connected platforms
  useEffect(() => {
    if (connectedAdPlatforms.length === 0) return;
    setRulePlatform((prev) =>
      connectedAdPlatforms.includes(prev)
        ? (prev as PlatformName)
        : ((connectedAdPlatforms[0] || 'Google') as PlatformName)
    );
  }, [connectedAdPlatforms]);

  const addTimeRule = () => {
    if (!rulePlatform) return;
    const startHour = normalizeHour(ruleStartHour);
    const endHour = normalizeHour(ruleEndHour);
    if (endHour <= startHour) {
      setBuilderMessage(
        isHebrew ? 'שעת סיום חייבת להיות גדולה משעת התחלה.' : 'End hour must be greater than start hour.'
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

  // ── AI processing brief ──────────────────────────────────────────
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
  }, [campaignBrief, useWooProductData, wooPublishScope, selectedWooProduct, isHebrew]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // media
    uploadedAssets,
    handleAssetUpload,
    removeAsset,
    clearUploadedMedia,
    normalizeHour,
    sanitizeHours,
    // schedule
    weeklySchedule, setWeeklySchedule,
    selectedSchedulePlatform, setSelectedSchedulePlatform,
    selectedScheduleDay, setSelectedScheduleDay,
    toggleScheduleHour,
    isFullDaySelected,
    toggleFullDay,
    getActiveSlotsCount,
    // time rules
    timeRules, setTimeRules,
    rulePlatform, setRulePlatform,
    ruleStartHour, setRuleStartHour,
    ruleEndHour, setRuleEndHour,
    ruleAction, setRuleAction,
    ruleMinRoas, setRuleMinRoas,
    ruleReason, setRuleReason,
    addTimeRule,
    removeTimeRule,
    // woo
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
  };
}

import { useState, useEffect, useRef } from 'react';

type GeneratedCreativeContent = {
  type?: string;
  url?: string;
  variations?: string[];
  bgPrompt?: string;
  options?: Array<{ headline: string; primaryText: string; description: string; [key: string]: unknown }>;
  script?: Array<{ time?: string; visual?: string; audio?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};
import { generateCreativeCopy, getAIKeysFromConnections } from '../../lib/gemini';
import { auth, saveAdToFirestore, getSavedAds, type SavedAd } from '../../lib/firebase';
import { fetchWooCommerceProducts } from '../../services/woocommerceService';
import type { Connection } from '../../contexts/ConnectionsContext';
import { resolveWooCredentials } from '../../lib/integrations/woocommerceCredentials';

export type CreativeProduct = {
  id: number;
  name: string;
  shortDesc: string;
  longDesc: string;
  price: string;
  imageUrl?: string | null;
  galleryUrls?: string[];
};

export const mockProductsFallback: CreativeProduct[] = [
  { id: 1, name: 'נעלי ריצה מקצועיות', shortDesc: 'נעלי ריצה נוחות.', longDesc: 'נעלי ריצה מקצועיות עם סוליה בולמת זעזועים.', price: '450', imageUrl: null },
  { id: 2, name: 'שעון חכם ספורט', shortDesc: 'שעון חכם למעקב.', longDesc: 'שעון חכם עם מד דופק, GPS ומעקב שינה.', price: '890', imageUrl: null },
  { id: 3, name: 'אוזניות אלחוטיות', shortDesc: 'אוזניות בלוטוס.', longDesc: 'אוזניות אלחוטיות עם סינון רעשים וסוללה ל-24 שעות.', price: '350', imageUrl: null },
];

function stripHtmlToText(html: string | undefined | null): string {
  if (!html) return '';
  const noTags = html.replace(/<[^>]+>/g, ' ');
  if (typeof document === 'undefined') return noTags.replace(/\s+/g, ' ').trim();
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  return text || noTags.replace(/\s+/g, ' ').trim();
}

export interface UseCreativeLabProps {
  connections: Connection[];
  dataOwnerUid: string | null | undefined;
  isWorkspaceReadOnly: boolean;
  isHebrew: boolean;
}

export function useCreativeLab({ connections, dataOwnerUid, isWorkspaceReadOnly, isHebrew }: UseCreativeLabProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeTab, setActiveTab] = useState<'image' | 'copy' | 'video'>('image');
  const [generatedContent, setGeneratedContent] = useState<GeneratedCreativeContent | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CreativeProduct | null>(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [products, setProducts] = useState<CreativeProduct[]>(mockProductsFallback);
  const [productsLoading, setProductsLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [toast, setToast] = useState<string | null>(null);
  const [savedAds, setSavedAds] = useState<SavedAd[]>([]);
  const [editingCopyIndex, setEditingCopyIndex] = useState<number | null>(null);
  const [overlayHeadline, setOverlayHeadline] = useState('');
  const [overlayCta, setOverlayCta] = useState('');
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [exportedImageUrl, setExportedImageUrl] = useState<string | null>(null);
  const [uploadedProductImageDataUrl, setUploadedProductImageDataUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const productDropdownRef = useRef<HTMLDivElement | null>(null);
  const uploadImageInputRef = useRef<HTMLInputElement>(null);

  const wooConnection = connections.find((c) => c.id === 'woocommerce');
  const isWooConnected = wooConnection?.status === 'connected';
  const aiKeys = getAIKeysFromConnections(connections);
  const scopedUid = dataOwnerUid || auth.currentUser?.uid;

  // AI generation elapsed timer
  useEffect(() => {
    if (!isGenerating || generationStartedAt == null) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - generationStartedAt);
    }, 300);
    return () => window.clearInterval(id);
  }, [isGenerating, generationStartedAt]);

  // Load WooCommerce products
  useEffect(() => {
    if (!isWooConnected) {
      setProducts(mockProductsFallback);
      return;
    }
    const { storeUrl, wooKey, wooSecret } = resolveWooCredentials(
      wooConnection?.settings as Record<string, unknown> | undefined
    );
    if (!storeUrl || !wooKey || !wooSecret) return;
    setProductsLoading(true);
    fetchWooCommerceProducts(storeUrl, wooKey, wooSecret)
      .then((list) => {
        setProducts(
          list.map((p: Record<string, unknown>) => {
            const images: string[] = Array.isArray(p.images)
              ? (p.images as Record<string, unknown>[]).map((img) => String(img?.src || '')).filter(Boolean)
              : [];
            return {
              id: Number(p.id),
              name: stripHtmlToText(String(p.name || '')),
              shortDesc: stripHtmlToText(String(p.short_description || '')),
              longDesc: stripHtmlToText(String(p.description || '')),
              price: p.price ? String(p.price) : '',
              imageUrl: images[0] || null,
              galleryUrls: images.slice(1, 4),
            } as CreativeProduct;
          })
        );
      })
      .catch(() => setProducts(mockProductsFallback))
      .finally(() => setProductsLoading(false));
  }, [isWooConnected, wooConnection?.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved ads
  useEffect(() => {
    if (!scopedUid) return;
    getSavedAds(scopedUid).then(setSavedAds);
  }, [scopedUid]);

  // Close product dropdown on outside click / Escape
  useEffect(() => {
    if (!isProductDropdownOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (productDropdownRef.current?.contains(target)) return;
      setIsProductDropdownOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsProductDropdownOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isProductDropdownOpen]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const launchCampaign = () => {
    try {
      const prefill: Record<string, unknown> = {};
      if (selectedProduct?.name) prefill.campaignName = selectedProduct.name;
      if (selectedProduct?.name) prefill.shortTitle = selectedProduct.price
        ? `${selectedProduct.name} – ₪${selectedProduct.price}`
        : selectedProduct.name;
      if (selectedProduct?.shortDesc || prompt) prefill.brief = selectedProduct?.shortDesc || prompt;
      if (generatedContent?.type === 'copy' && generatedContent.options?.[0]) {
        prefill.platformCopy = { Google: generatedContent.options[0], Meta: generatedContent.options[0] };
      }
      if (exportedImageUrl) prefill.imageDataUrl = exportedImageUrl;
      else if (uploadedProductImageDataUrl) prefill.imageDataUrl = uploadedProductImageDataUrl;
      sessionStorage.setItem('bscale:creative-prefill', JSON.stringify(prefill));
    } catch {
      // ignore storage errors
    }
    window.history.pushState({}, '', '/campaigns');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const buildBackgroundPrompt = (product: CreativeProduct | null, userPrompt: string): string => {
    const name = product?.name || (isHebrew ? 'מוצר' : 'product');
    const category = product?.shortDesc || userPrompt || '';
    const catLower = (name + ' ' + category).toLowerCase();
    let bgStyle = isHebrew
      ? 'רקע סטודיו נקי עם תאורה רכה ומקצועית'
      : 'clean studio background with soft professional lighting';
    if (catLower.match(/נעל|נעלי|shoes?|sneaker|boot/i))
      bgStyle = isHebrew ? 'רחוב עירוני ברקע, תאורת ניאון, גשם קל, פודה רטוב' : 'urban street background, neon reflections, light rain, wet pavement';
    else if (catLower.match(/שעון|watch|sport|ספורט/i))
      bgStyle = isHebrew ? 'רקע טבעי דינמי עם עשב ירוק, אנרגיה ותנועה' : 'dynamic nature background, green grass, motion energy';
    else if (catLower.match(/אוזני|headphone|earphone|audio/i))
      bgStyle = isHebrew ? 'רקע גרדיאנט כהה עם גלי מוזיקה, אווירת סטודיו' : 'dark gradient background with music wave patterns, studio mood';
    else if (catLower.match(/ביוטי|קרם|שמפו|beauty|cream|cosmetic|skincare/i))
      bgStyle = isHebrew ? 'פרחים לבנים, שיש קלאסי, תאורה ורודה עדינה' : 'white flowers, classic marble surface, soft pink pastel light';
    else if (catLower.match(/ריהוט|ספה|שולחן|כסא|furniture|sofa|table|chair/i))
      bgStyle = isHebrew ? 'חדר מגורים מודרני עם תאורת אמבינט חמה' : 'modern living room with warm ambient lighting';
    else if (catLower.match(/אוכל|מזון|food|coffee|cake|שתייה/i))
      bgStyle = isHebrew ? 'שיש לבן עם עלי ירוק טרי וחאריף, תאורת יום טבעית' : 'white marble with fresh green herbs, natural daylight';
    else if (catLower.match(/טכנולוג|tech|laptop|phone|טלפון|מחשב/i))
      bgStyle = isHebrew ? 'רקע גאומטרי כהה, צבעי ניאון, אווירת סייברפאנק' : 'dark geometric background, neon accents, cyberpunk mood';
    else if (catLower.match(/בגד|חולצה|שמלה|fashion|clothing|dress|shirt/i))
      bgStyle = isHebrew ? 'רקע לבן מינימליסטי או גרדיאנט פסטל, סטודיו מקצועי' : 'minimalist white or pastel gradient, professional studio';

    return isHebrew
      ? `שנה את הרקע של תמונת המוצר "${name}" ל: ${bgStyle}.\nחשוב מאוד: אל תשנה, תחתוך, תעוות או תגע במוצר עצמו בשום צורה. המוצר חייב להישאר במרכז התמונה, ברור ובולט. הרקע בלבד ישתנה.`
      : `Replace the background of the product photo "${name}" with: ${bgStyle}.\nIMPORTANT: Do NOT modify, crop, distort or touch the product itself in any way. The product must remain centered, sharp and prominent. Only the background should change.`;
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedProductImageDataUrl(dataUrl);
      if (!prompt) setPrompt(buildBackgroundPrompt(selectedProduct, ''));
      showToast(isHebrew ? 'תמונת המוצר הועלתה בהצלחה' : 'Product image uploaded');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast(isHebrew ? 'הועתק ללוח' : 'Copied to clipboard');
  };

  const handlePublishTo = (platform: 'google' | 'meta' | 'tiktok') => {
    const conn = connections.find((c) => c.id === platform);
    if (conn?.status !== 'connected') {
      showToast(
        isHebrew
          ? `חבר את ${platform === 'google' ? 'Google' : platform === 'meta' ? 'Meta' : 'TikTok'} Ads בהתחברויות כדי לפרסם.`
          : `Connect ${platform === 'google' ? 'Google' : platform === 'meta' ? 'Meta' : 'TikTok'} Ads in Integrations to publish.`
      );
      return;
    }
    showToast(isHebrew ? 'הקריאייטיב מוכן לפרסום. עבור לאישורים ואוטומציות לשליחה.' : 'Creative is ready to publish. Open Approvals & Automations to continue.');
  };

  const handleSaveAdCopy = async (option: { headline: string; primaryText: string; description: string }) => {
    if (isWorkspaceReadOnly) {
      showToast(isHebrew ? 'מצב צפייה בלבד פעיל. לא ניתן לשמור נתונים.' : 'View-only mode is active. Saving is disabled.');
      return;
    }
    if (!scopedUid) {
      showToast(isHebrew ? 'יש להתחבר כדי לשמור מודעה.' : 'Sign in to save ads.');
      return;
    }
    try {
      const id = await saveAdToFirestore(scopedUid, {
        type: 'copy',
        createdAt: new Date().toISOString(),
        productName: selectedProduct?.name,
        payload: { headline: option.headline, primaryText: option.primaryText, description: option.description },
      });
      setSavedAds((prev) => [...prev, { id, type: 'copy', createdAt: new Date().toISOString(), productName: selectedProduct?.name, payload: option }]);
      showToast(isHebrew ? 'המודעה נשמרה בהצלחה.' : 'Ad saved successfully.');
    } catch {
      showToast(isHebrew ? 'שמירה נכשלה.' : 'Save failed.');
    }
  };

  const handleSaveAdImage = async (imageDataUrl: string) => {
    if (isWorkspaceReadOnly) {
      showToast(isHebrew ? 'מצב צפייה בלבד פעיל. לא ניתן לשמור נתונים.' : 'View-only mode is active. Saving is disabled.');
      return;
    }
    if (!scopedUid) {
      showToast(isHebrew ? 'יש להתחבר כדי לשמור מודעה.' : 'Sign in to save ads.');
      return;
    }
    try {
      await saveAdToFirestore(scopedUid, {
        type: 'image',
        createdAt: new Date().toISOString(),
        productName: selectedProduct?.name,
        payload: { imageDataUrl, overlayHeadline, overlayCta },
      });
    } catch {
      showToast(isHebrew ? 'שמירה נכשלה.' : 'Save failed.');
      return;
    }
    showToast(isHebrew ? 'המודעה נשמרה בהצלחה.' : 'Ad saved successfully.');
  };

  const updateCopyOption = (idx: number, field: 'headline' | 'primaryText' | 'description', value: string) => {
    setGeneratedContent((prev) => {
      if (!prev?.options) return prev;
      const next = { ...prev, options: [...prev.options] };
      next.options[idx] = { ...next.options[idx], [field]: value };
      return next;
    });
  };

  const drawCanvas = (imgUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) { resolve(''); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = 800;
        const h = 800;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        const yTop = 120;
        const yCenter = h / 2;
        const yBottom = h - 80;
        const y = overlayPosition === 'top' ? yTop : overlayPosition === 'center' ? yCenter : yBottom;
        if (overlayHeadline) ctx.fillText(overlayHeadline, w / 2, y);
        ctx.font = '24px Arial';
        const ctaY = overlayPosition === 'top' ? yTop + 50 : overlayPosition === 'center' ? yCenter + 50 : yBottom + 40;
        if (overlayCta) ctx.fillText(overlayCta, w / 2, ctaY);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = imgUrl;
    });
  };

  const exportImageWithOverlay = async () => {
    const url = generatedContent?.type === 'image' ? generatedContent.url : null;
    if (!url) return;
    const dataUrl = await drawCanvas(url);
    setExportedImageUrl(dataUrl);
  };

  const handleDownloadComposite = () => {
    if (!exportedImageUrl) return;
    const a = document.createElement('a');
    a.href = exportedImageUrl;
    a.download = 'creative-overlay.png';
    a.click();
  };

  const handleSaveAdImageClick = async () => {
    const url = generatedContent?.type === 'image' ? generatedContent.url : null;
    if (!url) return;
    const dataUrl = await drawCanvas(url);
    if (dataUrl) await handleSaveAdImage(dataUrl);
  };

  // Re-draw canvas when image or overlay changes
  useEffect(() => {
    if (generatedContent?.type === 'image' && generatedContent.url) {
      drawCanvas(generatedContent.url).then((dataUrl) => dataUrl && setExportedImageUrl(dataUrl));
    }
  }, [generatedContent?.url, overlayHeadline, overlayCta, overlayPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggestOverlayFromAI = async () => {
    if (!aiKeys || (!selectedProduct && !prompt)) {
      showToast(
        isHebrew
          ? 'כדי לקבל הצעה מה‑AI, חבר מנועי AI בהתחברויות והגדר מוצר או תיאור.'
          : 'To get an AI suggestion, connect AI providers in Integrations and choose a product or prompt.'
      );
      return;
    }
    setIsGenerating(true);
    setGenerationStartedAt(Date.now());
    setElapsedMs(0);
    try {
      const baseName = selectedProduct?.name || (isHebrew ? 'מוצר' : 'Product');
      const baseDesc = selectedProduct?.longDesc || prompt || '';
      const res = await generateCreativeCopy(
        baseName,
        baseDesc,
        (prompt || '') + (isHebrew ? '\nהתמקד בהצעת כותרת קצרה ו‑CTA חזק בעברית.' : '\nFocus on a short headline and a strong CTA in English.'),
        aiKeys
      );
      const first = Array.isArray(res.options) && res.options[0] ? res.options[0] : null;
      if (first) {
        setOverlayHeadline(first.headline || baseName);
        setOverlayCta(first.description || (isHebrew ? 'קנה עכשיו' : 'Buy now'));
        showToast(isHebrew ? 'ה‑AI הציע כותרת ו‑CTA למודעה.' : 'AI suggested an ad headline and CTA.');
      } else {
        showToast(isHebrew ? 'לא התקבלה הצעה מה‑AI, נסה ניסוח שונה.' : 'No AI suggestion was returned. Try a different prompt.');
      }
    } catch (e) {
      console.error('Failed to suggest overlay from AI', e);
      showToast(isHebrew ? 'קריאת ה‑AI נכשלה. נסה שוב מאוחר יותר.' : 'AI request failed. Please try again later.');
    } finally {
      setIsGenerating(false);
      setGenerationStartedAt(null);
      setElapsedMs(0);
    }
  };

  const handleGenerate = async () => {
    if (!prompt && !selectedProduct) return;
    setIsGenerating(true);
    setGenerationStartedAt(Date.now());
    setElapsedMs(0);

    if (activeTab === 'copy' && selectedProduct) {
      try {
        const res = await generateCreativeCopy(selectedProduct.name, selectedProduct.longDesc, prompt, aiKeys);
        setGeneratedContent({ type: 'copy', options: res.options || [] });
      } catch (error) {
        console.error('Failed to generate copy', error);
      }
      setIsGenerating(false);
      setGenerationStartedAt(null);
      setElapsedMs(0);
      return;
    }

    if (activeTab === 'image') {
      const mainUrl =
        uploadedProductImageDataUrl ||
        selectedProduct?.imageUrl ||
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800&h=800';
      const variations =
        selectedProduct?.galleryUrls && selectedProduct.galleryUrls.length > 0
          ? selectedProduct.galleryUrls
          : [
              'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=200&h=200',
              'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=200&h=200',
              'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=200&h=200',
            ];
      if (!prompt) setPrompt(buildBackgroundPrompt(selectedProduct, ''));
      setGeneratedContent({
        type: 'image',
        url: mainUrl,
        variations,
        bgPrompt: buildBackgroundPrompt(selectedProduct, prompt),
      });
      setIsGenerating(false);
      setGenerationStartedAt(null);
      setElapsedMs(0);
      return;
    }

    if (activeTab === 'video') {
      setTimeout(() => {
        setGeneratedContent({
          type: 'video',
          script: [
            { time: '0:00-0:05', visual: 'צילום תקריב של המוצר בתאורה דרמטית', audio: 'כל רגע הוא הזדמנות לסיפור חדש.' },
            { time: '0:05-0:15', visual: 'לקוח משתמש במוצר בסביבה יומיומית', audio: 'כשאתה בוחר איכות, כל יום מרגיש אחרת.' },
            { time: '0:15-0:30', visual: 'לוגו המותג וקריאה לפעולה', audio: 'BScale AI. תן למודעות שלך לעבוד חכם יותר. קנה עכשיו.' },
          ],
        });
        setIsGenerating(false);
        setGenerationStartedAt(null);
        setElapsedMs(0);
      }, 2000);
      return;
    }
  };

  return {
    // state
    prompt, setPrompt,
    isGenerating,
    elapsedMs,
    activeTab, setActiveTab,
    generatedContent, setGeneratedContent,
    selectedProduct, setSelectedProduct,
    isProductDropdownOpen, setIsProductDropdownOpen,
    products,
    productsLoading,
    aspectRatio, setAspectRatio,
    toast,
    savedAds,
    editingCopyIndex, setEditingCopyIndex,
    overlayHeadline, setOverlayHeadline,
    overlayCta, setOverlayCta,
    overlayPosition, setOverlayPosition,
    exportedImageUrl,
    uploadedProductImageDataUrl, setUploadedProductImageDataUrl,
    // refs
    canvasRef,
    productDropdownRef,
    uploadImageInputRef,
    // computed
    isWooConnected,
    aiKeys,
    // handlers
    showToast,
    launchCampaign,
    buildBackgroundPrompt,
    handleProductImageUpload,
    handleCopyText,
    handlePublishTo,
    handleSaveAdCopy,
    handleSaveAdImage,
    updateCopyOption,
    drawCanvas,
    exportImageWithOverlay,
    handleDownloadComposite,
    handleSaveAdImageClick,
    handleSuggestOverlayFromAI,
    handleGenerate,
  };
}

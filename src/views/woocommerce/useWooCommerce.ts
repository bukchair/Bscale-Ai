import { useEffect, useState } from 'react';
import { fetchWooCommerceProducts, updateWooCommerceProduct } from '../../services/woocommerceService';
import { getAIKeysFromConnections } from '../../lib/gemini';
import { requestJSON, type AIKeys } from '../../lib/multiAI';
import type { Connection } from '../../contexts/ConnectionsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WooProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number | null;
  short_description: string;
  description: string;
  price: string;
  categories: { name: string }[];
  images: { src: string; alt: string }[];
}

export type SeoSuggestion = {
  engineId: keyof AIKeys;
  engineLabel: string;
  longDescription: string;
  metaDescription: string;
  metaTitle: string;
  focusKeyword?: string;
  imageAltTexts: string[];
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWooCommerceProps {
  connections: Connection[];
  errorLoadingLabel: string;
}

export function useWooCommerce({ connections, errorLoadingLabel }: UseWooCommerceProps) {
  const wooConnection = connections.find((c) => c.id === 'woocommerce');
  const isConnected = wooConnection?.status === 'connected';
  const { storeUrl, wooKey, wooSecret } = wooConnection?.settings || {};
  const aiKeys = getAIKeysFromConnections(connections);

  // ── State ──────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<WooProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<WooProduct | null>(null);
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeoLoading, setIsSeoLoading] = useState(false);
  const [isSeoSaving, setIsSeoSaving] = useState(false);
  const [seoSuggestions, setSeoSuggestions] = useState<SeoSuggestion[]>([]);
  const [activeSeoIndex, setActiveSeoIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) {
      setProducts([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWooCommerceProducts(storeUrl, wooKey, wooSecret);
      setProducts(data);
    } catch (err) {
      setError(errorLoadingLabel);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const buildSeoPrompt = (product: WooProduct) => {
    const categories = product.categories?.map((c) => c.name).join(', ') || '';
    return (
      `אתה מומחה SEO לוורדפרס + WooCommerce, Rank Math ו‑Yoast.\n` +
      `המטרה: לשפר SEO למוצר בחנות WooCommerce בעברית.\n\n` +
      `פרטי מוצר קיימים:\n` +
      `שם מוצר: ${product.name}\n` +
      `SKU: ${product.sku || '-'}\n` +
      `קטגוריות: ${categories}\n` +
      `תיאור קצר (WooCommerce): ${product.short_description || '-'}\n` +
      `תיאור מלא (WooCommerce): ${product.description || '-'}\n\n` +
      `החזר אך ורק JSON עם המפתח הבודד "suggestion" במבנה הבא (ללא טקסט נוסף):\n` +
      `{\n` +
      `  "suggestion": {\n` +
      `    "longDescription": "תיאור מלא חדש ומפורט למוצר (WooCommerce description) בעברית תקינה, מתאים ל‑SEO",\n` +
      `    "metaTitle": "כותרת SEO מומלצת בעברית, עד ~60 תווים, מתאימה ל‑Rank Math ו‑Yoast",\n` +
      `    "metaDescription": "תיאור מטא בעברית, עד ~155 תווים, משכנע ומכיל מילות מפתח רלוונטיות",\n` +
      `    "focusKeyword": "מילת מפתח/ביטוי מפתח מרכזי בעברית",\n` +
      `    "imageAltTexts": [\n` +
      `      "טקסט אלטרנטיבי לתמונה ראשית בעברית",\n` +
      `      "טקסט אלטרנטיבי לתמונה שנייה בעברית",\n` +
      `      "טקסט אלטרנטיבי לתמונה שלישית בעברית"\n` +
      `    ]\n` +
      `  }\n` +
      `}\n\n` +
      `הטקסטים צריכים להיות מותאמים במיוחד לפורמט ש‑Rank Math ו‑Yoast אוהבים (meta title + meta description + focus keyword).`
    );
  };

  const handleOptimizeSeo = async () => {
    if (!selectedProduct) return;
    setError(null);

    const hasAnyKey = aiKeys.gemini || aiKeys.openai || aiKeys.claude;
    if (!hasAnyKey) {
      setError('כדי לבצע אופטימיזציית SEO עם AI, חבר לפחות אחד מהמנועים Gemini / OpenAI / Claude במסך חיבורים.');
      return;
    }

    setIsSeoLoading(true);
    try {
      const prompt = buildSeoPrompt(selectedProduct);
      const engines: { id: keyof AIKeys; label: string }[] = [
        { id: 'gemini', label: 'Gemini' },
        { id: 'openai', label: 'OpenAI' },
        { id: 'claude', label: 'Claude' },
      ];
      const suggestions: SeoSuggestion[] = [];

      for (const engine of engines) {
        const key = aiKeys[engine.id];
        if (!key) continue;

        const singleKeys: AIKeys = {
          gemini: engine.id === 'gemini' ? key : undefined,
          openai: engine.id === 'openai' ? key : undefined,
          claude: engine.id === 'claude' ? key : undefined,
        };

        try {
          const { data } = await requestJSON<{ suggestion?: Partial<SeoSuggestion> }>(prompt, singleKeys);
          const s = data?.suggestion || {};
          suggestions.push({
            engineId: engine.id,
            engineLabel: engine.label,
            longDescription: s.longDescription || selectedProduct.description || '',
            metaDescription: s.metaDescription || selectedProduct.short_description || '',
            metaTitle: s.metaTitle || selectedProduct.name || '',
            focusKeyword: s.focusKeyword || '',
            imageAltTexts:
              Array.isArray(s.imageAltTexts) && s.imageAltTexts.length
                ? (s.imageAltTexts as string[]).slice(0, 3)
                : [
                    selectedProduct.name,
                    `${selectedProduct.name} - מוצר`,
                    `${selectedProduct.name} בחנות אונליין`,
                  ],
          });
        } catch (e) {
          console.warn(`SEO suggestion failed for ${engine.label}`, e);
        }
      }

      if (!suggestions.length) {
        setError('קריאת ה‑AI נכשלה עבור כל המנועים. בדוק את המפתחות או נסה שוב מאוחר יותר.');
        setSeoSuggestions([]);
        return;
      }

      setSeoSuggestions(suggestions);
      setActiveSeoIndex(0);
    } finally {
      setIsSeoLoading(false);
    }
  };

  const updateSeoField = (index: number, field: keyof SeoSuggestion, value: string) => {
    setSeoSuggestions((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (field === 'imageAltTexts') return prev;
      next[index] = { ...current, [field]: value } as SeoSuggestion;
      return next;
    });
  };

  const updateAltText = (index: number, altIndex: number, value: string) => {
    setSeoSuggestions((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      const alts = [...current.imageAltTexts];
      alts[altIndex] = value;
      next[index] = { ...current, imageAltTexts: alts };
      return next;
    });
  };

  const handleSaveSeo = async (suggestion: SeoSuggestion) => {
    if (!selectedProduct) return;
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) {
      setError(errorLoadingLabel);
      return;
    }
    setIsSeoSaving(true);
    setError(null);
    try {
      await updateWooCommerceProduct(storeUrl, wooKey, wooSecret, selectedProduct.id, {
        description: suggestion.longDescription,
        short_description: suggestion.metaDescription,
        meta_data: [
          { key: '_yoast_wpseo_metadesc', value: suggestion.metaDescription },
          { key: '_yoast_wpseo_title', value: suggestion.metaTitle },
          { key: '_yoast_wpseo_focuskw', value: suggestion.focusKeyword || '' },
          { key: 'rank_math_description', value: suggestion.metaDescription },
          { key: 'rank_math_title', value: suggestion.metaTitle },
        ],
      });
      alert('SEO של המוצר עודכן בהצלחה (WooCommerce + Rank Math / Yoast meta).');
      await fetchProducts();
    } catch (err) {
      console.error('Update SEO failed:', err);
      setError('שמירת אופטימיזציית ה‑SEO נכשלה. נסה שוב מאוחר יותר.');
    } finally {
      setIsSeoSaving(false);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected) void fetchProducts();
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSeoSuggestions([]);
    if (selectedProduct) setShowListOnMobile(false);
  }, [selectedProduct]);

  return {
    // connection
    isConnected,
    // state
    products,
    selectedProduct, setSelectedProduct,
    showListOnMobile, setShowListOnMobile,
    isLoading,
    isSeoLoading,
    isSeoSaving,
    seoSuggestions,
    activeSeoIndex, setActiveSeoIndex,
    error,
    // handlers
    fetchProducts,
    handleOptimizeSeo,
    updateSeoField,
    updateAltText,
    handleSaveSeo,
  };
}

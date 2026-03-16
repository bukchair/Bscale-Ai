import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Loader2,
  Sparkles,
  ShoppingBag,
  PenLine,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  AlertCircle,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { generateAdCopy, getAIKeysFromConnections } from '../../lib/gemini';
import { fetchWooCommerceProducts } from '../../services/woocommerceService';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformName = 'Google' | 'Meta' | 'TikTok';

type Connection = {
  id: string;
  status?: string;
  settings?: Record<string, string>;
};

type WooProduct = {
  id: number;
  name: string;
  price?: string;
  short_description?: string;
  description?: string;
  sku?: string;
  categories?: Array<{ name: string }>;
  images?: Array<{ src: string }>;
};

type ManualProduct = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
};

type AdCopyDraft = {
  headline: string;
  body: string;
  cta: string;
};

type ProductSource = 'woocommerce' | 'manual';

type Step = 1 | 2 | 3 | 4;

interface CreateAdModalProps {
  open: boolean;
  onClose: () => void;
  connections: Connection[];
  isHebrew: boolean;
}

// ─── Platform colours ──────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<PlatformName, string> = {
  Google: 'bg-blue-50 border-blue-200 text-blue-700',
  Meta: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  TikTok: 'bg-pink-50 border-pink-200 text-pink-700',
};

const PLATFORM_BADGE: Record<PlatformName, string> = {
  Google: 'bg-blue-100 text-blue-800',
  Meta: 'bg-indigo-100 text-indigo-800',
  TikTok: 'bg-pink-100 text-pink-800',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ─── Component ─────────────────────────────────────────────────────────────────

export function CreateAdModal({ open, onClose, connections, isHebrew }: CreateAdModalProps) {
  // Step
  const [step, setStep] = useState<Step>(1);

  // Source
  const [productSource, setProductSource] = useState<ProductSource>('woocommerce');

  // WooCommerce
  const [wooProducts, setWooProducts] = useState<WooProduct[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [wooError, setWooError] = useState('');
  const [wooSearch, setWooSearch] = useState('');
  const [selectedWooProduct, setSelectedWooProduct] = useState<WooProduct | null>(null);

  // Manual product
  const [manualProduct, setManualProduct] = useState<ManualProduct>({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
  });

  // Platform & Audience
  const [platforms, setPlatforms] = useState<PlatformName[]>(['Meta']);
  const [targetAudience, setTargetAudience] = useState('');

  // AI copies
  const [adCopies, setAdCopies] = useState<Partial<Record<PlatformName, AdCopyDraft>>>({});
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  // ── Derived ────────────────────────────────────────────────────────────────

  const wooConnection = connections.find(
    (c) => c.id === 'woocommerce' && c.status === 'connected'
  );
  const isWooConnected = Boolean(wooConnection);

  const aiKeys = getAIKeysFromConnections(
    connections.map((c) => ({ id: c.id, settings: c.settings }))
  );

  const effectiveProduct: { name: string; description: string; price: string } =
    productSource === 'woocommerce' && selectedWooProduct
      ? {
          name: selectedWooProduct.name,
          description: stripHtml(
            selectedWooProduct.short_description || selectedWooProduct.description || ''
          ).slice(0, 300),
          price: selectedWooProduct.price || '',
        }
      : {
          name: manualProduct.name,
          description: manualProduct.description,
          price: manualProduct.price,
        };

  const canProceedStep1 = productSource === 'manual' || isWooConnected;
  const canProceedStep2 =
    productSource === 'manual'
      ? manualProduct.name.trim().length > 0
      : selectedWooProduct !== null;
  const canProceedStep3 = platforms.length > 0;

  // ── Reset when closed ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setStep(1);
      setProductSource('woocommerce');
      setWooProducts([]);
      setWooLoading(false);
      setWooError('');
      setWooSearch('');
      setSelectedWooProduct(null);
      setManualProduct({ name: '', description: '', price: '', imageUrl: '' });
      setPlatforms(['Meta']);
      setTargetAudience('');
      setAdCopies({});
      setGenerating(false);
      setGenerateError('');
      setCopiedKey('');
    }
  }, [open]);

  // ── Load WooCommerce products ──────────────────────────────────────────────

  const loadWooProducts = useCallback(async () => {
    if (!wooConnection?.settings) return;
    const { storeUrl, wooKey, wooSecret } = wooConnection.settings;
    if (!storeUrl || !wooKey || !wooSecret) return;
    setWooLoading(true);
    setWooError('');
    try {
      const products = await fetchWooCommerceProducts(storeUrl, wooKey, wooSecret, {
        fallbackToMock: false,
      });
      setWooProducts((products as WooProduct[]) || []);
    } catch {
      setWooError(isHebrew ? 'שגיאה בטעינת מוצרים מהחנות.' : 'Failed to load products from store.');
    } finally {
      setWooLoading(false);
    }
  }, [wooConnection, isHebrew]);

  useEffect(() => {
    if (open && step === 2 && productSource === 'woocommerce' && isWooConnected && wooProducts.length === 0 && !wooLoading) {
      loadWooProducts();
    }
  }, [open, step, productSource, isWooConnected, wooProducts.length, wooLoading, loadWooProducts]);

  // ── Generate AI copies ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!effectiveProduct.name) return;
    setGenerating(true);
    setGenerateError('');
    const audience = targetAudience.trim() || (isHebrew ? 'קהל כללי' : 'General audience');
    const results: Partial<Record<PlatformName, AdCopyDraft>> = { ...adCopies };

    for (const platform of platforms) {
      try {
        const copy = await generateAdCopy(
          `${effectiveProduct.name}${effectiveProduct.price ? ` - ₪${effectiveProduct.price}` : ''}${effectiveProduct.description ? `. ${effectiveProduct.description}` : ''}`,
          platform,
          audience,
          aiKeys
        );
        results[platform] = {
          headline: String((copy as Record<string, unknown>)?.headline || ''),
          body: String((copy as Record<string, unknown>)?.body || ''),
          cta: String((copy as Record<string, unknown>)?.cta || ''),
        };
      } catch {
        results[platform] = {
          headline: '',
          body: isHebrew ? 'שגיאה ביצירת קופי. נסה שוב.' : 'Error generating copy. Please retry.',
          cta: '',
        };
      }
    }
    setAdCopies(results);
    setGenerating(false);
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // ── Filter products ────────────────────────────────────────────────────────

  const filteredProducts = wooProducts.filter((p) =>
    p.name.toLowerCase().includes(wooSearch.toLowerCase())
  );

  // ── Early return ───────────────────────────────────────────────────────────

  if (!open) return null;

  // ── Step labels ────────────────────────────────────────────────────────────

  const stepLabels = isHebrew
    ? ['מקור מוצר', 'פרטי מוצר', 'פלטפורמות', 'קופי AI']
    : ['Product source', 'Product details', 'Platforms', 'AI copy'];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white/90" />
            <h2 className="text-base font-bold text-white">
              {isHebrew ? 'יצירת מודעה חדשה' : 'Create new ad'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {stepLabels.map((label, idx) => {
              const s = (idx + 1) as Step;
              const done = step > s;
              const active = step === s;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : s}
                    </div>
                    <span className={cn('text-xs font-medium hidden sm:block', active ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-gray-400')}>
                      {label}
                    </span>
                  </div>
                  {idx < stepLabels.length - 1 && (
                    <div className={cn('flex-1 h-0.5 mx-1 rounded', done ? 'bg-emerald-400' : 'bg-gray-200')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Step 1: Product source ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                {isHebrew
                  ? 'בחר מאיפה תגיע המוצר שברצונך לפרסם:'
                  : 'Choose where your product will come from:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* WooCommerce */}
                <button
                  type="button"
                  onClick={() => setProductSource('woocommerce')}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-start',
                    productSource === 'woocommerce'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 bg-white'
                  )}
                >
                  <ShoppingBag
                    className={cn('w-6 h-6 mt-0.5 flex-shrink-0', productSource === 'woocommerce' ? 'text-indigo-600' : 'text-gray-400')}
                  />
                  <div>
                    <p className={cn('font-semibold text-sm', productSource === 'woocommerce' ? 'text-indigo-700' : 'text-gray-700')}>
                      WooCommerce
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isHebrew ? 'בחר מוצר ישירות מהחנות המחוברת' : 'Pick a product from your connected store'}
                    </p>
                    {!isWooConnected && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {isHebrew ? 'חיבור WooCommerce נדרש' : 'WooCommerce connection required'}
                      </p>
                    )}
                  </div>
                </button>

                {/* Manual */}
                <button
                  type="button"
                  onClick={() => setProductSource('manual')}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-start',
                    productSource === 'manual'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  )}
                >
                  <PenLine
                    className={cn('w-6 h-6 mt-0.5 flex-shrink-0', productSource === 'manual' ? 'text-purple-600' : 'text-gray-400')}
                  />
                  <div>
                    <p className={cn('font-semibold text-sm', productSource === 'manual' ? 'text-purple-700' : 'text-gray-700')}>
                      {isHebrew ? 'הזנה ידנית' : 'Manual entry'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isHebrew ? 'הזן פרטי מוצר/שירות ללא תלות בחנות' : 'Enter product/service details without a store'}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Product details ─────────────────────────────────── */}
          {step === 2 && productSource === 'woocommerce' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute top-2.5 start-3 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={wooSearch}
                  onChange={(e) => setWooSearch(e.target.value)}
                  placeholder={isHebrew ? 'חיפוש מוצר...' : 'Search product...'}
                  className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Loading / Error */}
              {wooLoading && (
                <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{isHebrew ? 'טוען מוצרים...' : 'Loading products...'}</span>
                </div>
              )}
              {wooError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {wooError}
                  <button onClick={loadWooProducts} className="ms-auto text-xs underline">
                    {isHebrew ? 'נסה שוב' : 'Retry'}
                  </button>
                </div>
              )}

              {/* Product list */}
              {!wooLoading && !wooError && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {isHebrew ? 'לא נמצאו מוצרים' : 'No products found'}
                    </p>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedWooProduct(product)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start',
                          selectedWooProduct?.id === product.id
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300 bg-white'
                        )}
                      >
                        {product.images?.[0]?.src ? (
                          <img
                            src={product.images[0].src}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {product.price && (
                              <span className="text-xs text-emerald-600 font-medium">₪{product.price}</span>
                            )}
                            {product.categories?.[0]?.name && (
                              <span className="text-xs text-gray-400">{product.categories[0].name}</span>
                            )}
                          </div>
                        </div>
                        {selectedWooProduct?.id === product.id && (
                          <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && productSource === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isHebrew ? 'שם מוצר / שירות *' : 'Product / service name *'}
                </label>
                <input
                  type="text"
                  value={manualProduct.name}
                  onChange={(e) => setManualProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder={isHebrew ? 'למשל: נעלי ריצה Pro Series' : 'e.g. Pro Series Running Shoes'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isHebrew ? 'תיאור קצר' : 'Short description'}
                </label>
                <textarea
                  rows={3}
                  value={manualProduct.description}
                  onChange={(e) => setManualProduct((p) => ({ ...p, description: e.target.value }))}
                  placeholder={isHebrew ? 'מה מיוחד במוצר/שירות הזה?' : 'What makes this product/service special?'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isHebrew ? 'מחיר (אופציונלי)' : 'Price (optional)'}
                  </label>
                  <input
                    type="text"
                    value={manualProduct.price}
                    onChange={(e) => setManualProduct((p) => ({ ...p, price: e.target.value }))}
                    placeholder="₪149"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isHebrew ? 'קישור לתמונה (אופציונלי)' : 'Image URL (optional)'}
                  </label>
                  <input
                    type="text"
                    value={manualProduct.imageUrl}
                    onChange={(e) => setManualProduct((p) => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Platforms & Audience ────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {isHebrew ? 'פלטפורמות לפרסום *' : 'Target platforms *'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['Google', 'Meta', 'TikTok'] as PlatformName[]).map((p) => {
                    const active = platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setPlatforms((prev) =>
                            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                          )
                        }
                        className={cn(
                          'px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all',
                          active ? PLATFORM_COLORS[p] + ' border-current' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                {platforms.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {isHebrew ? 'יש לבחור לפחות פלטפורמה אחת' : 'Select at least one platform'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isHebrew ? 'קהל יעד (אופציונלי)' : 'Target audience (optional)'}
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder={isHebrew ? 'למשל: נשים 25–45 שמתעניינות באופנה' : 'e.g. Women 25–45 interested in fashion'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Product summary card */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                  {isHebrew ? 'מוצר נבחר' : 'Selected product'}
                </p>
                <p className="text-sm font-bold text-gray-800">{effectiveProduct.name || '—'}</p>
                {effectiveProduct.price && (
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">₪{effectiveProduct.price}</p>
                )}
                {effectiveProduct.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{effectiveProduct.description}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: AI Copy ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Generate button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {isHebrew
                    ? 'לחץ על "צור קופי" לקבלת טקסטי מודעה מותאמים לכל פלטפורמה:'
                    : 'Click "Generate copy" to get platform-tailored ad texts:'}
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex-shrink-0"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : Object.keys(adCopies).length > 0 ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isHebrew
                    ? Object.keys(adCopies).length > 0 ? 'צור מחדש' : 'צור קופי'
                    : Object.keys(adCopies).length > 0 ? 'Regenerate' : 'Generate copy'}
                </button>
              </div>

              {generateError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {generateError}
                </div>
              )}

              {/* Per-platform copy cards */}
              {platforms.map((platform) => {
                const draft = adCopies[platform];
                return (
                  <div key={platform} className={cn('rounded-xl border p-4 space-y-3', PLATFORM_COLORS[platform])}>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', PLATFORM_BADGE[platform])}>
                        {platform}
                      </span>
                      {draft && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              platform,
                              `${draft.headline}\n\n${draft.body}\n\n${draft.cta}`
                            )
                          }
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          {copiedKey === platform ? (
                            <><Check className="w-3 h-3 text-emerald-500" />{isHebrew ? 'הועתק' : 'Copied'}</>
                          ) : (
                            <><Copy className="w-3 h-3" />{isHebrew ? 'העתק הכל' : 'Copy all'}</>
                          )}
                        </button>
                      )}
                    </div>

                    {generating && !draft ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isHebrew ? 'מייצר קופי...' : 'Generating...'}
                      </div>
                    ) : draft ? (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                            {isHebrew ? 'כותרת' : 'Headline'}
                          </label>
                          <input
                            type="text"
                            value={draft.headline}
                            onChange={(e) =>
                              setAdCopies((prev) => ({
                                ...prev,
                                [platform]: { ...prev[platform]!, headline: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                            {isHebrew ? 'גוף הטקסט' : 'Body text'}
                          </label>
                          <textarea
                            rows={3}
                            value={draft.body}
                            onChange={(e) =>
                              setAdCopies((prev) => ({
                                ...prev,
                                [platform]: { ...prev[platform]!, body: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-current resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-0.5">
                            CTA
                          </label>
                          <input
                            type="text"
                            value={draft.cta}
                            onChange={(e) =>
                              setAdCopies((prev) => ({
                                ...prev,
                                [platform]: { ...prev[platform]!, cta: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-2 text-center">
                        {isHebrew ? 'לחץ על "צור קופי" להתחיל' : 'Click "Generate copy" to start'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
          {/* Back */}
          <button
            type="button"
            onClick={() => step > 1 && setStep((s) => (s - 1) as Step)}
            disabled={step === 1}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors',
              step === 1
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            )}
          >
            {isHebrew ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {isHebrew ? 'חזור' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-100"
            >
              {isHebrew ? 'סגור' : 'Close'}
            </button>

            {/* Next / Done */}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !canProceedStep1 && productSource === 'woocommerce') return;
                  if (step === 2 && !canProceedStep2) return;
                  if (step === 3 && !canProceedStep3) return;
                  setStep((s) => (s + 1) as Step);
                }}
                disabled={
                  (step === 1 && productSource === 'woocommerce' && !isWooConnected) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isHebrew ? 'הבא' : 'Next'}
                {isHebrew ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                <Check className="w-4 h-4" />
                {isHebrew ? 'סיום' : 'Done'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

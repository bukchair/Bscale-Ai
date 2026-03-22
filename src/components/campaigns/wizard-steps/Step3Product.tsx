import type { Dispatch, SetStateAction } from 'react';
import { Globe, Loader2, ShoppingCart, Target } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { COUNTRIES, LANGUAGES, ProductSource, WizardProduct, stripHtml } from './wizard-types';

type WooProduct = {
  id: number;
  name: string;
  price?: string;
  short_description?: string;
  permalink?: string;
  images?: Array<{ src: string }>;
};

interface Props {
  productSource: ProductSource;
  setProductSource: (v: ProductSource) => void;
  hasWooConnection: boolean;
  wooLoading: boolean;
  wooProducts: WooProduct[];
  selectedWooId: string;
  setSelectedWooId: (v: string) => void;
  selectedWooProduct: WooProduct | undefined;
  manualProduct: WizardProduct;
  setManualProduct: Dispatch<SetStateAction<WizardProduct>>;
  activeProduct: WizardProduct;
  mediaFile: File | null;
  setMediaFile: (v: File | null) => void;
  country: string;
  setCountry: (v: string) => void;
  language2: string;
  setLanguage2: (v: string) => void;
  isHebrew: boolean;
  tx: {
    step3Title: string;
    manual: string;
    fromWoo: string;
    productName: string;
    description: string;
    price: string;
    websiteUrl: string;
    country: string;
    language: string;
    wooLoading: string;
    wooEmpty: string;
    selectProduct: string;
    optional: string;
  };
}

export function Step3Product({
  productSource,
  setProductSource,
  hasWooConnection,
  wooLoading,
  wooProducts,
  selectedWooId,
  setSelectedWooId,
  selectedWooProduct,
  manualProduct,
  setManualProduct,
  activeProduct,
  mediaFile,
  setMediaFile,
  country,
  setCountry,
  language2,
  setLanguage2,
  isHebrew,
  tx,
}: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900">{tx.step3Title}</h3>

      {/* Source toggle */}
      {hasWooConnection && (
        <div className="flex gap-2">
          {(['manual', 'woocommerce'] as ProductSource[]).map((src) => (
            <button
              key={src}
              onClick={() => setProductSource(src)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                productSource === src
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {src === 'woocommerce' ? <ShoppingCart className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
              {src === 'woocommerce' ? tx.fromWoo : tx.manual}
            </button>
          ))}
        </div>
      )}

      {/* WooCommerce product picker */}
      {productSource === 'woocommerce' && hasWooConnection && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-2">
          {wooLoading ? (
            <p className="text-xs text-sky-700 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />{tx.wooLoading}
            </p>
          ) : wooProducts.length === 0 ? (
            <p className="text-xs text-amber-700">{tx.wooEmpty}</p>
          ) : (
            <>
              <label className="text-xs font-medium text-sky-800">{tx.selectProduct}</label>
              <select
                value={selectedWooId}
                onChange={(e) => setSelectedWooId(e.target.value)}
                className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
              >
                {wooProducts.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}{p.price ? ` — ₪${p.price}` : ''}
                  </option>
                ))}
              </select>
              {selectedWooProduct && (
                <p className="text-[11px] text-sky-700 line-clamp-2">
                  {stripHtml(selectedWooProduct.short_description || '')}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual entry */}
      {(productSource === 'manual' || !hasWooConnection) && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{tx.productName}</label>
            <input
              type="text"
              value={manualProduct.name}
              onChange={(e) => setManualProduct((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              placeholder={isHebrew ? 'למשל: נעלי ספורט קיץ' : 'e.g. Summer Running Shoes'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {tx.description} <span className="text-gray-400">({tx.optional})</span>
            </label>
            <textarea
              rows={2}
              value={manualProduct.description}
              onChange={(e) => setManualProduct((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tx.price} <span className="text-gray-400">({tx.optional})</span>
              </label>
              <input
                type="text"
                value={manualProduct.price}
                onChange={(e) => setManualProduct((p) => ({ ...p, price: e.target.value }))}
                placeholder="99.90"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {tx.websiteUrl} <span className="text-gray-400">({tx.optional})</span>
              </label>
              <input
                type="url"
                value={manualProduct.url}
                onChange={(e) => setManualProduct((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* WooCommerce product image preview */}
      {productSource === 'woocommerce' && activeProduct.imageUrl && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 flex items-center gap-3">
          <img
            src={activeProduct.imageUrl}
            alt={activeProduct.name}
            className="w-14 h-14 object-cover rounded-lg border border-sky-200 shrink-0"
          />
          <div>
            <p className="text-xs font-semibold text-sky-800">
              {isHebrew ? 'תמונת מוצר' : 'Product image'}
            </p>
            <p className="text-[11px] text-sky-600 mt-0.5">
              {isHebrew
                ? 'תועלה אוטומטית למטא ו-TikTok'
                : 'Will be uploaded automatically to Meta & TikTok'}
            </p>
          </div>
        </div>
      )}

      {/* Manual media upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {isHebrew ? 'תמונה / וידאו למודעה' : 'Ad image / video'}
          {' '}<span className="text-gray-400">({isHebrew ? 'אופציונלי' : 'optional'})</span>
        </label>
        <div className="rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 transition-colors p-3">
          {mediaFile ? (
            <div className="flex items-center gap-3">
              {mediaFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(mediaFile)}
                  alt="preview"
                  className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🎬</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{mediaFile.name}</p>
                <p className="text-[11px] text-gray-500">{(mediaFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={() => setMediaFile(null)}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
              >
                {isHebrew ? 'הסר' : 'Remove'}
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-1.5 cursor-pointer py-2">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs font-medium text-violet-600">
                {isHebrew ? 'לחץ להעלאת קובץ' : 'Click to upload file'}
              </span>
              <span className="text-[10px] text-gray-400 text-center">
                {isHebrew
                  ? 'Meta: JPG/PNG מינ׳ 1080×1080 | TikTok: JPG/PNG מינ׳ 720×1280'
                  : 'Meta: JPG/PNG min 1080×1080 | TikTok: JPG/PNG min 720×1280'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      </div>

      {/* Country & Language */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Globe className="w-3.5 h-3.5 inline mr-1" />{tx.country}
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{tx.language}</label>
          <select
            value={language2}
            onChange={(e) => setLanguage2(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

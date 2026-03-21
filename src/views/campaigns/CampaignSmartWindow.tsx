import React from 'react';
import { Clock3, Loader2, ShoppingCart, Sparkles } from 'lucide-react';
import type { PlatformName, WooCampaignProduct, WooPublishScope } from './types';

type WooProduct = WooCampaignProduct & { imageUrl?: string; url?: string; category?: string };

export type CampaignSmartWindowProps = {
  isHebrew: boolean;
  isWooConnected: boolean;
  aiAudienceLoading: boolean;
  aiAudienceProvider: string;
  smartAdElapsedMs: number;
  useWooProductData: boolean;
  wooLoading: boolean;
  wooPublishScope: WooPublishScope;
  selectedWooProductId: string;
  selectedWooProduct: WooProduct | null | undefined;
  shortTitleInput: string;
  campaignNameInput: string;
  wooProducts: WooProduct[];
  wooProductsFiltered: WooProduct[];
  shortTitleInputRef: React.RefObject<HTMLInputElement | null>;
  text: Record<string, string>;
  setShortTitleInput: (v: string) => void;
  setUseWooProductData: (v: boolean) => void;
  setWooPublishScope: (v: WooPublishScope) => void;
  setSelectedWooProductId: (v: string) => void;
  setSelectedWooCategory: (v: string) => void;
  wooCategoryOptions: string[];
  selectedWooCategory: string;
  disableWooImportMode: () => void;
  importWooProductToBuilder: (product: WooCampaignProduct, opts?: { overwriteExisting?: boolean; notify?: boolean }) => void;
  handleAutoAudienceAndStrategy: () => void;
  formatSmartElapsed: (ms: number) => string;
};

export function CampaignSmartWindow({
  isHebrew, isWooConnected, aiAudienceLoading, aiAudienceProvider,
  smartAdElapsedMs, useWooProductData, wooLoading, wooPublishScope,
  selectedWooProductId, selectedWooProduct, shortTitleInput, campaignNameInput,
  wooProducts, wooProductsFiltered, shortTitleInputRef, text,
  setShortTitleInput, setUseWooProductData, setWooPublishScope, setSelectedWooProductId,
  setSelectedWooCategory, wooCategoryOptions, selectedWooCategory,
  disableWooImportMode, importWooProductToBuilder,
  handleAutoAudienceAndStrategy, formatSmartElapsed,
}: CampaignSmartWindowProps) {
  return (
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
          className={
            'w-full rounded-xl border shadow-sm focus:ring-2 sm:text-sm py-2.5 px-3 pr-16 ' +
            (shortTitleInput.length >= 85
              ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-200'
              : 'border-indigo-300 focus:border-indigo-400 focus:ring-indigo-200')
          }
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
  );
}

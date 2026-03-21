import React from 'react';
import { Loader2 } from 'lucide-react';
import type { WooCampaignProduct, WooPublishScope } from './types';

type WooProduct = WooCampaignProduct & { imageUrl?: string; url?: string; category?: string };

export type CampaignWooPublishProps = {
  isHebrew: boolean;
  isWooConnected: boolean;
  useWooProductData: boolean;
  wooLoading: boolean;
  wooPublishScope: WooPublishScope;
  selectedWooCategory: string;
  selectedWooProductId: string;
  selectedWooProduct: WooProduct | null | undefined;
  wooCategoryOptions: string[];
  wooProductsFiltered: WooProduct[];
  wooProducts: WooProduct[];
  text: Record<string, string>;
  setUseWooProductData: (v: boolean) => void;
  setWooPublishScope: (v: WooPublishScope) => void;
  setSelectedWooCategory: (v: string) => void;
  setSelectedWooProductId: (v: string) => void;
  disableWooImportMode: () => void;
  importWooProductToBuilder: (product: WooCampaignProduct, opts?: { overwriteExisting?: boolean; notify?: boolean }) => void;
};

export function CampaignWooPublish({
  isHebrew, isWooConnected, useWooProductData, wooLoading,
  wooPublishScope, selectedWooCategory, selectedWooProductId, selectedWooProduct,
  wooCategoryOptions, wooProductsFiltered, wooProducts, text,
  setUseWooProductData, setWooPublishScope, setSelectedWooCategory, setSelectedWooProductId,
  disableWooImportMode, importWooProductToBuilder,
}: CampaignWooPublishProps) {
  return (
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
                      selectedWooProduct.categories?.join(', ') ||
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
  );
}

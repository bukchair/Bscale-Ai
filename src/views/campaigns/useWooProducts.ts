/**
 * WooCommerce product data + import logic for the campaign builder.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchWooCommerceProducts } from '../../services/woocommerceService';
import { resolveWooCredentials } from '../../lib/integrations/woocommerceCredentials';
import { stripHtmlToText } from './types';
import type { WooCampaignProduct, WooPublishScope, ContentType } from './types';
import type { Connection } from '../../contexts/ConnectionsContext';

export interface UseWooProductsProps {
  wooConnection: Connection | undefined;
  isHebrew: boolean;
  isWooConnected: boolean;
  /** Setters from the parent builder hook that woo-import will update */
  setBuilderMessage: (msg: string | null) => void;
  setContentType: React.Dispatch<React.SetStateAction<ContentType>>;
  setShortTitleInput: React.Dispatch<React.SetStateAction<string>>;
  setCampaignNameInput: React.Dispatch<React.SetStateAction<string>>;
  setServiceTypeInput: React.Dispatch<React.SetStateAction<string>>;
  setCampaignBrief: React.Dispatch<React.SetStateAction<string>>;
}

export function useWooProducts({
  wooConnection, isHebrew, isWooConnected,
  setBuilderMessage, setContentType, setShortTitleInput,
  setCampaignNameInput, setServiceTypeInput, setCampaignBrief,
}: UseWooProductsProps) {
  const wooAutoBriefRef = useRef('');

  const [wooProducts, setWooProducts] = useState<WooCampaignProduct[]>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [useWooProductData, setUseWooProductData] = useState(false);
  const [wooPublishScope, setWooPublishScope] = useState<WooPublishScope>('category');
  const [selectedWooCategory, setSelectedWooCategory] = useState('');
  const [selectedWooProductId, setSelectedWooProductId] = useState<string>('');

  // ── Derived lists ─────────────────────────────────────────────────────────

  const wooCategoryOptions = useMemo(() => {
    const names = wooProducts.flatMap((p) => p.categories);
    return ([...new Set(names)] as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [wooProducts]);

  const wooProductsFiltered = useMemo(() => {
    if (wooPublishScope !== 'category') return wooProducts;
    if (!selectedWooCategory) return wooProducts;
    return wooProducts.filter((p) => p.categories.includes(selectedWooCategory));
  }, [wooProducts, wooPublishScope, selectedWooCategory]);

  const selectedWooProduct = useMemo(
    () => (!selectedWooProductId ? null : wooProducts.find((p) => String(p.id) === String(selectedWooProductId)) || null),
    [wooProducts, selectedWooProductId]
  );

  const inferredWooTitle = useMemo(() => {
    if (!useWooProductData || !isWooConnected) return '';
    if (wooPublishScope === 'product' && selectedWooProduct?.name) return selectedWooProduct.name;
    if (wooPublishScope === 'category' && selectedWooCategory) return `${selectedWooCategory} Campaign`;
    return '';
  }, [useWooProductData, isWooConnected, wooPublishScope, selectedWooProduct?.name, selectedWooCategory]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!wooConnection?.settings) {
      setWooProducts([]); setSelectedWooCategory(''); setSelectedWooProductId('');
      return;
    }
    const { storeUrl, wooKey, wooSecret } = resolveWooCredentials(
      wooConnection.settings as Record<string, unknown>
    );
    if (!storeUrl || !wooKey || !wooSecret) { setWooProducts([]); return; }
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
              ? (item.categories as Record<string, unknown>[]).map((c) => stripHtmlToText(String(c?.name || ''))).filter(Boolean)
              : [],
            price: item?.price != null ? String(item.price) : '',
            shortDescription: stripHtmlToText(item?.short_description || ''),
            description: stripHtmlToText(item?.description || ''),
            sku: stripHtmlToText(item?.sku || ''),
            stockQuantity:
              typeof item?.stock_quantity === 'number' && Number.isFinite(item.stock_quantity)
                ? item.stock_quantity : null,
            productUrl: stripHtmlToText(item?.permalink || ''),
            imageUrl: Array.isArray(item?.images)
              ? stripHtmlToText(
                  String((((item.images as Array<Record<string, unknown>>)[0] || {}).src) || '')
                )
              : '',
          }))
          .filter((item: WooCampaignProduct) => item.id > 0 && item.name);
        setWooProducts(mapped);
      })
      .catch(() => { if (!cancelled) setWooProducts([]); })
      .finally(() => { if (!cancelled) setWooLoading(false); });
    return () => { cancelled = true; };
  }, [wooConnection?.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!useWooProductData || wooPublishScope === 'product') return;
    if (!selectedWooCategory && wooCategoryOptions.length > 0) setSelectedWooCategory(wooCategoryOptions[0]);
  }, [useWooProductData, wooPublishScope, wooCategoryOptions, selectedWooCategory]);

  useEffect(() => {
    if (!useWooProductData || wooPublishScope !== 'product') return;
    if (!selectedWooProductId && wooProductsFiltered.length > 0)
      setSelectedWooProductId(String(wooProductsFiltered[0].id));
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  useEffect(() => {
    if (!useWooProductData || wooPublishScope !== 'product' || !selectedWooProductId) return;
    const exists = wooProductsFiltered.some((p) => String(p.id) === String(selectedWooProductId));
    if (!exists) setSelectedWooProductId(wooProductsFiltered.length > 0 ? String(wooProductsFiltered[0].id) : '');
  }, [useWooProductData, wooPublishScope, selectedWooProductId, wooProductsFiltered]);

  useEffect(() => {
    if (!useWooProductData || !inferredWooTitle) return;
    setShortTitleInput((prev) => (prev.trim() ? prev : inferredWooTitle));
    setCampaignNameInput((prev) => (prev.trim() ? prev : inferredWooTitle));
  }, [useWooProductData, inferredWooTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  const buildWooProductBrief = (product: WooCampaignProduct): string => {
    const longDescription = (product.shortDescription?.trim()) || (product.description?.trim()) || '';
    const compactDescription = longDescription.length > 420 ? `${longDescription.slice(0, 417).trim()}...` : longDescription;
    return [
      `${isHebrew ? 'מוצר' : 'Product'}: ${product.name}`,
      product.categories.length > 0 ? `${isHebrew ? 'קטגוריות' : 'Categories'}: ${product.categories.join(', ')}` : '',
      product.price ? `${isHebrew ? 'מחיר' : 'Price'}: ${product.price}` : '',
      product.sku ? `SKU: ${product.sku}` : '',
      typeof product.stockQuantity === 'number' ? `${isHebrew ? 'מלאי' : 'Stock'}: ${product.stockQuantity}` : '',
      compactDescription,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n');
  };

  const importWooProductToBuilder = (
    product: WooCampaignProduct,
    options?: { overwriteExisting?: boolean; notify?: boolean }
  ) => {
    const overwrite = options?.overwriteExisting ?? true;
    const notify = options?.notify ?? false;
    const productBrief = buildWooProductBrief(product);
    if (!productBrief.trim()) {
      if (notify) setBuilderMessage(
        isHebrew ? 'למוצר הנבחר אין מספיק פרטים לייבוא.' : 'Selected product has insufficient data for import.'
      );
      return;
    }
    const priceStr = product.price ? ` – ₪${product.price}` : '';
    setContentType('product');
    setShortTitleInput((prev) => (overwrite || !prev.trim() ? `${product.name}${priceStr}`.slice(0, 90) : prev));
    setCampaignNameInput((prev) => (overwrite || !prev.trim() ? product.name : prev));
    setServiceTypeInput((prev) => {
      const cat = product.categories[0] || '';
      return cat && (overwrite || !prev.trim()) ? cat : prev;
    });
    setCampaignBrief((prev) =>
      overwrite || !prev.trim() || prev.trim() === wooAutoBriefRef.current.trim() ? productBrief : prev
    );
    wooAutoBriefRef.current = productBrief;
    if (notify) setBuilderMessage(
      isHebrew ? 'פרטי המוצר יובאו בהצלחה מ-WooCommerce.' : 'Product details imported successfully from WooCommerce.'
    );
  };

  return {
    wooProducts, wooLoading,
    useWooProductData, setUseWooProductData,
    wooPublishScope, setWooPublishScope,
    selectedWooCategory, setSelectedWooCategory,
    selectedWooProductId, setSelectedWooProductId,
    wooCategoryOptions, wooProductsFiltered, selectedWooProduct, inferredWooTitle,
    buildWooProductBrief, importWooProductToBuilder,
  };
}

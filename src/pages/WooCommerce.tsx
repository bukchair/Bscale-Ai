import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, DollarSign, Tag, Loader2, AlertCircle, RefreshCw, Sparkles, Image as ImageIcon, CheckCircle2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConnections } from '../contexts/ConnectionsContext';
import { fetchWooCommerceProducts } from '../services/woocommerceService';
import { optimizeProductSEO, SEOOptimizationResult } from '../services/seoService';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface Product {
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

export function WooCommerce() {
  const { connections } = useConnections();
  const { t, dir } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<SEOOptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wooConnection = connections.find(c => c.id === 'woocommerce');
  const isConnected = wooConnection?.status === 'connected';
  const { storeUrl, wooKey, wooSecret } = wooConnection?.settings || {};

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWooCommerceProducts(storeUrl || '', wooKey || 'mock', wooSecret || 'mock');
      setProducts(data);
    } catch (err) {
      setError(t('woocommerce.errorLoading'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!selectedProduct) return;
    
    setIsOptimizing(true);
    setError(null);
    try {
      const result = await optimizeProductSEO({
        name: selectedProduct.name,
        short_description: selectedProduct.short_description,
        description: selectedProduct.description,
        sku: selectedProduct.sku,
        categories: selectedProduct.categories
      });
      setOptimizationResult(result);
    } catch (err) {
      console.error("Optimization failed:", err);
      setError(t('woocommerce.optimizationFailed'));
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchProducts();
    }
  }, [isConnected]);

  useEffect(() => {
    setOptimizationResult(null);
    if (selectedProduct) {
      setShowListOnMobile(false);
    }
  }, [selectedProduct]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('woocommerce.notConnected')}</h2>
        <p className="text-gray-500 mb-6 max-w-md">{t('woocommerce.notConnectedDesc')}</p>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          {t('woocommerce.goToIntegrations')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{t('woocommerce.title')}</h1>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {t('woocommerce.active')}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{t('woocommerce.subtitle')}</p>
        </div>
        <button 
          onClick={fetchProducts}
          disabled={isLoading}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t('woocommerce.refreshProducts')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={cn(
          "bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden flex flex-col",
          !showListOnMobile && "hidden md:flex"
        )}>
          <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('woocommerce.productList')} ({products.length})</h3>
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400", dir === 'rtl' ? "right-3" : "left-3")} />
              <input 
                type="text"
                placeholder={t('woocommerce.searchProducts')}
                className={cn(
                  "w-full bg-white border border-gray-200 rounded-xl py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all",
                  dir === 'rtl' ? "pr-10 pl-4" : "pl-10 pr-4"
                )}
              />
            </div>
          </div>
          <ul className="divide-y divide-gray-100 h-[500px] md:h-[700px] overflow-y-auto">
            {isLoading && products.length === 0 ? (
              <li className="p-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                {t('woocommerce.loadingProducts')}
              </li>
            ) : products.length === 0 ? (
              <li className="p-12 text-center text-gray-400">{t('woocommerce.noProducts')}</li>
            ) : (
              products.map((product) => (
                <li 
                  key={product.id} 
                  className={cn(
                    "px-4 py-4 hover:bg-indigo-50/30 cursor-pointer transition-all border-r-4 border-transparent flex gap-3",
                    selectedProduct?.id === product.id ? 'bg-indigo-50/50 border-indigo-500' : ''
                  )}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                    {product.images?.[0] ? (
                      <img src={product.images[0].src} alt={product.images[0].alt} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate flex-1">{product.name}</p>
                      <p className="text-sm font-black text-indigo-600 mr-2 shrink-0">₪{product.price}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-mono text-gray-400">{t('woocommerce.sku')}: {product.sku || '---'}</p>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                        (product.stock_quantity || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}>
                        {(product.stock_quantity || 0) > 0 ? `${t('woocommerce.inStock')} (${product.stock_quantity})` : t('woocommerce.outOfStock')}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={cn(
          "md:col-span-1 lg:col-span-2 bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden flex flex-col min-h-[500px] md:min-h-[700px]",
          showListOnMobile && "hidden md:flex"
        )}>
          {selectedProduct ? (
            <>
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowListOnMobile(true)}
                    className="md:hidden p-2 -ms-2 text-gray-500 hover:text-indigo-600 transition-colors"
                  >
                    <RefreshCw className={cn("w-5 h-5", dir === 'rtl' ? "rotate-180" : "")} />
                  </button>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2 truncate">
                    <Package className="w-5 h-5 text-indigo-500 shrink-0" />
                    <span className="truncate">{selectedProduct.name}</span>
                  </h3>
                </div>
                <button 
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 sm:py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {t('woocommerce.aiOptimization')}
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-full sm:w-32 h-48 sm:h-32 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shrink-0">
                    {selectedProduct.images?.[0] ? (
                      <img src={selectedProduct.images[0].src} alt={selectedProduct.images[0].alt} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t('woocommerce.price')}</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-gray-900">₪{selectedProduct.price}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Tag className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t('woocommerce.category')}</span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{selectedProduct.categories?.[0]?.name || t('common.all')}</p>
                    </div>
                  </div>
                </div>

                {optimizationResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-indigo-900 font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {t('woocommerce.suggestedAiImprovements')}
                      </h4>
                      <span className="text-[10px] bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">{t('woocommerce.new')}</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('woocommerce.suggestedSeoTitle')}</label>
                        <p className="text-sm font-bold text-indigo-900">{optimizationResult.seo_title}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('woocommerce.improvedShortDescription')}</label>
                          <p className="text-xs text-indigo-800 leading-relaxed">{optimizationResult.short_description}</p>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('woocommerce.keywords')}</label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {optimizationResult.seo_keywords.map((kw, i) => (
                              <span key={i} className="bg-white/50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-medium border border-indigo-100">{kw}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{t('woocommerce.improvedFullDescription')}</label>
                        <p className="text-xs text-indigo-800 leading-relaxed whitespace-pre-wrap">{optimizationResult.description}</p>
                      </div>

                      <button className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('woocommerce.updateInWooCommerce')}
                      </button>
                    </div>
                  </motion.div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('woocommerce.shortDescription')}</label>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedProduct.short_description }} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('woocommerce.fullDescription')}</label>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedProduct.description }} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-12">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <ShoppingCart className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('woocommerce.noProductSelected')}</h3>
              <p className="text-sm text-gray-500 text-center max-w-xs">{t('woocommerce.noProductSelectedDesc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

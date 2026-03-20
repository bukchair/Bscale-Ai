/**
 * OneClickWizard — simplified 5-step campaign creation wizard.
 *
 * Steps:
 *  1. Platforms   — pick from connected platforms
 *  2. Objective   — sales / leads / traffic + daily budget
 *  3. Product     — WooCommerce picker or manual entry + country/language
 *  4. AI Preview  — review generated strategy + ad copy
 *  5. Result      — success / partial / failure per platform
 *
 * Design principles:
 *  - Reuses useConnections, useLanguage, fetchWooCommerceProducts
 *  - Does NOT modify or duplicate any existing Campaigns logic
 *  - Calls POST /api/campaigns/one-click for all backend work
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  Target,
  ShoppingCart,
  Globe,
  DollarSign,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConnections } from '../../contexts/ConnectionsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchWooCommerceProducts } from '../../services/woocommerceService';
import { API_BASE } from '../../lib/utils/client-api-base';
import type {
  OneClickObjective,
  OneClickPlatform,
  OneClickResult,
  OneClickStrategy,
  PlatformResult,
} from '../../lib/one-click/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

type ProductSource = 'manual' | 'woocommerce';

interface WizardProduct {
  name: string;
  description: string;
  price: string;
  url: string;
}

interface OneClickWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful (full or partial) campaign creation */
  onSuccess?: (result: OneClickResult) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<OneClickPlatform, string> = {
  Google: 'border-blue-300 bg-blue-50 text-blue-800',
  Meta: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  TikTok: 'border-pink-300 bg-pink-50 text-pink-800',
};

const PLATFORM_SELECTED: Record<OneClickPlatform, string> = {
  Google: 'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
  Meta: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-400',
  TikTok: 'border-pink-500 bg-pink-100 ring-2 ring-pink-400',
};

const PLATFORM_ICONS: Record<OneClickPlatform, string> = {
  Google: '🔵',
  Meta: '🟣',
  TikTok: '⚫',
};

const OBJECTIVES: { value: OneClickObjective; labelEn: string; labelHe: string; icon: string; descEn: string; descHe: string }[] = [
  {
    value: 'sales',
    labelEn: 'Sales',
    labelHe: 'מכירות',
    icon: '🛒',
    descEn: 'Drive purchases and conversions',
    descHe: 'הגדל מכירות והמרות',
  },
  {
    value: 'leads',
    labelEn: 'Leads',
    labelHe: 'לידים',
    icon: '📋',
    descEn: 'Collect contact info and inquiries',
    descHe: 'איסוף פרטי לקוחות פוטנציאליים',
  },
  {
    value: 'traffic',
    labelEn: 'Traffic',
    labelHe: 'תנועה',
    icon: '🌐',
    descEn: 'Send visitors to your website',
    descHe: 'הפנה מבקרים לאתר שלך',
  },
];

const COUNTRIES = [
  { code: 'IL', label: 'Israel 🇮🇱' },
  { code: 'US', label: 'United States 🇺🇸' },
  { code: 'GB', label: 'United Kingdom 🇬🇧' },
  { code: 'DE', label: 'Germany 🇩🇪' },
  { code: 'FR', label: 'France 🇫🇷' },
  { code: 'CA', label: 'Canada 🇨🇦' },
  { code: 'AU', label: 'Australia 🇦🇺' },
  { code: 'NL', label: 'Netherlands 🇳🇱' },
];

const LANGUAGES = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

const STEP_LABELS_EN: Record<WizardStep, string> = {
  1: 'Platforms',
  2: 'Objective',
  3: 'Product',
  4: 'AI Preview',
  5: 'Result',
};
const STEP_LABELS_HE: Record<WizardStep, string> = {
  1: 'פלטפורמות',
  2: 'מטרה',
  3: 'מוצר',
  4: 'תצוגה AI',
  5: 'תוצאה',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const buildIdempotencyKey = (platforms: OneClickPlatform[], objective: string, budget: number, productName: string): string =>
  `occ:${platforms.sort().join('+')}:${objective}:${budget}:${productName.slice(0, 30)}:${Math.floor(Date.now() / 60_000)}`;

// ─── Component ────────────────────────────────────────────────────────────────

export function OneClickWizard({ open, onClose, onSuccess }: OneClickWizardProps) {
  const { t, language } = useLanguage();
  const { connections } = useConnections();
  const isHebrew = language === 'he';
  const stepLabels = isHebrew ? STEP_LABELS_HE : STEP_LABELS_EN;

  // ── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 — Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<OneClickPlatform[]>([]);

  // Step 2 — Objective & budget
  const [objective, setObjective] = useState<OneClickObjective>('sales');
  const [dailyBudget, setDailyBudget] = useState<string>('20');

  // Step 3 — Product & targeting
  const [productSource, setProductSource] = useState<ProductSource>('manual');
  const [manualProduct, setManualProduct] = useState<WizardProduct>({ name: '', description: '', price: '', url: '' });
  const [wooProducts, setWooProducts] = useState<Array<{ id: number; name: string; price?: string; short_description?: string; sku?: string }>>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [selectedWooId, setSelectedWooId] = useState<string>('');
  const [country, setCountry] = useState('IL');
  const [language2, setLanguage2] = useState(language === 'he' ? 'he' : 'en');

  // Step 4 — AI preview
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [previewStrategy, setPreviewStrategy] = useState<OneClickStrategy | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Step 5 — Results
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<OneClickResult | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // ── Derived: connected platforms ────────────────────────────────────────
  const connectedPlatforms = useMemo<OneClickPlatform[]>(() => {
    const out: OneClickPlatform[] = [];
    if (connections.find((c) => c.id === 'google' && c.status === 'connected')) out.push('Google');
    if (connections.find((c) => c.id === 'meta' && c.status === 'connected')) out.push('Meta');
    if (connections.find((c) => c.id === 'tiktok' && c.status === 'connected')) out.push('TikTok');
    return out;
  }, [connections]);

  const wooConnection = useMemo(
    () => connections.find((c) => c.id === 'woocommerce' && c.status === 'connected'),
    [connections]
  );

  const selectedWooProduct = useMemo(
    () => wooProducts.find((p) => String(p.id) === selectedWooId),
    [wooProducts, selectedWooId]
  );

  const activeProduct: WizardProduct = useMemo(() => {
    if (productSource === 'woocommerce' && selectedWooProduct) {
      return {
        name: selectedWooProduct.name || '',
        description: stripHtml(selectedWooProduct.short_description || ''),
        price: selectedWooProduct.price || '',
        url: '',
      };
    }
    return manualProduct;
  }, [productSource, selectedWooProduct, manualProduct]);

  // ── Reset on open ────────────────────────────────────────────────────────
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep(1);
      setSelectedPlatforms(connectedPlatforms.slice()); // pre-select all connected
      setObjective('sales');
      setDailyBudget('20');
      setProductSource(wooConnection ? 'woocommerce' : 'manual');
      setManualProduct({ name: '', description: '', price: '', url: '' });
      setSelectedWooId('');
      setCountry('IL');
      setLanguage2(language === 'he' ? 'he' : 'en');
      setPreviewStrategy(null);
      setPreviewError(null);
      setResult(null);
      setLaunchError(null);
    }
    prevOpen.current = open;
  }, [open, connectedPlatforms, wooConnection, language]);

  // ── Load WooCommerce products ────────────────────────────────────────────
  useEffect(() => {
    if (!wooConnection?.settings) return;
    const { storeUrl, wooKey, wooSecret } = wooConnection.settings as Record<string, string>;
    if (!storeUrl || !wooKey || !wooSecret) return;
    let cancelled = false;
    setWooLoading(true);
    fetchWooCommerceProducts(storeUrl, wooKey, wooSecret, { fallbackToMock: false })
      .then((list) => {
        if (cancelled) return;
        setWooProducts(Array.isArray(list) ? list.slice(0, 50) : []);
      })
      .catch(() => {
        if (!cancelled) setWooProducts([]);
      })
      .finally(() => {
        if (!cancelled) setWooLoading(false);
      });
    return () => { cancelled = true; };
  }, [wooConnection?.settings]);

  // ── Auto-select first WooCommerce product ────────────────────────────────
  useEffect(() => {
    if (productSource === 'woocommerce' && !selectedWooId && wooProducts.length > 0) {
      setSelectedWooId(String(wooProducts[0].id));
    }
  }, [productSource, wooProducts, selectedWooId]);

  // ── Step 4: generate AI preview ─────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    setGeneratingStrategy(true);
    setPreviewError(null);
    try {
      const budget = Math.max(Number(dailyBudget) || 20, 1);
      const res = await fetch(`${API_BASE}/api/campaigns/one-click`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: buildIdempotencyKey(selectedPlatforms, objective, budget, activeProduct.name) + ':preview',
          platforms: selectedPlatforms,
          objective,
          dailyBudget: budget,
          country,
          language: language2,
          product: activeProduct.name ? activeProduct : undefined,
          previewOnly: true,
        }),
      });
      const rawText = await res.text();
      if (!rawText.trim()) {
        throw new Error(isHebrew ? 'השרת החזיר תגובה ריקה. נסה שוב.' : 'Server returned an empty response. Please try again.');
      }
      let data: OneClickResult;
      try {
        data = JSON.parse(rawText) as OneClickResult;
      } catch {
        throw new Error(isHebrew ? 'תגובת שרת לא תקינה. נסה שוב.' : 'Invalid server response. Please try again.');
      }
      if (!res.ok) {
        const errMsg = (data as unknown as Record<string, unknown>)?.error;
        throw new Error(typeof errMsg === 'string' ? errMsg : `Server error ${res.status}.`);
      }
      if (data.strategy) {
        setPreviewStrategy(data.strategy);
      } else {
        setPreviewError(isHebrew ? 'לא התקבלה אסטרטגיית AI. נסה שוב.' : 'Failed to generate AI strategy. Please try again.');
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'AI strategy generation failed.');
    } finally {
      setGeneratingStrategy(false);
    }
  }, [selectedPlatforms, objective, dailyBudget, country, language2, activeProduct]);

  // ── Step 5: launch ───────────────────────────────────────────────────────
  const handleLaunch = useCallback(async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const budget = Math.max(Number(dailyBudget) || 20, 1);
      const idempotencyKey = buildIdempotencyKey(selectedPlatforms, objective, budget, activeProduct.name);
      const res = await fetch(`${API_BASE}/api/campaigns/one-click`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          platforms: selectedPlatforms,
          objective,
          dailyBudget: budget,
          country,
          language: language2,
          product: activeProduct.name ? activeProduct : undefined,
        }),
      });
      const rawText = await res.text();
      if (!rawText.trim()) {
        throw new Error(isHebrew ? 'השרת החזיר תגובה ריקה. נסה שוב.' : 'Server returned an empty response. Please try again.');
      }
      let data: OneClickResult;
      try {
        data = JSON.parse(rawText) as OneClickResult;
      } catch {
        throw new Error(isHebrew ? 'תגובת שרת לא תקינה.' : 'Invalid server response.');
      }
      // 422 = all platforms failed but we still have per-platform error details
      if (!res.ok && res.status !== 422) {
        const errMsg = (data as unknown as Record<string, unknown>)?.error;
        throw new Error(typeof errMsg === 'string' ? errMsg : `Server error ${res.status}.`);
      }
      setResult(data);
      if (data.status !== 'FAILED') {
        onSuccess?.(data);
      }
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Campaign launch failed.');
    } finally {
      setLaunching(false);
    }
  }, [selectedPlatforms, objective, dailyBudget, country, language2, activeProduct, onSuccess]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goNext = () => {
    if (step === 3) {
      setStep(4);
      fetchPreview();
    } else if (step === 4) {
      setStep(5);
      handleLaunch();
    } else {
      setStep((s) => Math.min(s + 1, 5) as WizardStep);
    }
  };

  const goPrev = () => setStep((s) => Math.max(s - 1, 1) as WizardStep);

  const canGoNext: boolean = useMemo(() => {
    if (step === 1) return selectedPlatforms.length > 0;
    if (step === 2) return Number(dailyBudget) >= 1;
    if (step === 3) return true; // product is optional
    if (step === 4) return !!previewStrategy && !generatingStrategy;
    return false;
  }, [step, selectedPlatforms, dailyBudget, previewStrategy, generatingStrategy]);

  // ── Copy helper ──────────────────────────────────────────────────────────
  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (!open) return null;

  const tx = {
    title: isHebrew ? 'קמפיין בלחיצה אחת' : 'One Click Campaign',
    subtitle: isHebrew ? 'צור קמפיין בכל הפלטפורמות בשניות עם עזרת AI' : 'Launch a campaign across platforms in seconds with AI',
    step1Title: isHebrew ? 'בחר פלטפורמות' : 'Choose platforms',
    step1Hint: isHebrew ? 'רק פלטפורמות מחוברות זמינות.' : 'Only connected platforms are available.',
    noPlatforms: isHebrew ? 'אין פלטפורמות מחוברות. חבר Google, Meta או TikTok תחילה.' : 'No platforms connected. Connect Google, Meta or TikTok first.',
    step2Title: isHebrew ? 'מטרה ותקציב' : 'Objective & Budget',
    dailyBudget: isHebrew ? 'תקציב יומי' : 'Daily budget',
    step3Title: isHebrew ? 'מוצר וטירגוט' : 'Product & Targeting',
    manual: isHebrew ? 'הזנה ידנית' : 'Manual entry',
    fromWoo: isHebrew ? 'מ-WooCommerce' : 'From WooCommerce',
    productName: isHebrew ? 'שם מוצר / שירות' : 'Product / Service name',
    description: isHebrew ? 'תיאור קצר' : 'Short description',
    price: isHebrew ? 'מחיר' : 'Price',
    websiteUrl: isHebrew ? 'URL לאתר' : 'Website URL',
    country: isHebrew ? 'מדינה' : 'Country',
    language: isHebrew ? 'שפה' : 'Language',
    step4Title: isHebrew ? 'תצוגה מקדימה של AI' : 'AI Strategy Preview',
    generatingAi: isHebrew ? 'מייצר אסטרטגיה עם AI...' : 'Generating AI strategy...',
    campaignName: isHebrew ? 'שם קמפיין' : 'Campaign name',
    audiences: isHebrew ? 'קהלי יעד מומלצים' : 'Recommended audiences',
    adCopyPerPlatform: isHebrew ? 'טקסט פרסומי לפי פלטפורמה' : 'Ad copy per platform',
    title2: isHebrew ? 'כותרת' : 'Title',
    body: isHebrew ? 'גוף' : 'Body',
    regenerate: isHebrew ? 'ייצר מחדש' : 'Regenerate',
    launchConfirm: isHebrew
      ? 'הקמפיינים ייוצרו ב-PAUSED — תצטרך להפעיל אותם ידנית בפלטפורמה.'
      : 'Campaigns will be created as PAUSED — you activate them manually on the platform.',
    step5Title: isHebrew ? 'תוצאות' : 'Results',
    launching: isHebrew ? 'מפרסם...' : 'Launching...',
    success: isHebrew ? 'הצלחה' : 'Success',
    partial: isHebrew ? 'הצלחה חלקית' : 'Partial success',
    failed: isHebrew ? 'נכשל' : 'Failed',
    openPlatform: isHebrew ? 'פתח בפלטפורמה' : 'Open on platform',
    tryAgain: isHebrew ? 'נסה שוב' : 'Try again',
    close: isHebrew ? 'סגור' : 'Close',
    next: isHebrew ? 'הבא' : 'Next',
    back: isHebrew ? 'חזרה' : 'Back',
    launch: isHebrew ? 'פרסם' : 'Launch',
    wooLoading: isHebrew ? 'טוען מוצרים...' : 'Loading products...',
    wooEmpty: isHebrew ? 'אין מוצרים. בדוק את החיבור.' : 'No products found. Check connection.',
    selectProduct: isHebrew ? 'בחר מוצר' : 'Select a product',
    optional: isHebrew ? 'אופציונלי' : 'optional',
    platformConnected: isHebrew ? 'מחובר' : 'Connected',
    platformDisconnected: isHebrew ? 'לא מחובר' : 'Not connected',
  };

  const platformOpenUrls: Partial<Record<OneClickPlatform, string>> = {
    Google: 'https://ads.google.com',
    Meta: 'https://business.facebook.com',
    TikTok: 'https://ads.tiktok.com',
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{tx.title}</h2>
              <p className="text-xs text-gray-500">{tx.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
              <React.Fragment key={s}>
                <div className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors',
                  step === s
                    ? 'bg-violet-100 text-violet-700'
                    : step > s
                    ? 'bg-green-50 text-green-600'
                    : 'text-gray-400'
                )}>
                  {step > s ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <span className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border',
                      step === s ? 'border-violet-500 text-violet-700' : 'border-gray-300 text-gray-400'
                    )}>{s}</span>
                  )}
                  <span className="hidden sm:inline">{stepLabels[s]}</span>
                </div>
                {s < 5 && <div className={cn('h-px flex-1', step > s ? 'bg-green-300' : 'bg-gray-200')} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step 1: Platforms ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{tx.step1Title}</h3>
                <p className="text-xs text-gray-500">{tx.step1Hint}</p>
              </div>
              {connectedPlatforms.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {tx.noPlatforms}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['Google', 'Meta', 'TikTok'] as OneClickPlatform[]).map((platform) => {
                    const connected = connectedPlatforms.includes(platform);
                    const selected = selectedPlatforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        disabled={!connected}
                        onClick={() => {
                          if (!connected) return;
                          setSelectedPlatforms((prev) =>
                            prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
                          );
                        }}
                        className={cn(
                          'relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus:outline-none',
                          !connected
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                            : selected
                            ? PLATFORM_SELECTED[platform]
                            : `${PLATFORM_COLORS[platform]} hover:opacity-90 cursor-pointer`
                        )}
                      >
                        <span className="text-2xl">{PLATFORM_ICONS[platform]}</span>
                        <span>{platform}</span>
                        <span className={cn(
                          'text-[10px] font-normal',
                          connected ? 'text-green-600' : 'text-gray-400'
                        )}>
                          {connected ? `✓ ${tx.platformConnected}` : tx.platformDisconnected}
                        </span>
                        {selected && connected && (
                          <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Objective & Budget ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">{tx.step2Title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {OBJECTIVES.map((obj) => (
                    <button
                      key={obj.value}
                      onClick={() => setObjective(obj.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus:outline-none',
                        objective === obj.value
                          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-400 text-violet-800'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 cursor-pointer'
                      )}
                    >
                      <span className="text-2xl">{obj.icon}</span>
                      <span className="font-bold">{isHebrew ? obj.labelHe : obj.labelEn}</span>
                      <span className="text-[11px] text-gray-500 text-center">
                        {isHebrew ? obj.descHe : obj.descEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="w-4 h-4 inline-block mr-1" />
                  {tx.dailyBudget}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:ring-1 focus:ring-violet-300 focus:outline-none"
                  />
                  <span className="text-sm text-gray-500">/ {isHebrew ? 'יום' : 'day'}</span>
                  <div className="flex gap-1">
                    {[10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setDailyBudget(String(preset))}
                        className={cn(
                          'px-2 py-1 rounded-md text-xs font-medium border transition-colors',
                          Number(dailyBudget) === preset
                            ? 'border-violet-400 bg-violet-50 text-violet-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Product & Targeting ───────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">{tx.step3Title}</h3>

              {/* Source toggle */}
              {wooConnection && (
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
              {productSource === 'woocommerce' && wooConnection && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-2">
                  {wooLoading ? (
                    <p className="text-xs text-sky-700 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{tx.wooLoading}</p>
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
              {(productSource === 'manual' || !wooConnection) && (
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
          )}

          {/* ── Step 4: AI Preview ────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{tx.step4Title}</h3>
                {previewStrategy && !generatingStrategy && (
                  <button
                    onClick={() => { setPreviewStrategy(null); fetchPreview(); }}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
                  >
                    <RefreshCw className="w-3 h-3" />{tx.regenerate}
                  </button>
                )}
              </div>

              {generatingStrategy && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-6 h-6 text-violet-600" />
                  </div>
                  <p className="text-sm text-gray-600">{tx.generatingAi}</p>
                </div>
              )}

              {previewError && !generatingStrategy && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {previewError}
                </div>
              )}

              {previewStrategy && !generatingStrategy && (
                <div className="space-y-4">
                  {/* Campaign name */}
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-xs font-semibold text-violet-800 mb-1">{tx.campaignName}</p>
                    <p className="text-sm font-bold text-violet-900">{previewStrategy.campaignName}</p>
                    {previewStrategy.shortTitle && (
                      <p className="text-xs text-violet-600 mt-0.5">{previewStrategy.shortTitle}</p>
                    )}
                  </div>

                  {/* Audiences */}
                  {previewStrategy.audiences.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">{tx.audiences}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {previewStrategy.audiences.map((aud, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{aud}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ad copy per platform */}
                  {selectedPlatforms.filter((p) => previewStrategy.platformCopy[p]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">{tx.adCopyPerPlatform}</p>
                      <div className="space-y-3">
                        {selectedPlatforms.map((platform) => {
                          const copy = previewStrategy.platformCopy[platform];
                          if (!copy) return null;
                          return (
                            <div key={platform} className={cn('rounded-xl border p-3', PLATFORM_COLORS[platform])}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold">{PLATFORM_ICONS[platform]} {platform}</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] font-semibold shrink-0 mt-0.5 opacity-70">{tx.title2}</span>
                                  <span className="text-xs font-medium flex-1">{copy.title}</span>
                                  <button
                                    onClick={() => copyText(copy.title, `${platform}-title`)}
                                    className="shrink-0 opacity-50 hover:opacity-100"
                                  >
                                    {copiedField === `${platform}-title` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] font-semibold shrink-0 mt-0.5 opacity-70">{tx.body}</span>
                                  <span className="text-xs flex-1">{copy.description}</span>
                                  <button
                                    onClick={() => copyText(copy.description, `${platform}-desc`)}
                                    className="shrink-0 opacity-50 hover:opacity-100"
                                  >
                                    {copiedField === `${platform}-desc` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Launch confirmation notice */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {tx.launchConfirm}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Results ───────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">{tx.step5Title}</h3>

              {launching && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                  <p className="text-sm text-gray-600">{tx.launching}</p>
                </div>
              )}

              {launchError && !launching && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{launchError}
                </div>
              )}

              {result && !launching && (
                <div className="space-y-4">
                  {/* Overall status badge */}
                  <div className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold',
                    result.status === 'SUCCESS'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : result.status === 'PARTIAL'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  )}>
                    {result.status === 'SUCCESS'
                      ? <CheckCircle2 className="w-5 h-5" />
                      : <AlertCircle className="w-5 h-5" />}
                    {result.status === 'SUCCESS' ? tx.success : result.status === 'PARTIAL' ? tx.partial : tx.failed}
                  </div>

                  {/* Per-platform result */}
                  {selectedPlatforms.map((platform) => {
                    const pr: PlatformResult | undefined = (result.results as Record<string, PlatformResult>)[platform];
                    if (!pr) return null;
                    return (
                      <div key={platform} className={cn(
                        'rounded-xl border p-4',
                        pr.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {pr.ok ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-bold text-gray-800">{PLATFORM_ICONS[platform]} {platform}</span>
                            {pr.ok && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                                {pr.campaignStatus || 'Draft'}
                              </span>
                            )}
                          </div>
                          {pr.ok && platformOpenUrls[platform] && (
                            <a
                              href={platformOpenUrls[platform]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {tx.openPlatform}
                            </a>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-600">{pr.message}</p>
                        {pr.campaignId && (
                          <p className="mt-0.5 text-[10px] text-gray-400 font-mono">ID: {pr.campaignId}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? onClose : step === 5 ? onClose : goPrev}
            disabled={step === 5 && launching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {step === 1 || step === 5 ? (
              tx.close
            ) : (
              <><ChevronLeft className="w-4 h-4" />{tx.back}</>
            )}
          </button>

          {step < 5 && (
            <button
              onClick={goNext}
              disabled={!canGoNext || generatingStrategy}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 4 ? (
                <><Zap className="w-4 h-4" />{tx.launch}</>
              ) : (
                <>{tx.next}<ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

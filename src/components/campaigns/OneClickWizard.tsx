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
  CheckCircle2,
  Zap,
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
} from '../../lib/one-click/types';
import {
  WizardStep,
  WizardProduct,
  ProductSource,
  STEP_LABELS_EN,
  STEP_LABELS_HE,
  stripHtml,
  buildIdempotencyKey,
} from './wizard-steps/wizard-types';
import { Step1Platforms } from './wizard-steps/Step1Platforms';
import { Step2Objective } from './wizard-steps/Step2Objective';
import { Step3Product } from './wizard-steps/Step3Product';
import { Step4Preview } from './wizard-steps/Step4Preview';
import { Step5Result } from './wizard-steps/Step5Result';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OneClickWizardProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful (full or partial) campaign creation */
  onSuccess?: (result: OneClickResult) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OneClickWizard({ open, onClose, onSuccess }: OneClickWizardProps) {
  const { language } = useLanguage();
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
  const [wooProducts, setWooProducts] = useState<Array<{ id: number; name: string; price?: string; short_description?: string; sku?: string; permalink?: string; images?: Array<{ src: string }> }>>([]);
  const [wooLoading, setWooLoading] = useState(false);
  const [selectedWooId, setSelectedWooId] = useState<string>('');
  const [country, setCountry] = useState('IL');
  const [language2, setLanguage2] = useState(language === 'he' ? 'he' : 'en');

  // Step 4 — AI preview
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [previewStrategy, setPreviewStrategy] = useState<OneClickStrategy | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Step 3 — media file for manual upload
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Step 4 — activate toggle
  const [activateImmediately, setActivateImmediately] = useState(false);

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
        url: selectedWooProduct.permalink || '',
        imageUrl: selectedWooProduct.images?.[0]?.src || undefined,
      };
    }
    return manualProduct;
  }, [productSource, selectedWooProduct, manualProduct]);

  // ── Reset on open ────────────────────────────────────────────────────────
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep(1);
      setSelectedPlatforms(connectedPlatforms.slice());
      setObjective('sales');
      setDailyBudget('20');
      setProductSource(wooConnection ? 'woocommerce' : 'manual');
      setManualProduct({ name: '', description: '', price: '', url: '' });
      setSelectedWooId('');
      setCountry('IL');
      setLanguage2(language === 'he' ? 'he' : 'en');
      setMediaFile(null);
      setPreviewStrategy(null);
      setPreviewError(null);
      setActivateImmediately(false);
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
      .catch(() => { if (!cancelled) setWooProducts([]); })
      .finally(() => { if (!cancelled) setWooLoading(false); });
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
  }, [selectedPlatforms, objective, dailyBudget, country, language2, activeProduct, isHebrew]);

  // ── Step 5: launch ───────────────────────────────────────────────────────
  const handleLaunch = useCallback(async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const budget = Math.max(Number(dailyBudget) || 20, 1);
      const idempotencyKey = buildIdempotencyKey(selectedPlatforms, objective, budget, activeProduct.name);
      const payload = {
        idempotencyKey,
        platforms: selectedPlatforms,
        objective,
        dailyBudget: budget,
        country,
        language: language2,
        activateImmediately,
        product: activeProduct.name ? activeProduct : undefined,
      };

      let res: Response;
      if (mediaFile) {
        const fd = new FormData();
        fd.append('body', JSON.stringify(payload));
        fd.append('media', mediaFile);
        res = await fetch(`${API_BASE}/api/campaigns/one-click`, { method: 'POST', body: fd });
      } else {
        res = await fetch(`${API_BASE}/api/campaigns/one-click`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
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
      if (!res.ok && res.status !== 422) {
        const errMsg = (data as unknown as Record<string, unknown>)?.error;
        throw new Error(typeof errMsg === 'string' ? errMsg : `Server error ${res.status}.`);
      }
      setResult(data);
      if (data.status !== 'FAILED') onSuccess?.(data);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Campaign launch failed.');
    } finally {
      setLaunching(false);
    }
  }, [selectedPlatforms, objective, dailyBudget, country, language2, activeProduct, activateImmediately, mediaFile, onSuccess, isHebrew]);

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
    if (step === 3) return true;
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
          {step === 1 && (
            <Step1Platforms
              connectedPlatforms={connectedPlatforms}
              selectedPlatforms={selectedPlatforms}
              setSelectedPlatforms={setSelectedPlatforms}
              tx={tx}
            />
          )}
          {step === 2 && (
            <Step2Objective
              objective={objective}
              setObjective={setObjective}
              dailyBudget={dailyBudget}
              setDailyBudget={setDailyBudget}
              isHebrew={isHebrew}
              tx={tx}
            />
          )}
          {step === 3 && (
            <Step3Product
              productSource={productSource}
              setProductSource={setProductSource}
              hasWooConnection={!!wooConnection}
              wooLoading={wooLoading}
              wooProducts={wooProducts}
              selectedWooId={selectedWooId}
              setSelectedWooId={setSelectedWooId}
              selectedWooProduct={selectedWooProduct}
              manualProduct={manualProduct}
              setManualProduct={setManualProduct}
              activeProduct={activeProduct}
              mediaFile={mediaFile}
              setMediaFile={setMediaFile}
              country={country}
              setCountry={setCountry}
              language2={language2}
              setLanguage2={setLanguage2}
              isHebrew={isHebrew}
              tx={tx}
            />
          )}
          {step === 4 && (
            <Step4Preview
              generatingStrategy={generatingStrategy}
              previewStrategy={previewStrategy}
              previewError={previewError}
              selectedPlatforms={selectedPlatforms}
              activateImmediately={activateImmediately}
              setActivateImmediately={setActivateImmediately}
              onRegenerate={() => { setPreviewStrategy(null); fetchPreview(); }}
              copiedField={copiedField}
              onCopy={copyText}
              isHebrew={isHebrew}
              tx={tx}
            />
          )}
          {step === 5 && (
            <Step5Result
              launching={launching}
              result={result}
              launchError={launchError}
              selectedPlatforms={selectedPlatforms}
              tx={tx}
            />
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

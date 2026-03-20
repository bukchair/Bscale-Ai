'use client';

import React from 'react';
import { CalendarClock, Check, Clock3, Eye, ImagePlus, Loader2, PlusCircle, ShoppingCart, Sparkles, Target, Trash2, Video } from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ContentType, ObjectiveType, PlatformName, ProductType, RuleAction,
  WooPublishScope, UploadedAsset, TimeRule, WeeklySchedule, PlatformCopyDraft, DayKey,
} from './types';
import { DAY_KEYS } from './types';

type WooProduct = { id: number; name: string; price?: string; category?: string; categories?: string[]; imageUrl?: string; url?: string; description?: string; shortDescription?: string };

type CampaignBuilderProps = {
  // refs
  builderSectionRef: React.RefObject<HTMLElement | null>;
  shortTitleInputRef: React.RefObject<HTMLInputElement | null>;
  // state - booleans
  aiAudienceLoading: boolean;
  isCreatingCampaign: boolean;
  isHebrew: boolean;
  isWooConnected: boolean;
  useWooProductData: boolean;
  wooLoading: boolean;
  // state - strings
  aiAudienceProvider: string;
  builderMessage: string | null;
  campaignBrief: string;
  campaignNameInput: string;
  contentType: ContentType;
  customAudience: string;
  objective: ObjectiveType;
  productType: ProductType;
  ruleAction: RuleAction;
  ruleReason: string;
  rulePlatform: string;
  selectedCopyPlatform: string;
  selectedPreviewPlatform: string;
  selectedScheduleDay: DayKey;
  selectedSchedulePlatform: string;
  selectedWooCategory: string;
  selectedWooProductId: string;
  serviceTypeInput: string;
  shortTitleInput: string;
  wooPublishScope: WooPublishScope;
  // state - numbers
  ruleEndHour: number;
  ruleMinRoas: number;
  ruleStartHour: number;
  smartAdElapsedMs: number;
  // state - arrays/objects
  aiRecommendedHoursByPlatform: Record<string, number[]>;
  audienceSuggestions: string[];
  connectedAdPlatforms: string[];
  contentTypeOptions: Array<{ value: ContentType; label: string }>;
  dayLabels: Record<string, string>;
  draftPlatforms: string[];
  effectiveMediaLimits: Record<string, { maxImages: number; maxVideos: number; maxFileSizeMB: number }>;
  hourOptions: number[];
  objectiveOptions: Array<{ value: ObjectiveType; label: string }>;
  platformCopyDrafts: Partial<Record<PlatformName, PlatformCopyDraft>>;
  previewPlatforms: string[];
  productTypeOptions: Array<{ value: ProductType; label: string }>;
  selectedWooProduct: WooProduct | null | undefined;
  text: Record<string, string>;
  timeRules: TimeRule[];
  uploadedAssets: UploadedAsset[];
  weeklySchedule: WeeklySchedule;
  wooCategoryOptions: string[];
  publishResults: Array<{ platform: string; ok: boolean; message: string; campaignId?: string }>;
  selectedAudiences: string[];
  selectedPlatforms: string[];
  wooProducts: WooProduct[];
  wooProductsFiltered: WooProduct[];
  // setters
  setCampaignBrief: (v: string) => void;
  setCampaignNameInput: (v: string) => void;
  setContentType: (v: ContentType) => void;
  setCustomAudience: (v: string) => void;
  setObjective: (v: ObjectiveType) => void;
  setPlatformCopyDrafts: React.Dispatch<React.SetStateAction<Partial<Record<PlatformName, PlatformCopyDraft>>>>;
  setProductType: (v: ProductType) => void;
  setRuleAction: (v: RuleAction) => void;
  setRuleEndHour: (v: number) => void;
  setRuleMinRoas: (v: number) => void;
  setRulePlatform: (v: string) => void;
  setRuleReason: (v: string) => void;
  setRuleStartHour: (v: number) => void;
  setSelectedCopyPlatform: (v: string) => void;
  setSelectedPreviewPlatform: (v: string) => void;
  setSelectedScheduleDay: (v: DayKey) => void;
  setSelectedSchedulePlatform: (v: string) => void;
  setSelectedWooCategory: (v: string) => void;
  setSelectedWooProductId: (v: string) => void;
  setServiceTypeInput: (v: string) => void;
  setShortTitleInput: (v: string) => void;
  setUseWooProductData: (v: boolean) => void;
  setWooPublishScope: (v: WooPublishScope) => void;
  // handlers
  addCustomAudience: () => void;
  addTimeRule: () => void;
  applyPlatformCopyToFields: (platform: string) => void;
  disableWooImportMode: () => void;
  formatHour: (hour: number) => string;
  formatHourRange: (start: number, end: number) => string;
  formatSmartElapsed: (ms: number) => string;
  getActiveSlotsCount: (platform: string) => number;
  getPlatformDescriptionLimit: (platform: string) => number;
  getPlatformTitleLimit: (platform: string) => number;
  handleAssetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutoAudienceAndStrategy: () => void;
  handleCreateScheduledCampaign: () => void;
  importWooProductToBuilder: (product: WooProduct, opts?: { overwriteExisting?: boolean; notify?: boolean }) => void;
  isFullDaySelected: (day: string, platform: string) => boolean;
  removeAsset: (id: string) => void;
  removeTimeRule: (id: string) => void;
  toggleAudienceSelection: (audience: string) => void;
  toggleFullDay: (day: string, platform: string) => void;
  togglePlatformSelection: (platform: PlatformName) => void;
  toggleScheduleHour: (platform: string, day: DayKey, hour: number) => void;
};

export function CampaignBuilder({
  builderSectionRef, shortTitleInputRef,
  aiAudienceLoading, isCreatingCampaign, isHebrew, isWooConnected, useWooProductData, wooLoading,
  aiAudienceProvider, builderMessage, campaignBrief, campaignNameInput, contentType, customAudience,
  objective, productType, ruleAction, ruleReason, rulePlatform, selectedCopyPlatform,
  selectedPreviewPlatform, selectedScheduleDay, selectedSchedulePlatform, selectedWooCategory,
  selectedWooProductId, serviceTypeInput, shortTitleInput, wooPublishScope,
  ruleEndHour, ruleMinRoas, ruleStartHour, smartAdElapsedMs,
  aiRecommendedHoursByPlatform, audienceSuggestions, connectedAdPlatforms, contentTypeOptions,
  dayLabels, draftPlatforms, effectiveMediaLimits, hourOptions, objectiveOptions, platformCopyDrafts,
  previewPlatforms, productTypeOptions, selectedWooProduct, text, timeRules, uploadedAssets,
  weeklySchedule, wooCategoryOptions, wooProducts, wooProductsFiltered,
  publishResults, selectedAudiences, selectedPlatforms,
  setCampaignBrief, setCampaignNameInput, setContentType, setCustomAudience, setObjective,
  setPlatformCopyDrafts, setProductType, setRuleAction, setRuleEndHour, setRuleMinRoas,
  setRulePlatform, setRuleReason, setRuleStartHour, setSelectedCopyPlatform,
  setSelectedPreviewPlatform, setSelectedScheduleDay, setSelectedSchedulePlatform,
  setSelectedWooCategory, setSelectedWooProductId, setServiceTypeInput, setShortTitleInput,
  setUseWooProductData, setWooPublishScope,
  addCustomAudience, addTimeRule, applyPlatformCopyToFields, disableWooImportMode,
  formatHour, formatHourRange, formatSmartElapsed, getActiveSlotsCount,
  getPlatformDescriptionLimit, getPlatformTitleLimit, handleAssetUpload,
  handleAutoAudienceAndStrategy, handleCreateScheduledCampaign, importWooProductToBuilder,
  isFullDaySelected, removeAsset, removeTimeRule, toggleAudienceSelection, toggleFullDay,
  togglePlatformSelection, toggleScheduleHour,
}: CampaignBuilderProps) {
  return (
      <section ref={builderSectionRef} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-indigo-50/60">
          <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            {text.builderTitle}
          </h3>
          <p className="text-sm text-indigo-200 mt-0.5">{text.builderSubtitle}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
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
                className={cn(
                  "w-full rounded-xl border shadow-sm focus:ring-2 sm:text-sm py-2.5 px-3 pr-16",
                  shortTitleInput.length >= 85
                    ? "border-amber-300 focus:border-amber-400 focus:ring-amber-200"
                    : "border-indigo-300 focus:border-indigo-400 focus:ring-indigo-200"
                )}
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
          {draftPlatforms.length > 0 && (
            <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/50 p-4">
              <h4 className="text-sm font-bold text-violet-900 mb-1">{text.platformCopyTitle}</h4>
              <p className="text-xs text-violet-700 mb-3">{text.platformCopySubtitle}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {draftPlatforms.map((platform) => {
                  const selected = selectedCopyPlatform === platform;
                  const titleLength = (platformCopyDrafts[platform as PlatformName]?.title || '').trim().length;
                  const descriptionLength = (platformCopyDrafts[platform as PlatformName]?.description || '').trim().length;
                  return (
                    <button
                      key={`platform-copy-tab-${platform}`}
                      type="button"
                      onClick={() => setSelectedCopyPlatform(platform)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                        selected
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
                      )}
                    >
                      {platform}
                      <span className={cn('text-[10px]', selected ? 'text-violet-100' : 'text-violet-500')}>
                        {titleLength}/{descriptionLength}
                      </span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const platform = selectedCopyPlatform;
                const draft = platformCopyDrafts[platform as PlatformName];
                if (!draft) return null;
                const titleLimit = getPlatformTitleLimit(platform);
                const descriptionLimit = getPlatformDescriptionLimit(platform);
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
                    <div className="rounded-lg border border-violet-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-violet-900">{platform}</p>
                        <button
                          type="button"
                          onClick={() => applyPlatformCopyToFields(platform)}
                          className="inline-flex items-center rounded-md border border-violet-300 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
                        >
                          {text.applyPlatformCopy}
                        </button>
                      </div>
                      <label className="text-[11px] font-semibold text-gray-600">
                        {isHebrew ? 'כותרת' : 'Title'} · {draft.title.trim().length}/{titleLimit}
                      </label>
                      <input
                        value={draft.title}
                        onChange={(e) =>
                          setPlatformCopyDrafts((prev) => ({
                            ...prev,
                            [platform]: {
                              ...(prev[platform as PlatformName] || { title: '', description: '' }),
                              title: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs mb-2"
                        placeholder={isHebrew ? 'כותרת מותאמת פלטפורמה' : 'Platform title'}
                      />
                      <label className="text-[11px] font-semibold text-gray-600">
                        {isHebrew ? 'טקסט מודעה' : 'Ad text'} · {draft.description.trim().length}/{descriptionLimit}
                      </label>
                      <textarea
                        value={draft.description}
                        onChange={(e) =>
                          setPlatformCopyDrafts((prev) => ({
                            ...prev,
                            [platform]: {
                              ...(prev[platform as PlatformName] || { title: '', description: '' }),
                              description: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                        placeholder={isHebrew ? 'תיאור מותאם פלטפורמה' : 'Platform description'}
                      />
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                      <p className="text-[11px] font-bold text-violet-900 inline-flex items-center gap-1.5 mb-2">
                        <Eye className="w-3.5 h-3.5" />
                        {isHebrew ? 'תצוגה מהירה של הטיוטה' : 'Quick draft preview'}
                      </p>
                      <div className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1.5">
                        <p className="text-[12px] font-extrabold text-gray-900">
                          {draft.title.trim() || (isHebrew ? 'כותרת מודעה' : 'Ad headline')}
                        </p>
                        <p className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                          {draft.description.trim() || text.previewNoText}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.campaignName}</label>
              <input
                value={campaignNameInput}
                onChange={(e) => setCampaignNameInput(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'לדוגמה: השקת קולקציה חדשה' : 'Example: New collection launch'}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.objective}</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as ObjectiveType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {objectiveOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.contentType}</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {contentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.productType}</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as ProductType)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {productTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">{text.serviceType}</label>
              <input
                value={serviceTypeInput}
                onChange={(e) => setServiceTypeInput(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'לדוגמה: שירות פרימיום לעסקים' : 'e.g. Premium service for SMBs'}
              />
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-white via-indigo-50/20 to-violet-50/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-bold text-indigo-900">{text.description}</label>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
                    useWooProductData
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  )}
                >
                  {useWooProductData ? text.wooTextMode : text.manualTextMode}
                </span>
                <span className="text-[10px] font-semibold text-indigo-700">
                  {campaignBrief.trim().length}/{getPlatformDescriptionLimit(selectedPreviewPlatform)}
                </span>
              </div>
            </div>
            <textarea
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              rows={4}
              className="w-full rounded-lg border-indigo-200 bg-white/90 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder={
                isHebrew
                  ? 'כתוב מה הפוסט/המוצר, למי הוא מיועד ומה המסר.'
                  : 'Describe the post/product, target user, and campaign message.'
              }
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {useWooProductData && (
                <button
                  type="button"
                  onClick={disableWooImportMode}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  {text.disableWooImport}
                </button>
              )}
              {useWooProductData && wooPublishScope === 'product' && selectedWooProduct && (
                <p className="text-[11px] text-sky-700">{text.wooAutoDescriptionHint}</p>
              )}
            </div>
          </div>

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

          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">{text.selectPlatforms}</p>
            {connectedAdPlatforms.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {text.noConnectedPlatforms}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(['Google', 'Meta', 'TikTok'] as const).map((platform) => {
                  const connected = connectedAdPlatforms.includes(platform);
                  const selected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => connected && togglePlatformSelection(platform)}
                      disabled={!connected}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : connected
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      )}
                      title={!connected ? text.connectedOnly : ''}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      {platform}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">{text.smartAudienceTitle}</h4>
            <p className="text-xs text-indigo-700 mb-3">{text.smartAudienceSubtitle}</p>
            <div className="flex flex-wrap gap-2">
              {audienceSuggestions.map((audience) => {
                const selected = selectedAudiences.includes(audience);
                return (
                  <button
                    key={audience}
                    type="button"
                    onClick={() => toggleAudienceSelection(audience)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    )}
                  >
                    {audience}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAudience())}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder={isHebrew ? 'קהל מותאם אישית...' : 'Custom audience...'}
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 text-sm font-bold"
              >
                <PlusCircle className="w-4 h-4" />
                {text.addCustomAudience}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-1">
              <ImagePlus className="w-4 h-4 text-indigo-600" />
              {text.uploadTitle}
            </h4>
            <p className="text-xs text-gray-500 mb-3">{text.uploadHint}</p>
            <p className="text-[11px] text-gray-500 mb-2">
              {isHebrew
                ? `תנאי התאמה נוכחיים: תמונה עד ${effectiveMediaLimits.imageMaxMb}MB, וידאו עד ${effectiveMediaLimits.videoMaxMb}MB, מקסימום ${effectiveMediaLimits.maxImageWidth}×${effectiveMediaLimits.maxImageHeight}.`
                : `Current compatibility limits: image up to ${effectiveMediaLimits.imageMaxMb}MB, video up to ${effectiveMediaLimits.videoMaxMb}MB, max ${effectiveMediaLimits.maxImageWidth}×${effectiveMediaLimits.maxImageHeight}.`}
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              {text.uploadButton}
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleAssetUpload} />
            </label>
            <p className="mt-2 text-[11px] text-gray-500">{text.noDataPersistenceNote}</p>
            {uploadedAssets.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {uploadedAssets.map((asset) => (
                  <div key={asset.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {asset.mediaType === 'video' ? (
                      <video src={asset.previewUrl} className="h-20 w-full object-cover" controls muted />
                    ) : (
                      <img src={asset.previewUrl} alt={asset.name} className="h-20 w-full object-cover" />
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] text-gray-600 truncate flex items-center gap-1">
                        {asset.mediaType === 'video' ? <Video className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
                        {asset.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.id)}
                      className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-red-600 border border-red-100 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
                <Clock3 className="w-4 h-4" />
                {text.timingRulesTitle}
              </h4>
              <p className="text-xs text-amber-700 mb-3">{text.bestWindows}</p>
              <div className="space-y-2 mb-3">
                {connectedAdPlatforms.map((platform) => (
                  <div key={platform} className="text-xs bg-white border border-amber-100 rounded-md px-2 py-1.5">
                    <span className="font-bold text-amber-900">{platform}: </span>
                    {(aiRecommendedHoursByPlatform[platform] || []).length > 0 ? (
                      <span className="text-amber-800">
                        {(aiRecommendedHoursByPlatform[platform] || []).map((hour) => formatHour(hour)).join(' · ')}
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        {isHebrew ? 'אין מספיק נתוני שעות להמלצה כרגע.' : 'Not enough hourly data for recommendation yet.'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                <select
                  value={rulePlatform}
                  onChange={(e) => setRulePlatform(e.target.value as PlatformName)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {connectedAdPlatforms.map((platform) => (
                    <option key={`rule-${platform}`} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleStartHour}
                  onChange={(e) => setRuleStartHour(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {hourOptions.map((hour) => (
                    <option key={`start-${hour}`} value={hour}>
                      {isHebrew ? 'מתחיל' : 'Start'} {formatHour(hour)}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleEndHour}
                  onChange={(e) => setRuleEndHour(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  {hourOptions.map((hour) => (
                    <option key={`end-${hour}`} value={hour}>
                      {isHebrew ? 'מסתיים' : 'End'} {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <select
                  value={ruleAction}
                  onChange={(e) => setRuleAction(e.target.value as RuleAction)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                >
                  <option value="boost">{isHebrew ? 'הגדל תקציב' : 'Boost budget'}</option>
                  <option value="limit">{isHebrew ? 'הגבל תקציב' : 'Limit budget'}</option>
                  <option value="pause">{isHebrew ? 'השהה מודעה' : 'Pause ads'}</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={ruleMinRoas}
                    onChange={(e) => setRuleMinRoas(Number(e.target.value))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                    placeholder="ROAS"
                  />
                </div>
                <input
                  value={ruleReason}
                  onChange={(e) => setRuleReason(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
                  placeholder={isHebrew ? 'סיבה/הערה לחוק' : 'Rule reason / note'}
                />
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={addTimeRule}
                  className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                >
                  {text.addRule}
                </button>
              </div>
              {timeRules.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {timeRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between rounded-md bg-white border border-amber-100 px-2 py-1.5 text-xs">
                      <span>
                        <strong>{rule.platform}</strong> · {formatHourRange(rule.startHour, rule.endHour)} ·{' '}
                        {rule.action === 'boost'
                          ? isHebrew
                            ? 'הגדל'
                            : 'Boost'
                          : rule.action === 'limit'
                          ? isHebrew
                            ? 'הגבל'
                            : 'Limit'
                          : isHebrew
                          ? 'השהה'
                          : 'Pause'}{' '}
                        · ROAS ≥ {rule.minRoas.toFixed(1)}
                        {rule.reason ? ` · ${rule.reason}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTimeRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-2">
                <CalendarClock className="w-4 h-4" />
                {text.weeklyTitle}
              </h4>
              {selectedPlatforms.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedPlatforms.map((platform) => (
                      <button
                        key={`schedule-${platform}`}
                        type="button"
                        onClick={() => setSelectedSchedulePlatform(platform)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-bold border',
                          selectedSchedulePlatform === platform
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        )}
                      >
                        {platform} · {text.weeklyActiveSlots}: {getActiveSlotsCount(platform)}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {DAY_KEYS.map((day) => (
                      <button
                        key={`day-tab-${day}`}
                        type="button"
                        onClick={() => setSelectedScheduleDay(day)}
                        className={cn(
                          'px-2 py-1 rounded-md text-[11px] font-bold border',
                          selectedScheduleDay === day
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-800 border-emerald-200'
                        )}
                      >
                        {dayLabels[day]}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleFullDay(selectedSchedulePlatform, selectedScheduleDay)}
                      className={cn(
                        'inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold',
                        isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100'
                          : 'border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50'
                      )}
                    >
                      {isFullDaySelected(selectedSchedulePlatform, selectedScheduleDay)
                        ? text.unmarkFullDay
                        : text.markFullDay}
                    </button>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-1.5">
                    {hourOptions.map((hour) => {
                      const active =
                        weeklySchedule[selectedSchedulePlatform]?.[selectedScheduleDay]?.includes(hour) || false;
                      return (
                        <button
                          key={`${selectedSchedulePlatform}-${selectedScheduleDay}-${hour}`}
                          type="button"
                          onClick={() => toggleScheduleHour(selectedSchedulePlatform, selectedScheduleDay, hour)}
                          className={cn(
                            'px-2 py-1 rounded-md border text-[10px] font-semibold',
                            active
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          )}
                        >
                          {formatHour(hour)}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs text-emerald-700">{text.noConnectedPlatforms}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-4">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">{text.previewTitle}</h4>
            <p className="text-xs text-indigo-700 mb-3">{text.previewSubtitle}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {previewPlatforms.map((platform) => (
                <button
                  key={`preview-tab-${platform}`}
                  type="button"
                  onClick={() => setSelectedPreviewPlatform(platform)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                    selectedPreviewPlatform === platform
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                  )}
                >
                  {platform}
                </button>
              ))}
            </div>
            {(() => {
              const platform = selectedPreviewPlatform;
              const platformDraft = platformCopyDrafts[platform as PlatformName];
              const previewTitle =
                platformDraft?.title?.trim() ||
                shortTitleInput.trim() ||
                campaignNameInput.trim() ||
                (isHebrew ? 'כותרת מודעה' : 'Ad headline');
              const previewDescription =
                platformDraft?.description?.trim() ||
                campaignBrief.trim() ||
                (isHebrew ? 'הטקסט יוצג כאן לפי הנתונים שהוזנו.' : 'Ad body will appear here based on the data entered.');
              const mediaCount = uploadedAssets.length;
              const audienceCount = selectedAudiences.length;
              const activeSlots = getActiveSlotsCount(platform);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-3">
                  <div className="rounded-lg border border-indigo-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-indigo-900">{platform}</p>
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {isHebrew ? 'תצוגה חיה' : 'Live preview'}
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <p className="text-[13px] font-extrabold text-gray-900 break-words">{previewTitle}</p>
                      <p className="text-[12px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words">
                        {previewDescription}
                      </p>
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-semibold">
                          {text.previewObjective}: {objectiveOptions.find((item) => item.value === objective)?.label || objective}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-[10px] font-semibold">
                          {text.previewMedia}: {mediaCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                    <p className="text-[11px] font-bold text-indigo-900 mb-2">{text.previewDataTitle}</p>
                    <ul className="space-y-1.5 text-xs text-indigo-800">
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewPlatforms}</span>
                        <span className="font-bold text-right">{previewPlatforms.join(', ')}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewAudiences}</span>
                        <span className="font-bold">{audienceCount}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewSchedule}</span>
                        <span className="font-bold">{activeSlots}</span>
                      </li>
                      <li className="flex items-start justify-between gap-2">
                        <span>{text.previewMedia}</span>
                        <span className="font-bold">{mediaCount}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <p className="text-xs text-gray-500">
              {isHebrew
                ? 'המודעות ייווצרו לפי הקהלים, התמונות והתזמון שבחרת, ורק בפלטפורמות שמחוברות לממשק.'
                : 'Campaigns are created with your selected audiences, media, and schedule only on connected platforms.'}
            </p>
            <button
              type="button"
              onClick={handleCreateScheduledCampaign}
              disabled={connectedAdPlatforms.length === 0 || isCreatingCampaign}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreatingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {isCreatingCampaign ? text.creatingLiveCampaigns : text.createDraft}
            </button>
          </div>

          {publishResults.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs space-y-1.5">
              {publishResults.map((result, index) => (
                <div key={`publish-${result.platform}-${index}`} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className={cn('font-bold', result.ok ? 'text-emerald-700' : 'text-rose-700')}>
                      {result.platform}
                    </span>{' '}
                    <span className="text-gray-600">{result.message}</span>
                  </div>
                  {result.campaignId && (
                    <span className="text-[11px] text-gray-500" dir="ltr">
                      #{result.campaignId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {builderMessage && (
            <div className={cn(
              'text-sm rounded-lg px-3 py-2 border',
              builderMessage === text.publishedOk
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            )}>
              {builderMessage}
            </div>
          )}
        </div>
      </section>
  );
}

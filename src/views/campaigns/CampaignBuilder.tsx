'use client';

import React from 'react';
import { Check, ImagePlus, Loader2, PlusCircle, Target, Trash2, Video } from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ContentType, ObjectiveType, PlatformName, ProductType, RuleAction,
  WooPublishScope, UploadedAsset, TimeRule, WeeklySchedule, PlatformCopyDraft, DayKey,
  MediaLimits, WooCampaignProduct,
} from './types';
import { CampaignSmartWindow } from './CampaignSmartWindow';
import { CampaignPlatformCopy } from './CampaignPlatformCopy';
import { CampaignWooPublish } from './CampaignWooPublish';
import { CampaignSchedulePanel } from './CampaignSchedulePanel';

type WooProduct = WooCampaignProduct & { imageUrl?: string; url?: string; category?: string };

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
  effectiveMediaLimits: MediaLimits;
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
  setRulePlatform: React.Dispatch<React.SetStateAction<PlatformName>>;
  setRuleReason: (v: string) => void;
  setRuleStartHour: (v: number) => void;
  setSelectedCopyPlatform: React.Dispatch<React.SetStateAction<PlatformName>>;
  setSelectedPreviewPlatform: React.Dispatch<React.SetStateAction<PlatformName>>;
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
  applyPlatformCopyToFields: (platform: PlatformName) => void;
  disableWooImportMode: () => void;
  formatHour: (hour: number) => string;
  formatHourRange: (start: number, end: number) => string;
  formatSmartElapsed: (ms: number) => string;
  getActiveSlotsCount: (platform: string) => number;
  getPlatformDescriptionLimit: (platform: PlatformName) => number;
  getPlatformTitleLimit: (platform: PlatformName) => number;
  handleAssetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutoAudienceAndStrategy: () => void;
  handleCreateScheduledCampaign: () => void;
  importWooProductToBuilder: (product: WooCampaignProduct, opts?: { overwriteExisting?: boolean; notify?: boolean }) => void;
  isFullDaySelected: (platform: string, day: DayKey) => boolean;
  removeAsset: (id: string) => void;
  removeTimeRule: (id: string) => void;
  toggleAudienceSelection: (audience: string) => void;
  toggleFullDay: (platform: string, day: DayKey) => void;
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

        {/* Smart window */}
        <CampaignSmartWindow
          isHebrew={isHebrew}
          isWooConnected={isWooConnected}
          aiAudienceLoading={aiAudienceLoading}
          aiAudienceProvider={aiAudienceProvider}
          smartAdElapsedMs={smartAdElapsedMs}
          useWooProductData={useWooProductData}
          wooLoading={wooLoading}
          wooPublishScope={wooPublishScope}
          selectedWooProductId={selectedWooProductId}
          selectedWooProduct={selectedWooProduct}
          shortTitleInput={shortTitleInput}
          campaignNameInput={campaignNameInput}
          wooProducts={wooProducts}
          wooProductsFiltered={wooProductsFiltered}
          shortTitleInputRef={shortTitleInputRef}
          text={text}
          setShortTitleInput={setShortTitleInput}
          setUseWooProductData={setUseWooProductData}
          setWooPublishScope={setWooPublishScope}
          setSelectedWooProductId={setSelectedWooProductId}
          setSelectedWooCategory={setSelectedWooCategory}
          wooCategoryOptions={wooCategoryOptions}
          selectedWooCategory={selectedWooCategory}
          disableWooImportMode={disableWooImportMode}
          importWooProductToBuilder={importWooProductToBuilder}
          handleAutoAudienceAndStrategy={handleAutoAudienceAndStrategy}
          formatSmartElapsed={formatSmartElapsed}
        />

        {/* Platform copy drafts */}
        <CampaignPlatformCopy
          isHebrew={isHebrew}
          draftPlatforms={draftPlatforms}
          selectedCopyPlatform={selectedCopyPlatform}
          platformCopyDrafts={platformCopyDrafts}
          text={text}
          getPlatformTitleLimit={getPlatformTitleLimit}
          getPlatformDescriptionLimit={getPlatformDescriptionLimit}
          setSelectedCopyPlatform={setSelectedCopyPlatform}
          setPlatformCopyDrafts={setPlatformCopyDrafts}
          applyPlatformCopyToFields={applyPlatformCopyToFields}
        />

        {/* Campaign form fields */}
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
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
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
                <option key={option.value} value={option.value}>{option.label}</option>
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

        {/* Campaign brief */}
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
                {campaignBrief.trim().length}/{getPlatformDescriptionLimit(selectedPreviewPlatform as PlatformName)}
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

        {/* WooCommerce publish panel */}
        <CampaignWooPublish
          isHebrew={isHebrew}
          isWooConnected={isWooConnected}
          useWooProductData={useWooProductData}
          wooLoading={wooLoading}
          wooPublishScope={wooPublishScope}
          selectedWooCategory={selectedWooCategory}
          selectedWooProductId={selectedWooProductId}
          selectedWooProduct={selectedWooProduct}
          wooCategoryOptions={wooCategoryOptions}
          wooProductsFiltered={wooProductsFiltered}
          wooProducts={wooProducts}
          text={text}
          setUseWooProductData={setUseWooProductData}
          setWooPublishScope={setWooPublishScope}
          setSelectedWooCategory={setSelectedWooCategory}
          setSelectedWooProductId={setSelectedWooProductId}
          disableWooImportMode={disableWooImportMode}
          importWooProductToBuilder={importWooProductToBuilder}
        />

        {/* Platform selector */}
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

        {/* Audience selector */}
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

        {/* Media upload */}
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

        {/* Schedule + time rules */}
        <CampaignSchedulePanel
          isHebrew={isHebrew}
          connectedAdPlatforms={connectedAdPlatforms}
          selectedPlatforms={selectedPlatforms}
          weeklySchedule={weeklySchedule}
          timeRules={timeRules}
          hourOptions={hourOptions}
          dayLabels={dayLabels}
          aiRecommendedHoursByPlatform={aiRecommendedHoursByPlatform}
          rulePlatform={rulePlatform}
          ruleStartHour={ruleStartHour}
          ruleEndHour={ruleEndHour}
          ruleAction={ruleAction}
          ruleMinRoas={ruleMinRoas}
          ruleReason={ruleReason}
          selectedSchedulePlatform={selectedSchedulePlatform}
          selectedScheduleDay={selectedScheduleDay}
          text={text}
          setRulePlatform={setRulePlatform}
          setRuleStartHour={setRuleStartHour}
          setRuleEndHour={setRuleEndHour}
          setRuleAction={setRuleAction}
          setRuleMinRoas={setRuleMinRoas}
          setRuleReason={setRuleReason}
          setSelectedSchedulePlatform={setSelectedSchedulePlatform}
          setSelectedScheduleDay={setSelectedScheduleDay}
          formatHour={formatHour}
          formatHourRange={formatHourRange}
          getActiveSlotsCount={getActiveSlotsCount}
          isFullDaySelected={isFullDaySelected}
          addTimeRule={addTimeRule}
          removeTimeRule={removeTimeRule}
          toggleFullDay={toggleFullDay}
          toggleScheduleHour={toggleScheduleHour}
        />

        {/* Ad preview */}
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-4">
          <h4 className="text-sm font-bold text-indigo-900 mb-1">{text.previewTitle}</h4>
          <p className="text-xs text-indigo-700 mb-3">{text.previewSubtitle}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {previewPlatforms.map((platform) => (
              <button
                key={`preview-tab-${platform}`}
                type="button"
                onClick={() => setSelectedPreviewPlatform(platform as PlatformName)}
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

        {/* Submit */}
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

'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Loader2, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MetaAdset } from '../../services/metaService';
import { toAmount, normalizeCampaignStatus, getStatusBadgeClass, formatPercent, hasMetaMetrics, hasGoogleMetrics } from './utils';

type CampaignTableProps = {
  filteredAndSortedCampaigns: any[];
  platforms: string[];
  statuses: string[];
  searchQuery: string;
  platformFilter: string;
  statusFilter: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  isSyncing: boolean;
  metaSyncNotice: string | null;
  editMessage: string | null;
  hasConnectedAdPlatform: boolean;
  expandedCampaigns: Set<string>;
  adsetsByCampaignId: Record<string, MetaAdset[]>;
  loadingAdsetsCampaignId: string | null;
  isHebrew: boolean;
  text: {
    createdCampaigns: string;
    syncLive: string;
    actions: string;
    editCampaign: string;
    editNotAvailable: string;
  };
  setSearchQuery: (v: string) => void;
  setPlatformFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  setSortField: (v: string) => void;
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  toggleCampaignExpand: (campaign: any) => void;
  openEditCampaign: (campaign: any) => void;
  isEditablePlatformCampaign: (campaign: any) => boolean;
  formatCurrency: (amount: number) => string;
  t: (key: string) => string;
};

export function CampaignTable({
  filteredAndSortedCampaigns,
  platforms,
  statuses,
  searchQuery,
  platformFilter,
  statusFilter,
  sortField,
  sortOrder,
  isSyncing,
  metaSyncNotice,
  editMessage,
  hasConnectedAdPlatform,
  expandedCampaigns,
  adsetsByCampaignId,
  loadingAdsetsCampaignId,
  isHebrew,
  text,
  setSearchQuery,
  setPlatformFilter,
  setStatusFilter,
  setSortField,
  setSortOrder,
  toggleCampaignExpand,
  openEditCampaign,
  isEditablePlatformCampaign,
  formatCurrency,
  t,
}: CampaignTableProps) {
  return (
    <section className="bg-white shadow rounded-lg overflow-hidden flex flex-col border border-gray-200">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {text.createdCampaigns} {isHebrew ? 'לפי פלטפורמה' : 'by platform'}
          </h3>
          {isSyncing && (
            <span className="flex items-center text-xs text-indigo-600 font-bold animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin ml-1" />
              {text.syncLive}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder={t('campaigns.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform === 'All' ? t('campaigns.allPlatforms') : platform}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === 'All' ? t('campaigns.allStatuses') : status}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="block min-w-0 flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="name">{t('campaigns.campaignName')}</option>
              <option value="platform">{t('campaigns.platform')}</option>
              <option value="status">{t('campaigns.status')}</option>
              <option value="spend">{t('campaigns.spend')}</option>
              <option value="roas">{t('campaigns.roas')}</option>
              <option value="cpa">{t('campaigns.cpa')}</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 shrink-0"
              title={sortOrder === 'asc' ? t('campaigns.ascending') : t('campaigns.descending')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {metaSyncNotice && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {metaSyncNotice}
          </div>
        )}
        {editMessage && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {editMessage}
          </div>
        )}
        {filteredAndSortedCampaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
            {!hasConnectedAdPlatform ? t('campaigns.connectPlatforms') : t('campaigns.noCampaigns')}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-2 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide w-6"></th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.campaignName')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.platform')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.status')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'סוג / יעד' : 'Type / Obj.'}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Impr.</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Reach</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Clicks</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CTR</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CPC</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">CPM</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Freq.</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.spend')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.roas')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{t('campaigns.cpa')}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">Conv.</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'הכנסה מיוחסת' : 'Conv. Val.'}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'תקציב יומי' : 'Daily Bud.'}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{isHebrew ? 'מקור' : 'Source'}</th>
                    <th className="px-4 py-2 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wide">{text.actions}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredAndSortedCampaigns.map((campaign, index) => {
                    const unifiedStatus = normalizeCampaignStatus(campaign.status);
                    const platform = String(campaign.platform || '');
                    const campaignRowId = String(campaign?.campaignId || campaign?.id || campaign?.name || index);
                    const isExpanded = expandedCampaigns.has(campaignRowId);
                    const isLoadingAdsets = loadingAdsetsCampaignId === campaignRowId;
                    const campaignAdsets = adsetsByCampaignId[campaignRowId] || [];
                    const metaFacebookSpend = toAmount(campaign?.metaChannels?.facebook?.spend);
                    const metaInstagramSpend = toAmount(campaign?.metaChannels?.instagram?.spend);
                    const metaWhatsappSpend = toAmount(campaign?.metaChannels?.whatsapp?.spend);
                    const metaWhatsappConversations = toAmount(campaign?.metaChannels?.whatsapp?.conversations);
                    const hasMetaChannels =
                      platform === 'Meta' &&
                      (metaFacebookSpend > 0 ||
                        metaInstagramSpend > 0 ||
                        Boolean(campaign?.metaChannels?.whatsapp?.enabled));
                    const typeOrObjective =
                      platform === 'Meta'
                        ? campaign.objective || '—'
                        : platform === 'Google'
                          ? campaign.advertisingChannelSubType || campaign.advertisingChannelType || '—'
                          : campaign.campaignType || campaign.objective || '—';
                    const hasMetrics =
                      platform === 'Meta'
                        ? hasMetaMetrics(campaign)
                        : platform === 'Google'
                          ? hasGoogleMetrics(campaign)
                          : (toAmount(campaign.impressions) + toAmount(campaign.clicks) + toAmount(campaign.spend)) > 0;
                    const canEdit = isEditablePlatformCampaign(campaign);
                    const dailyBudget = toAmount(campaign.dailyBudget);
                    const lifetimeBudget = toAmount(campaign.lifetimeBudget);
                    const displayBudget = dailyBudget > 0 ? dailyBudget : lifetimeBudget > 0 ? lifetimeBudget : 0;

                    return (
                      <React.Fragment key={`campaign-row-${platform}-${campaignRowId}`}>
                        <tr className={cn(isExpanded ? 'bg-indigo-50/30' : '')}>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCampaignExpand({ ...campaign, campaignId: campaignRowId })}
                              className="text-gray-400 hover:text-indigo-600"
                              title={isExpanded ? (isHebrew ? 'סגור' : 'Collapse') : (isHebrew ? 'פרט קבוצות מודעות' : 'Expand adsets')}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                            <div className="max-w-[200px] truncate" title={String(campaign?.name || campaign?.campaignName || '')}>
                              {campaign?.name || campaign?.campaignName || (isHebrew ? 'ללא שם' : 'Unnamed')}
                            </div>
                            {hasMetaChannels && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                  FB {metaFacebookSpend > 0 ? formatCurrency(metaFacebookSpend) : '—'}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                  IG {metaInstagramSpend > 0 ? formatCurrency(metaInstagramSpend) : '—'}
                                </span>
                                {campaign?.metaChannels?.whatsapp?.enabled && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                    WA {metaWhatsappSpend > 0 ? formatCurrency(metaWhatsappSpend) : ''}
                                    {metaWhatsappConversations > 0 ? ` · ${Math.round(metaWhatsappConversations)}` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-700">{platform || '—'}</td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              getStatusBadgeClass(unifiedStatus)
                            )}>
                              {unifiedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600 max-w-[100px] truncate">{typeOrObjective}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.impressions).toLocaleString()}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.reach) > 0 ? toAmount(campaign.reach).toLocaleString() : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.clicks).toLocaleString()}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{formatPercent(campaign.ctr)}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpc) > 0 ? formatCurrency(toAmount(campaign.cpc)) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpm) > 0 ? formatCurrency(toAmount(campaign.cpm)) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.frequency) > 0 ? toAmount(campaign.frequency).toFixed(2) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold text-gray-800">{formatCurrency(toAmount(campaign.spend))}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.roas).toFixed(2)}x</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.cpa) > 0 ? formatCurrency(toAmount(campaign.cpa)) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.conversions) > 0 ? toAmount(campaign.conversions).toLocaleString() : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{toAmount(campaign.conversionValue) > 0 ? formatCurrency(toAmount(campaign.conversionValue)) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">{displayBudget > 0 ? formatCurrency(displayBudget) : '—'}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                              hasMetrics ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            )}>
                              {hasMetrics ? (isHebrew ? 'חי' : 'Live') : (isHebrew ? 'חסר' : 'No data')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEditCampaign(campaign)}
                              title={!canEdit ? text.editNotAvailable : text.editCampaign}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold',
                                canEdit
                                  ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
                              )}
                            >
                              <Pencil className="w-3 h-3" />
                              {text.editCampaign}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={20} className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                              {isLoadingAdsets ? (
                                <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  {isHebrew ? 'טוען קבוצות מודעות...' : 'Loading ad sets...'}
                                </div>
                              ) : campaignAdsets.length === 0 ? (
                                <p className="text-xs text-gray-500 py-1">{isHebrew ? 'אין קבוצות מודעות עם נתונים לתקופה הנבחרת.' : 'No ad sets with data for the selected period.'}</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">{isHebrew ? 'קבוצות מודעות' : 'Ad Sets'} ({campaignAdsets.length})</p>
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'שם קבוצת מודעות' : 'Ad Set Name'}</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'סטטוס' : 'Status'}</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'יעד אופטימיזציה' : 'Optimization'}</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">Impr.</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">Reach</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">Clicks</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">CTR</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPC</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPM</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">Freq.</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'הוצאה' : 'Spend'}</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">ROAS</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">CPA</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">Conv.</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'הכנסה' : 'Conv. Val.'}</th>
                                        <th className="px-3 py-1.5 text-start font-bold text-gray-500">{isHebrew ? 'תקציב יומי' : 'Daily Bud.'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {campaignAdsets.map((adset) => (
                                        <tr key={adset.id} className="border-b border-gray-100 hover:bg-white">
                                          <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[180px] truncate" title={adset.name}>{adset.name}</td>
                                          <td className="px-3 py-1.5">
                                            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', getStatusBadgeClass(normalizeCampaignStatus(adset.status)))}>
                                              {normalizeCampaignStatus(adset.status)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.optimizationGoal || '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.impressions > 0 ? adset.impressions.toLocaleString() : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.reach > 0 ? adset.reach.toLocaleString() : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.clicks > 0 ? adset.clicks.toLocaleString() : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.ctr > 0 ? `${adset.ctr.toFixed(2)}%` : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.cpc > 0 ? formatCurrency(adset.cpc) : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.cpm > 0 ? formatCurrency(adset.cpm) : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.frequency > 0 ? adset.frequency.toFixed(2) : '—'}</td>
                                          <td className="px-3 py-1.5 font-semibold text-gray-800">{adset.spend > 0 ? formatCurrency(adset.spend) : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.roas > 0 ? `${adset.roas.toFixed(2)}x` : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.cpa > 0 ? formatCurrency(adset.cpa) : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.conversions > 0 ? adset.conversions.toLocaleString() : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.conversionValue > 0 ? formatCurrency(adset.conversionValue) : '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600">{adset.dailyBudget > 0 ? formatCurrency(adset.dailyBudget) : adset.lifetimeBudget > 0 ? formatCurrency(adset.lifetimeBudget) : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

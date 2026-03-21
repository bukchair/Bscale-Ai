"use client";

import React, { useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  TrendingUp,
  Filter,
  Download,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { useCurrency } from '../contexts/CurrencyContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useDateRangeBounds } from '../contexts/DateRangeContext';
import { type GoogleNegativeKeywordScope } from '../services/googleService';
import {
  useSearchAnalysis,
  type SearchTermRow,
  type AppliedNegativeKeyword,
} from './search-analysis/useSearchAnalysis';


export function SearchAnalysis() {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const { format: formatCurrency } = useCurrency();
  const { connections } = useConnections();
  const bounds = useDateRangeBounds();

  const startDateIso = useMemo(() => bounds.startDate.toISOString().slice(0, 10), [bounds.startDate]);
  const endDateIso = useMemo(() => bounds.endDate.toISOString().slice(0, 10), [bounds.endDate]);

  const {
    activeTab, setActiveTab,
    searchTerms,
    negativeKeywords, setNegativeKeywords,
    isLoading,
    syncError, setSyncError,
    isAiExpanded, setIsAiExpanded,
    isApplyingNegatives,
    selectedMatchType, setSelectedMatchType,
    negativeApplyScope, setNegativeApplyScope,
    sharedListName, setSharedListName,
    lastApplySummary,
    googleToken,
    googleCustomerId,
    filteredTerms,
    negativeCandidates,
    gscOpportunities,
    estimatedMonthlySavings,
    applyNegativeTerms,
  } = useSearchAnalysis({ connections, isHebrew, startDateIso, endDateIso });


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.searchAnalysis')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('search.subtitle')}</p>
          <p className="text-xs text-indigo-600 mt-1" dir="ltr">
            {startDateIso} → {endDateIso}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-bold shadow-sm">
            <Filter className="w-4 h-4" />
            {t('search.filters')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-bold shadow-sm">
            <Download className="w-4 h-4" />
            {t('search.export')}
          </button>
        </div>
      </div>

      {syncError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {syncError}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                {t('search.aiInsightsTitle')}
              </h2>
              <p className="text-[11px] text-gray-500">
                {isHebrew
                  ? 'ניתוח משולב Google Ads + GSC עם פעולה ישירה לעדכון מילות שלילה'
                  : 'Combined Google Ads + GSC analysis with direct negative-keyword update'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void applyNegativeTerms(negativeCandidates.slice(0, 30))}
              disabled={isApplyingNegatives || negativeCandidates.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-60"
            >
              {isApplyingNegatives ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {isApplyingNegatives
                ? isHebrew
                  ? 'מעדכן בגוגל...'
                  : 'Updating Google...'
                : t('search.reviewAndApply')}
            </button>
            <button
              onClick={() => setIsAiExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700"
            >
              {isAiExpanded ? (isHebrew ? 'צמצם' : 'Collapse') : isHebrew ? 'הרחב' : 'Expand'}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isAiExpanded ? 'rotate-180' : '')} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
            {negativeCandidates.length} {isHebrew ? 'מועמדי שלילה' : 'negative candidates'}
          </span>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            {gscOpportunities.length} {isHebrew ? 'הזדמנויות GSC' : 'GSC opportunities'}
          </span>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" dir="ltr">
            {formatCurrency(estimatedMonthlySavings)} {isHebrew ? 'חיסכון חודשי משוער' : 'estimated monthly savings'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="text-xs font-bold text-gray-600">
            {isHebrew ? 'Match Type' : 'Match Type'}
            <select
              value={selectedMatchType}
              onChange={(event) =>
                setSelectedMatchType(
                  (event.target.value as 'BROAD' | 'PHRASE' | 'EXACT') || 'PHRASE'
                )
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800"
            >
              <option value="BROAD">{isHebrew ? 'רחב (Broad)' : 'Broad'}</option>
              <option value="PHRASE">{isHebrew ? 'ביטוי (Phrase)' : 'Phrase'}</option>
              <option value="EXACT">{isHebrew ? 'מדויק (Exact)' : 'Exact'}</option>
            </select>
          </label>
          <label className="text-xs font-bold text-gray-600">
            {isHebrew ? 'רמת יישום' : 'Apply scope'}
            <select
              value={negativeApplyScope}
              onChange={(event) =>
                setNegativeApplyScope(
                  (event.target.value as GoogleNegativeKeywordScope) || 'campaign'
                )
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800"
            >
              <option value="campaign">{isHebrew ? 'Campaign' : 'Campaign'}</option>
              <option value="ad_group">{isHebrew ? 'Ad Group' : 'Ad Group'}</option>
              <option value="shared_list">{isHebrew ? 'Shared List' : 'Shared List'}</option>
            </select>
          </label>
          <label className="text-xs font-bold text-gray-600">
            {isHebrew ? 'שם רשימה משותפת' : 'Shared list name'}
            <input
              value={sharedListName}
              onChange={(event) => setSharedListName(event.target.value)}
              disabled={negativeApplyScope !== 'shared_list'}
              placeholder={isHebrew ? 'BScale Shared Negatives' : 'BScale Shared Negatives'}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-60"
            />
          </label>
        </div>

        {isAiExpanded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
              <p className="text-xs font-bold text-red-700 mb-2">{t('search.negativeCandidates')}</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {negativeCandidates.slice(0, 8).map((row) => (
                  <div key={`${row.campaignId}-${row.term}`} className="text-xs flex items-start justify-between gap-2">
                    <span className="text-gray-800 truncate">{row.term}</span>
                    <span className="text-red-700 font-bold shrink-0" dir="ltr">
                      {formatCurrency(Number(row.cost || 0))}
                    </span>
                  </div>
                ))}
                {negativeCandidates.length === 0 ? (
                  <p className="text-[11px] text-gray-500">{isHebrew ? 'אין כרגע מועמדים חזקים לשלילה.' : 'No strong negative candidates right now.'}</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="text-xs font-bold text-indigo-700 mb-2">{t('search.seoOpportunity')}</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {gscOpportunities.slice(0, 8).map((row) => (
                  <div key={`gsc-${row.term}`} className="text-xs flex items-start justify-between gap-2">
                    <span className="text-gray-800 truncate">{row.term}</span>
                    <span className="text-indigo-700 font-bold shrink-0">
                      {isHebrew ? 'מיקום' : 'Pos'} {Number(row.position || 0).toFixed(1)}
                    </span>
                  </div>
                ))}
                {gscOpportunities.length === 0 ? (
                  <p className="text-[11px] text-gray-500">{isHebrew ? 'אין כרגע הזדמנויות SEO בולטות.' : 'No major SEO opportunities right now.'}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {lastApplySummary ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {isHebrew
              ? `סיכום עדכון לגוגל: נשלחו ${lastApplySummary.requested}, עודכנו ${lastApplySummary.applied}, נכשלו ${lastApplySummary.failed}, דולגו ${lastApplySummary.skipped}.`
              : `Google update summary: requested ${lastApplySummary.requested}, applied ${lastApplySummary.applied}, failed ${lastApplySummary.failed}, skipped ${lastApplySummary.skipped}.`}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">{t('search.performanceTitle')}</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-4 py-1.5 text-sm font-bold rounded-lg transition-colors',
                activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t('search.allTerms')}
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className={cn(
                'px-4 py-1.5 text-sm font-bold rounded-lg transition-colors',
                activeTab === 'ads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Google Ads
            </button>
            <button
              onClick={() => setActiveTab('organic')}
              className={cn(
                'px-4 py-1.5 text-sm font-bold rounded-lg transition-colors',
                activeTab === 'organic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t('search.organicGsc')}
            </button>
            <button
              onClick={() => setActiveTab('negative')}
              className={cn(
                'px-4 py-1.5 text-sm font-bold rounded-lg transition-colors',
                activeTab === 'negative' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t('search.negativeKeywords')}
            </button>
          </div>
        </div>

        {activeTab === 'negative' ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{t('search.manageNegatives')}</h3>
              <button
                onClick={() => void applyNegativeTerms(negativeCandidates.slice(0, 30))}
                disabled={isApplyingNegatives || negativeCandidates.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
              >
                {isApplyingNegatives
                  ? isHebrew
                    ? 'מעדכן...'
                    : 'Applying...'
                  : t('search.reviewAndApply')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className={cn('w-full text-sm', dir === 'rtl' ? 'text-right' : 'text-left')}>
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('search.negativeKeyword')}</th>
                    <th className="px-6 py-4 font-bold">{t('search.matchType')}</th>
                    <th className="px-6 py-4 font-bold">{isHebrew ? 'רמת יישום' : 'Scope'}</th>
                    <th className="px-6 py-4 font-bold">{t('search.campaignGroup')}</th>
                    <th className="px-6 py-4 font-bold">{t('search.addedDate')}</th>
                    <th className="px-6 py-4 font-bold">{t('common.status')}</th>
                    <th className={cn('px-6 py-4 font-bold', dir === 'rtl' ? 'text-left' : 'text-right')}>
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {negativeKeywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{kw.term}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                          {kw.matchType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {kw.scope === 'campaign'
                          ? 'Campaign'
                          : kw.scope === 'ad_group'
                          ? 'Ad Group'
                          : 'Shared List'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{kw.target}</td>
                      <td className="px-6 py-4 text-gray-500">{kw.addedDate}</td>
                      <td className="px-6 py-4">
                        <span className={cn('text-xs font-bold', kw.result === 'applied' ? 'text-emerald-600' : 'text-red-600')}>
                          {kw.result === 'applied'
                            ? isHebrew
                              ? 'עודכן'
                              : 'Applied'
                            : isHebrew
                            ? 'נכשל'
                            : 'Failed'}
                        </span>
                        {kw.error ? <p className="text-[10px] text-red-600 mt-1">{kw.error}</p> : null}
                      </td>
                      <td className={cn('px-6 py-4', dir === 'rtl' ? 'text-left' : 'text-right')}>
                        <button
                          onClick={() => setNegativeKeywords((prev) => prev.filter((item) => item.id !== kw.id))}
                          className="text-red-600 hover:text-red-800 font-bold text-sm"
                        >
                          {t('search.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!negativeKeywords.length ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                        {isHebrew
                          ? 'עדיין לא בוצעו עדכוני מילות שלילה חיים לגוגל.'
                          : 'No live negative-keyword updates were applied to Google yet.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full text-sm', dir === 'rtl' ? 'text-right' : 'text-left')}>
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('search.searchTerm')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.source')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.metrics')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.performance')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.aiStatus')}</th>
                  <th className={cn('px-6 py-4 font-bold', dir === 'rtl' ? 'text-left' : 'text-right')}>
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTerms.map((term, idx) => (
                  <tr key={`${term.source}-${term.term}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <div className="min-w-0">
                          <p className="truncate">{term.term}</p>
                          {term.source === 'Google Ads' && term.campaignName ? (
                            <p className="text-[10px] text-gray-500 font-medium truncate">
                              {term.campaignName}
                              {term.adGroupName ? ` · ${term.adGroupName}` : ''}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-bold',
                          term.source === 'Google Ads'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        )}
                      >
                        {term.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {term.source === 'Google Ads' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">
                            {term.clicks} {t('search.clicks')}
                          </span>
                          <span className="text-gray-500 text-xs" dir="ltr">
                            {formatCurrency(Number(term.cost || 0))} {t('search.spend')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">
                            {Number(term.impressions || 0).toLocaleString()} {t('search.impressions')}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {term.clicks} {t('search.clicks')}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {term.source === 'Google Ads' ? (
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              'font-bold',
                              Number(term.roas || 0) > 0 ? 'text-emerald-600' : 'text-red-600'
                            )}
                            dir="ltr"
                          >
                            {Number(term.roas || 0) > 0
                              ? `${Number(term.roas || 0).toFixed(2)}x ROAS`
                              : `0 ${t('search.conversions')}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-bold">
                            {t('search.position')}: {Number(term.position || 0).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-bold',
                          term.status === 'optimal'
                            ? 'text-emerald-600'
                            : term.status === 'negative_candidate'
                            ? 'text-red-600'
                            : term.status === 'opportunity'
                            ? 'text-indigo-600'
                            : 'text-amber-600'
                        )}
                      >
                        {term.status === 'optimal' && <CheckCircle2 className="w-4 h-4" />}
                        {term.status === 'negative_candidate' && <XCircle className="w-4 h-4" />}
                        {term.status === 'opportunity' && <TrendingUp className="w-4 h-4" />}
                        {(term.status === 'review' || term.status === 'improve') && (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        {term.status === 'optimal'
                          ? t('search.statusOptimal')
                          : term.status === 'negative_candidate'
                          ? t('search.statusNegativeCandidate')
                          : term.status === 'opportunity'
                          ? t('search.statusOpportunity')
                          : term.status === 'review'
                          ? t('search.statusReview')
                          : term.status === 'improve'
                          ? t('search.statusImprove')
                          : term.status}
                      </span>
                      {term.reason ? <p className="text-[10px] text-gray-500 mt-1">{term.reason}</p> : null}
                    </td>
                    <td className={cn('px-6 py-4', dir === 'rtl' ? 'text-left' : 'text-right')}>
                      {term.status === 'negative_candidate' ? (
                        <button
                          onClick={() => void applyNegativeTerms([term])}
                          disabled={
                            isApplyingNegatives ||
                            (negativeApplyScope === 'campaign'
                              ? !term.campaignId
                              : negativeApplyScope === 'ad_group'
                              ? !term.adGroupId
                              : false)
                          }
                          className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {isApplyingNegatives ? (isHebrew ? 'מעדכן...' : 'Applying...') : t('search.addAsNegative')}
                        </button>
                      ) : (
                        <button className="text-indigo-600 hover:text-indigo-900 font-bold text-sm">
                          {t('search.viewDetails')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredTerms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      {t('campaigns.noCampaigns')}
                    </td>
                  </tr>
                ) : null}
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-indigo-600">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-indigo-500" />
                        {t('campaigns.syncLive')}
                      </span>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

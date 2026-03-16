import React, { useEffect, useMemo, useState } from 'react';
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
import {
  applyGoogleNegativeKeywords,
  fetchGoogleSearchTerms,
  fetchGSCData,
  type GoogleNegativeKeywordItem,
} from '../services/googleService';

type SearchStatus = 'review' | 'optimal' | 'opportunity' | 'negative_candidate' | 'improve';
type SearchTermRow = {
  term: string;
  clicks: number;
  cost?: number;
  conversions?: number;
  conversionValue?: number;
  roas?: number;
  ctr?: number;
  source: 'Google Ads' | 'GSC';
  status: SearchStatus;
  impressions?: number;
  position?: number;
  campaignId?: string;
  campaignName?: string;
  reason?: string;
};

type AppliedNegativeKeyword = {
  id: string;
  term: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  campaign: string;
  addedDate: string;
  result: 'applied' | 'failed';
  error?: string;
};

const demoSearchTerms: SearchTermRow[] = [
  {
    term: 'נעלי ריצה זולות',
    clicks: 145,
    cost: 320,
    conversions: 0,
    roas: 0,
    source: 'Google Ads',
    status: 'negative_candidate',
    campaignId: '12345',
    campaignName: 'Search - Shoes',
    reason: 'Spend without conversions',
  },
  {
    term: 'נעלי הריצה הטובות ביותר 2024',
    clicks: 320,
    cost: 850,
    conversions: 12,
    roas: 4.2,
    source: 'Google Ads',
    status: 'optimal',
    campaignId: '12345',
    campaignName: 'Search - Shoes',
  },
  {
    term: 'איך להתחיל לרוץ',
    impressions: 4500,
    clicks: 320,
    position: 4.2,
    source: 'GSC',
    status: 'opportunity',
  },
  {
    term: 'אפליקציית ריצה חינם',
    clicks: 85,
    cost: 120,
    conversions: 0,
    roas: 0,
    source: 'Google Ads',
    status: 'negative_candidate',
    campaignId: '67890',
    campaignName: 'Search - App',
    reason: 'Low commercial intent',
  },
  {
    term: 'נעלי ריצה קרובות אלי',
    impressions: 1200,
    clicks: 45,
    position: 8.5,
    source: 'GSC',
    status: 'improve',
  },
];

export function SearchAnalysis() {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const { format: formatCurrency } = useCurrency();
  const { connections } = useConnections();
  const bounds = useDateRangeBounds();

  const [activeTab, setActiveTab] = useState<'all' | 'ads' | 'organic' | 'negative'>('all');
  const [searchTerms, setSearchTerms] = useState<SearchTermRow[]>(demoSearchTerms);
  const [negativeKeywords, setNegativeKeywords] = useState<AppliedNegativeKeyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const [isApplyingNegatives, setIsApplyingNegatives] = useState(false);
  const [lastApplySummary, setLastApplySummary] = useState<{
    requested: number;
    deduplicated: number;
    applied: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const startDateIso = useMemo(() => bounds.startDate.toISOString().slice(0, 10), [bounds.startDate]);
  const endDateIso = useMemo(() => bounds.endDate.toISOString().slice(0, 10), [bounds.endDate]);

  const googleConnection = useMemo(
    () => connections.find((connection) => connection.id === 'google'),
    [connections]
  );
  const googleToken =
    googleConnection?.status === 'connected'
      ? (googleConnection.settings?.googleAccessToken as string | undefined) || 'server-managed'
      : '';
  const googleCustomerId = String(
    googleConnection?.settings?.googleAdsId ||
      googleConnection?.settings?.customerId ||
      googleConnection?.settings?.googleCustomerId ||
      ''
  );
  const googleLoginCustomerId = String(googleConnection?.settings?.loginCustomerId || '');
  const googleSiteUrl = String(
    googleConnection?.settings?.siteUrl || googleConnection?.settings?.gscSiteUrl || ''
  );

  const gscSignalsByTerm = (
    rows: any[]
  ): Map<string, { clicks: number; impressions: number; position: number; ctr: number }> => {
    const map = new Map<string, { clicks: number; impressions: number; position: number; ctr: number }>();
    rows.forEach((row) => {
      const term = String(row?.keys?.[0] || '')
        .trim()
        .toLowerCase();
      if (!term) return;
      const impressions = Number(row?.impressions || 0);
      const clicks = Number(row?.clicks || 0);
      const position = Number(row?.position || 0);
      const ctr = impressions > 0 ? clicks / impressions : 0;
      map.set(term, { clicks, impressions, position, ctr });
    });
    return map;
  };

  useEffect(() => {
    let cancelled = false;

    const loadSearchTerms = async () => {
      if (!googleToken) {
        setSearchTerms(demoSearchTerms);
        setSyncError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSyncError(null);

      const [adsResult, gscResult] = await Promise.allSettled([
        fetchGoogleSearchTerms(
          googleToken,
          googleCustomerId || undefined,
          googleLoginCustomerId || undefined,
          startDateIso,
          endDateIso
        ),
        fetchGSCData(
          googleToken,
          googleSiteUrl || undefined,
          startDateIso,
          endDateIso
        ),
      ]);

      if (cancelled) return;

      const nextTerms: SearchTermRow[] = [];
      const errors: string[] = [];
      const gscRows =
        gscResult.status === 'fulfilled' && Array.isArray(gscResult.value?.rows)
          ? gscResult.value.rows
          : [];
      const gscByTerm = gscSignalsByTerm(gscRows);
      const adsTerms = new Set<string>();

      if (adsResult.status === 'fulfilled') {
        const adsRows = Array.isArray(adsResult.value) ? adsResult.value : [];
        adsRows.forEach((row: any) => {
          const term = String(row?.term || '').trim();
          if (!term) return;
          const normalized = term.toLowerCase();
          adsTerms.add(normalized);

          const spend = Number(row?.cost || 0);
          const conversions = Number(row?.conversions || 0);
          const clicks = Number(row?.clicks || 0);
          const roas = Number(row?.roas || 0);
          const gscSignal = gscByTerm.get(normalized);

          let status: SearchStatus = 'review';
          let reason = '';

          if (conversions <= 0 && spend >= 25 && clicks >= 6) {
            // If GSC indicates strong relevant intent, keep in review instead of immediate negative.
            if (
              gscSignal &&
              gscSignal.clicks >= 20 &&
              gscSignal.position > 0 &&
              gscSignal.position <= 7 &&
              gscSignal.ctr >= 0.03
            ) {
              status = 'review';
              reason = isHebrew
                ? 'סיגנל אורגני חזק מ-GSC, מומלץ סקירה ידנית.'
                : 'Strong organic signal from GSC, review manually.';
            } else {
              status = 'negative_candidate';
              reason = isHebrew
                ? 'הוצאה גבוהה ללא המרות.'
                : 'High spend with no conversions.';
            }
          } else if (roas >= 2.5 || conversions >= 3) {
            status = 'optimal';
          }

          nextTerms.push({
            term,
            campaignId: String(row?.campaignId || ''),
            campaignName: String(row?.campaignName || ''),
            clicks,
            impressions: Number(row?.impressions || 0),
            cost: spend,
            ctr: Number(row?.ctr || 0),
            conversions,
            conversionValue: Number(row?.conversionValue || 0),
            roas,
            source: 'Google Ads',
            status,
            reason,
          });
        });
      } else {
        errors.push(
          adsResult.reason instanceof Error ? adsResult.reason.message : 'Google Ads sync failed.'
        );
      }

      if (gscResult.status === 'fulfilled') {
        gscRows.forEach((row: any) => {
          const term = String(row?.keys?.[0] || '').trim();
          if (!term) return;
          const impressions = Number(row?.impressions || 0);
          const clicks = Number(row?.clicks || 0);
          const position = Number(row?.position || 0);
          const ctr = impressions > 0 ? clicks / impressions : 0;
          const normalized = term.toLowerCase();
          const alsoInAds = adsTerms.has(normalized);

          const status: SearchStatus =
            position > 10
              ? 'improve'
              : impressions >= 500 && ctr < 0.025
              ? 'opportunity'
              : alsoInAds
              ? 'opportunity'
              : 'optimal';

          nextTerms.push({
            term,
            impressions,
            clicks,
            position,
            ctr,
            source: 'GSC',
            status,
          });
        });
      } else {
        errors.push(gscResult.reason instanceof Error ? gscResult.reason.message : 'GSC sync failed.');
      }

      if (nextTerms.length === 0) {
        setSearchTerms(demoSearchTerms);
      } else {
        nextTerms.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        setSearchTerms(nextTerms);
      }
      setSyncError(errors.length ? errors.join(' | ') : null);
      setIsLoading(false);
    };

    void loadSearchTerms();

    return () => {
      cancelled = true;
    };
  }, [
    endDateIso,
    googleCustomerId,
    googleLoginCustomerId,
    googleSiteUrl,
    googleToken,
    isHebrew,
    startDateIso,
  ]);

  const filteredTerms = useMemo(
    () =>
      searchTerms.filter(
        (row) =>
          activeTab === 'all' ||
          (activeTab === 'ads' && row.source === 'Google Ads') ||
          (activeTab === 'organic' && row.source === 'GSC')
      ),
    [activeTab, searchTerms]
  );

  const negativeCandidates = useMemo(
    () =>
      searchTerms
        .filter((row) => row.source === 'Google Ads' && row.status === 'negative_candidate')
        .sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0)),
    [searchTerms]
  );

  const gscOpportunities = useMemo(
    () =>
      searchTerms
        .filter((row) => row.source === 'GSC' && (row.status === 'opportunity' || row.status === 'improve'))
        .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0)),
    [searchTerms]
  );

  const estimatedMonthlySavings = useMemo(
    () => negativeCandidates.reduce((sum, row) => sum + Number(row.cost || 0), 0) * 0.6,
    [negativeCandidates]
  );

  const applyNegativeTerms = async (rows: SearchTermRow[]) => {
    if (!googleToken) {
      setSyncError(isHebrew ? 'Google לא מחובר.' : 'Google is not connected.');
      return;
    }

    const itemsMap = new Map<string, GoogleNegativeKeywordItem>();
    rows.forEach((row) => {
      if (row.source !== 'Google Ads') return;
      const term = String(row.term || '').trim();
      const campaignId = String(row.campaignId || '').trim();
      if (!term || !campaignId) return;
      const key = `${campaignId}:${term.toLowerCase()}:PHRASE`;
      if (itemsMap.has(key)) return;
      itemsMap.set(key, {
        term,
        campaignId,
        campaignName: row.campaignName || campaignId,
        matchType: 'PHRASE',
      });
    });
    const items = Array.from(itemsMap.values());
    if (!items.length) {
      setSyncError(
        isHebrew
          ? 'אין מועמדים תקינים עם campaignId לעדכון בגוגל.'
          : 'No valid candidates with campaignId were found for Google update.'
      );
      return;
    }

    setIsApplyingNegatives(true);
    setSyncError(null);
    try {
      const payload = await applyGoogleNegativeKeywords(
        googleToken,
        items,
        googleCustomerId || undefined,
        googleLoginCustomerId || undefined
      );
      setLastApplySummary(payload?.summary || null);

      const nowDate = new Date().toISOString().slice(0, 10);
      const appliedRows = Array.isArray(payload?.applied) ? payload.applied : [];
      const failedRows = Array.isArray(payload?.failed) ? payload.failed : [];

      setNegativeKeywords((prev) => [
        ...appliedRows.map((item: any) => ({
          id: `${item.campaignId}-${item.term}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          term: String(item.term || ''),
          matchType: (item.matchType || 'PHRASE') as 'BROAD' | 'PHRASE' | 'EXACT',
          campaign: String(item.campaignName || item.campaignId || ''),
          addedDate: nowDate,
          result: 'applied' as const,
        })),
        ...failedRows.map((item: any) => ({
          id: `${item.campaignId}-${item.term}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          term: String(item.term || ''),
          matchType: (item.matchType || 'PHRASE') as 'BROAD' | 'PHRASE' | 'EXACT',
          campaign: String(item.campaignName || item.campaignId || ''),
          addedDate: nowDate,
          result: 'failed' as const,
          error: String(item.message || ''),
        })),
        ...prev,
      ]);

      const appliedSet = new Set(
        appliedRows.map((item: any) => `${String(item.campaignId || '')}:${String(item.term || '').toLowerCase()}`)
      );
      setSearchTerms((prev) =>
        prev.map((row) => {
          const key = `${String(row.campaignId || '')}:${String(row.term || '').toLowerCase()}`;
          if (!appliedSet.has(key)) return row;
          return {
            ...row,
            status: 'optimal',
            reason: isHebrew ? 'נוסף כשלילי בגוגל Ads.' : 'Added as negative in Google Ads.',
          };
        })
      );
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : isHebrew
          ? 'נכשלה הוספת מילות שלילה.'
          : 'Failed to apply negative keywords.'
      );
    } finally {
      setIsApplyingNegatives(false);
    }
  };

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
                      <td className="px-6 py-4 text-gray-600">{kw.campaign}</td>
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
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
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
                            <p className="text-[10px] text-gray-500 font-medium">
                              {term.campaignName}
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
                          disabled={isApplyingNegatives}
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

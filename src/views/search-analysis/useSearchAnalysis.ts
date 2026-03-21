import { useEffect, useMemo, useState } from 'react';
import {
  applyGoogleNegativeKeywords,
  fetchGoogleSearchTerms,
  fetchGSCData,
  type GoogleNegativeKeywordItem,
  type GoogleNegativeKeywordScope,
} from '../../services/googleService';
import type { Connection } from '../../contexts/ConnectionsContext';

// ── Types ────────────────────────────────────────────────────────────────────

export type SearchStatus = 'review' | 'optimal' | 'opportunity' | 'negative_candidate' | 'improve';

export type SearchTermRow = {
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
  adGroupId?: string;
  adGroupName?: string;
  reason?: string;
};

export type AppliedNegativeKeyword = {
  id: string;
  term: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
  scope: GoogleNegativeKeywordScope;
  target: string;
  sharedListName?: string;
  addedDate: string;
  result: 'applied' | 'failed';
  error?: string;
};

export const demoSearchTerms: SearchTermRow[] = [
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

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSearchAnalysisProps {
  connections: Connection[];
  isHebrew: boolean;
  startDateIso: string;
  endDateIso: string;
}

export function useSearchAnalysis({
  connections,
  isHebrew,
  startDateIso,
  endDateIso,
}: UseSearchAnalysisProps) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'ads' | 'organic' | 'negative'>('all');
  const [searchTerms, setSearchTerms] = useState<SearchTermRow[]>(demoSearchTerms);
  const [negativeKeywords, setNegativeKeywords] = useState<AppliedNegativeKeyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const [isApplyingNegatives, setIsApplyingNegatives] = useState(false);
  const [selectedMatchType, setSelectedMatchType] = useState<'BROAD' | 'PHRASE' | 'EXACT'>('PHRASE');
  const [negativeApplyScope, setNegativeApplyScope] = useState<GoogleNegativeKeywordScope>('campaign');
  const [sharedListName, setSharedListName] = useState('BScale Shared Negatives');
  const [lastApplySummary, setLastApplySummary] = useState<{
    requested: number;
    deduplicated: number;
    applied: number;
    failed: number;
    skipped: number;
  } | null>(null);

  // ── Derived Google connection values ──────────────────────────────────────
  const googleConnection = useMemo(
    () => connections.find((c) => c.id === 'google'),
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

  // ── Helper ────────────────────────────────────────────────────────────────
  const gscSignalsByTerm = (
    rows: any[]
  ): Map<string, { clicks: number; impressions: number; position: number; ctr: number }> => {
    const map = new Map<string, { clicks: number; impressions: number; position: number; ctr: number }>();
    rows.forEach((row) => {
      const term = String(row?.keys?.[0] || '').trim().toLowerCase();
      if (!term) return;
      const impressions = Number(row?.impressions || 0);
      const clicks = Number(row?.clicks || 0);
      const position = Number(row?.position || 0);
      const ctr = impressions > 0 ? clicks / impressions : 0;
      map.set(term, { clicks, impressions, position, ctr });
    });
    return map;
  };

  // ── Effect: load search terms ─────────────────────────────────────────────
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
              reason = isHebrew ? 'הוצאה גבוהה ללא המרות.' : 'High spend with no conversions.';
            }
          } else if (roas >= 2.5 || conversions >= 3) {
            status = 'optimal';
          }

          nextTerms.push({
            term,
            campaignId: String(row?.campaignId || ''),
            campaignName: String(row?.campaignName || ''),
            adGroupId: String(row?.adGroupId || ''),
            adGroupName: String(row?.adGroupName || ''),
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
        errors.push(
          gscResult.reason instanceof Error ? gscResult.reason.message : 'GSC sync failed.'
        );
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
  }, [endDateIso, googleCustomerId, googleLoginCustomerId, googleSiteUrl, googleToken, isHebrew, startDateIso]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memos ─────────────────────────────────────────────────────────────────
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

  // ── Handler ───────────────────────────────────────────────────────────────
  const applyNegativeTerms = async (rows: SearchTermRow[]) => {
    if (!googleToken) {
      setSyncError(isHebrew ? 'Google לא מחובר.' : 'Google is not connected.');
      return;
    }

    const itemsMap = new Map<string, GoogleNegativeKeywordItem>();
    const normalizedSharedListName = String(sharedListName || '').trim().slice(0, 120);

    rows.forEach((row) => {
      if (row.source !== 'Google Ads') return;
      const term = String(row.term || '').trim();
      const campaignId = String(row.campaignId || '').trim();
      const adGroupId = String(row.adGroupId || '').trim();
      if (!term) return;
      if (negativeApplyScope === 'campaign' && !campaignId) return;
      if (negativeApplyScope === 'ad_group' && !adGroupId) return;

      const targetKey =
        negativeApplyScope === 'campaign'
          ? campaignId
          : negativeApplyScope === 'ad_group'
          ? adGroupId
          : normalizedSharedListName || 'shared';
      const key = `${negativeApplyScope}:${targetKey}:${term.toLowerCase()}:${selectedMatchType}`;
      if (itemsMap.has(key)) return;
      itemsMap.set(key, {
        term,
        campaignId: campaignId || undefined,
        campaignName: row.campaignName || campaignId,
        adGroupId: adGroupId || undefined,
        adGroupName: String(row.adGroupName || ''),
        matchType: selectedMatchType,
      });
    });

    const items = Array.from(itemsMap.values());
    if (!items.length) {
      setSyncError(
        negativeApplyScope === 'ad_group'
          ? isHebrew
            ? 'אין מועמדים תקינים עם Ad Group לעדכון בגוגל.'
            : 'No valid candidates with Ad Group were found for Google update.'
          : negativeApplyScope === 'shared_list'
          ? isHebrew
            ? 'אין מועמדים תקינים לעדכון Shared List בגוגל.'
            : 'No valid candidates were found for shared list update in Google.'
          : isHebrew
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
        googleLoginCustomerId || undefined,
        {
          scope: negativeApplyScope,
          sharedListName: normalizedSharedListName || undefined,
        }
      );
      setLastApplySummary(payload?.summary || null);

      const nowDate = new Date().toISOString().slice(0, 10);
      const appliedRows = Array.isArray(payload?.applied) ? payload.applied : [];
      const failedRows = Array.isArray(payload?.failed) ? payload.failed : [];

      setNegativeKeywords((prev) => [
        ...appliedRows.map((item: any) => ({
          id: `${item.scope}-${item.campaignId || item.adGroupId || item.term}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          term: String(item.term || ''),
          matchType: (item.matchType || 'PHRASE') as 'BROAD' | 'PHRASE' | 'EXACT',
          scope: (item.scope || negativeApplyScope) as GoogleNegativeKeywordScope,
          target:
            item.scope === 'ad_group'
              ? String(item.adGroupName || item.adGroupId || '')
              : item.scope === 'shared_list'
              ? String(item.sharedSetName || normalizedSharedListName || 'Shared List')
              : String(item.campaignName || item.campaignId || ''),
          sharedListName: String(item.sharedSetName || normalizedSharedListName || ''),
          addedDate: nowDate,
          result: 'applied' as const,
        })),
        ...failedRows.map((item: any) => ({
          id: `${item.scope}-${item.campaignId || item.adGroupId || item.term}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          term: String(item.term || ''),
          matchType: (item.matchType || 'PHRASE') as 'BROAD' | 'PHRASE' | 'EXACT',
          scope: (item.scope || negativeApplyScope) as GoogleNegativeKeywordScope,
          target:
            item.scope === 'ad_group'
              ? String(item.adGroupName || item.adGroupId || '')
              : item.scope === 'shared_list'
              ? String(item.sharedSetName || normalizedSharedListName || 'Shared List')
              : String(item.campaignName || item.campaignId || ''),
          sharedListName: String(item.sharedSetName || normalizedSharedListName || ''),
          addedDate: nowDate,
          result: 'failed' as const,
          error: String(item.message || ''),
        })),
        ...prev,
      ]);

      const appliedSet = new Set(
        appliedRows.map((item: any) =>
          negativeApplyScope === 'ad_group'
            ? `${String(item.adGroupId || '')}:${String(item.term || '').toLowerCase()}`
            : `${String(item.campaignId || '')}:${String(item.term || '').toLowerCase()}`
        )
      );
      setSearchTerms((prev) =>
        prev.map((row) => {
          const key =
            negativeApplyScope === 'ad_group'
              ? `${String(row.adGroupId || '')}:${String(row.term || '').toLowerCase()}`
              : `${String(row.campaignId || '')}:${String(row.term || '').toLowerCase()}`;
          if (!appliedSet.has(key)) return row;
          return {
            ...row,
            status: 'optimal' as SearchStatus,
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

  return {
    // state
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
    // derived
    googleToken,
    googleCustomerId,
    // memos
    filteredTerms,
    negativeCandidates,
    gscOpportunities,
    estimatedMonthlySavings,
    // handler
    applyNegativeTerms,
  };
}

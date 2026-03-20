"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDateRange, useDateRangeBounds } from '../contexts/DateRangeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  TrendingDown,
  Loader2,
  Save,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useConnections } from '../contexts/ConnectionsContext';
import { loadUnifiedCampaignLayerFromConnections } from '../lib/unified-data/loaders';
import {
  auth,
  getBudgetAutomationSettings,
  getBudgetPlatformAllocations,
  setBudgetAutomationSettings,
  setBudgetPlatformAllocations,
} from '../lib/firebase';

type PlatformId = 'google' | 'meta' | 'tiktok';
type PlatformStatus = 'optimal' | 'overspending' | 'underperforming';

type CampaignBudgetRow = {
  id: string;
  name: string;
  platform: PlatformId;
  status: string;
  spend: number;
  conversionValue: number;
  roas: number;
  budget: number;
};

type PlatformSummary = {
  id: PlatformId;
  name: string;
  currentSpend: number;
  allocatedBudget: number;
  roas: number;
  status: PlatformStatus;
  campaignCount: number;
  conversionValue: number;
  connected: boolean;
};

type TransferPlan = {
  from: PlatformId;
  to: PlatformId;
  amount: number;
  reason: string;
};

const PLATFORM_LABELS: Record<PlatformId, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

const toAmount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sumBy = <T,>(items: T[], pick: (row: T) => number) =>
  items.reduce((acc, row) => acc + pick(row), 0);

export function Budget() {
  const { t, dir, language } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections, dataOwnerUid, isWorkspaceReadOnly } = useConnections();

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [campaignRows, setCampaignRows] = useState<CampaignBudgetRow[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [savedAllocations, setSavedAllocations] = useState<Partial<Record<PlatformId, number>>>({});

  const [smartEnabled, setSmartEnabled] = useState(true);
  const [targetRoas, setTargetRoas] = useState(2.5);
  const [minPlatformSpend, setMinPlatformSpend] = useState(200);
  const [reallocationPercent, setReallocationPercent] = useState(12);

  const periodLabel =
    dateRange === 'today'
      ? t('dashboard.today')
      : dateRange === '7days'
      ? t('dashboard.last7Days')
      : dateRange === '30days'
      ? t('dashboard.last30Days')
      : t('dashboard.customRange');

  const isHebrew = language === 'he';
  const currentWorkspaceUid = dataOwnerUid || auth.currentUser?.uid || null;

  useEffect(() => {
    if (!currentWorkspaceUid) return;
    let cancelled = false;
    Promise.all([
      getBudgetAutomationSettings(currentWorkspaceUid).catch(() => null),
      getBudgetPlatformAllocations(currentWorkspaceUid).catch(() => null),
    ]).then(([automation, allocations]) => {
      if (cancelled) return;
      if (automation) {
        setSmartEnabled(Boolean(automation.enabled));
        setTargetRoas(toAmount(automation.targetRoas) || 2.5);
        setMinPlatformSpend(toAmount(automation.minPlatformSpend) || 200);
        setReallocationPercent(toAmount(automation.reallocationPercent) || 12);
      }
      if (allocations) {
        setSavedAllocations({
          google: toAmount(allocations.google),
          meta: toAmount(allocations.meta),
          tiktok: toAmount(allocations.tiktok),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceUid]);

  useEffect(() => {
    const startIso = bounds.startDate.toISOString().slice(0, 10);
    const endIso = bounds.endDate.toISOString().slice(0, 10);

    let cancelled = false;
    const loadLive = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { campaignRows: unifiedCampaignRows, errors } =
          await loadUnifiedCampaignLayerFromConnections({
            connections,
            startDate: startIso,
            endDate: endIso,
          });

        const allRows: CampaignBudgetRow[] = unifiedCampaignRows
          .map((row: any) => {
            const platformRaw = String(row?.platform || '').toLowerCase();
            const platform: PlatformId | null =
              platformRaw === 'google'
                ? 'google'
                : platformRaw === 'meta'
                ? 'meta'
                : platformRaw === 'tiktok'
                ? 'tiktok'
                : null;
            if (!platform) return null;
            return {
              id: String(row?.campaignId || row?.id || `${platform}-${row?.name || ''}`),
              name: String(row?.name || `${platform} campaign`),
              platform,
              status: String(row?.status || 'Unknown'),
              spend: toAmount(row?.spend),
              conversionValue: toAmount(row?.conversionValue),
              roas: toAmount(row?.roas),
              budget:
                toAmount(row?.dailyBudget) ||
                toAmount(row?.budget) ||
                toAmount(row?.lifetimeBudget),
            };
          })
          .filter((row): row is CampaignBudgetRow => Boolean(row));
        const filtered = allRows.filter(
          (row) =>
            row.spend > 0 ||
            row.conversionValue > 0 ||
            row.budget > 0 ||
            Boolean(row.name)
        );

        if (!cancelled) {
          setCampaignRows(filtered);

          const errorsList = Object.values(errors).filter(Boolean);
          if (filtered.length === 0 && errorsList.length > 0) {
            setLoadError(errorsList[0] || null);
          }

          const derivedAllocated = {
            google: sumBy(filtered.filter((r) => r.platform === 'google'), (r) => r.budget || r.spend * 1.2),
            meta: sumBy(filtered.filter((r) => r.platform === 'meta'), (r) => r.budget || r.spend * 1.2),
            tiktok: sumBy(filtered.filter((r) => r.platform === 'tiktok'), (r) => r.budget || r.spend * 1.2),
          };
          const fallbackTotal = sumBy(filtered, (r) => r.spend) * 1.2;
          const savedTotal = toAmount(savedAllocations.google) + toAmount(savedAllocations.meta) + toAmount(savedAllocations.tiktok);
          if (totalBudget <= 0) {
            setTotalBudget(Math.max(Math.round(savedTotal), Math.round(sumBy(Object.values(derivedAllocated), (x) => x)), Math.round(fallbackTotal), 1));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : isHebrew ? 'שגיאה בטעינת נתוני תקציב חיים' : 'Failed to load live budget data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLive();
    return () => {
      cancelled = true;
    };
  }, [connections, bounds.startDate, bounds.endDate, isHebrew, savedAllocations.google, savedAllocations.meta, savedAllocations.tiktok, totalBudget]);

  const connectedPlatformIds = useMemo(
    () =>
      new Set(
        connections
          .filter((c) => c.status === 'connected' && (c.id === 'google' || c.id === 'meta' || c.id === 'tiktok'))
          .map((c) => c.id as PlatformId)
      ),
    [connections]
  );

  const platformSummaries = useMemo<PlatformSummary[]>(() => {
    const rowsByPlatform: Record<PlatformId, CampaignBudgetRow[]> = {
      google: campaignRows.filter((r) => r.platform === 'google'),
      meta: campaignRows.filter((r) => r.platform === 'meta'),
      tiktok: campaignRows.filter((r) => r.platform === 'tiktok'),
    };

    const computeStatus = (spend: number, allocation: number, roas: number): PlatformStatus => {
      if (allocation > 0 && spend > allocation * 1.05) return 'overspending';
      if (spend >= minPlatformSpend && roas >= targetRoas) return 'optimal';
      return 'underperforming';
    };

    return (['google', 'meta', 'tiktok'] as PlatformId[]).map((platformId) => {
      const rows = rowsByPlatform[platformId];
      const spend = sumBy(rows, (r) => r.spend);
      const conversionValue = sumBy(rows, (r) => r.conversionValue);
      const derivedAllocation = sumBy(rows, (r) => (r.budget > 0 ? r.budget : r.spend * 1.2));
      const allocation = Math.max(0, toAmount(savedAllocations[platformId]) || derivedAllocation);
      const roas = spend > 0 ? conversionValue / spend : 0;
      return {
        id: platformId,
        name: PLATFORM_LABELS[platformId],
        currentSpend: spend,
        allocatedBudget: allocation,
        roas,
        status: computeStatus(spend, allocation, roas),
        campaignCount: rows.length,
        conversionValue,
        connected: connectedPlatformIds.has(platformId),
      };
    });
  }, [campaignRows, savedAllocations, connectedPlatformIds, minPlatformSpend, targetRoas]);

  const totalSpend = sumBy(platformSummaries, (p) => p.currentSpend);
  const remainingBudget = totalBudget - totalSpend;
  const currentAllocations = useMemo(
    () =>
      platformSummaries.reduce(
        (acc, row) => {
          acc[row.id] = row.allocatedBudget;
          return acc;
        },
        {} as Record<PlatformId, number>
      ),
    [platformSummaries]
  );

  const transferPlan = useMemo<TransferPlan | null>(() => {
    if (!smartEnabled) return null;
    const eligible = platformSummaries.filter((p) => p.connected && p.currentSpend >= minPlatformSpend);
    if (eligible.length < 2) return null;
    const loser = [...eligible]
      .filter((p) => p.roas < targetRoas && p.allocatedBudget > 0)
      .sort((a, b) => a.roas - b.roas)[0];
    const winner = [...eligible]
      .filter((p) => p.roas > targetRoas)
      .sort((a, b) => b.roas - a.roas)[0];
    if (!loser || !winner || loser.id === winner.id) return null;
    const maxShift = Math.max(0, loser.allocatedBudget * (reallocationPercent / 100));
    const amount = Math.min(maxShift, Math.max(0, loser.allocatedBudget - loser.currentSpend * 0.8));
    if (amount < 1) return null;
    const reason = isHebrew
      ? `ROAS נמוך ב-${loser.name} לעומת ביצועים חזקים ב-${winner.name}`
      : `Lower ROAS on ${loser.name} compared to stronger performance on ${winner.name}`;
    return { from: loser.id, to: winner.id, amount, reason };
  }, [smartEnabled, platformSummaries, minPlatformSpend, targetRoas, reallocationPercent, isHebrew]);

  const campaignControlPreview = useMemo(() => {
    if (!transferPlan) return [] as Array<{ id: string; name: string; platform: string; currentBudget: number; targetBudget: number }>;
    const fromCampaigns = campaignRows.filter((r) => r.platform === transferPlan.from).slice(0, 4);
    const toCampaigns = campaignRows.filter((r) => r.platform === transferPlan.to).slice(0, 4);
    const fromTotal = Math.max(sumBy(fromCampaigns, (r) => Math.max(r.budget, r.spend, 1)), 1);
    const toTotal = Math.max(sumBy(toCampaigns, (r) => Math.max(r.budget, r.spend, 1)), 1);

    const decreases = fromCampaigns.map((campaign) => {
      const baseline = Math.max(campaign.budget, campaign.spend, 1);
      const weight = baseline / fromTotal;
      const delta = transferPlan.amount * weight;
      return {
        id: campaign.id,
        name: campaign.name,
        platform: PLATFORM_LABELS[campaign.platform],
        currentBudget: baseline,
        targetBudget: Math.max(0, baseline - delta),
      };
    });
    const increases = toCampaigns.map((campaign) => {
      const baseline = Math.max(campaign.budget, campaign.spend, 1);
      const weight = baseline / toTotal;
      const delta = transferPlan.amount * weight;
      return {
        id: campaign.id,
        name: campaign.name,
        platform: PLATFORM_LABELS[campaign.platform],
        currentBudget: baseline,
        targetBudget: baseline + delta,
      };
    });
    return [...decreases, ...increases];
  }, [transferPlan, campaignRows]);

  const formatSigned = (amount: number) => `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;

  const saveAutomationSettings = async () => {
    if (!currentWorkspaceUid || isWorkspaceReadOnly) return;
    await setBudgetAutomationSettings(currentWorkspaceUid, {
      enabled: smartEnabled,
      targetRoas,
      minPlatformSpend,
      reallocationPercent,
    });
    await setBudgetPlatformAllocations(currentWorkspaceUid, currentAllocations);
  };

  const applyTransferPlan = async () => {
    if (!transferPlan) return;
    const base = currentAllocations;
    const next = {
      ...base,
      [transferPlan.from]: Math.max(0, toAmount(base[transferPlan.from]) - transferPlan.amount),
      [transferPlan.to]: Math.max(0, toAmount(base[transferPlan.to]) + transferPlan.amount),
    };
    setApplying(true);
    try {
      setSavedAllocations(next);
      if (currentWorkspaceUid && !isWorkspaceReadOnly) {
        await setBudgetPlatformAllocations(currentWorkspaceUid, next);
        await saveAutomationSettings();
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.budget')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('budget.subtitle')} <span className="font-bold text-indigo-600">({periodLabel})</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('common.loading')}
            </span>
          )}
          <button
            onClick={saveAutomationSettings}
            disabled={isWorkspaceReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {t('budget.settings')}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {loadError}
        </div>
      )}

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('budget.totalBudget')}</h3>
          </div>
          <input
            type="number"
            min={0}
            value={Math.round(totalBudget)}
            onChange={(e) => setTotalBudget(Math.max(0, Number(e.target.value || 0)))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-black text-gray-900"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">{t('budget.monthlyAllocation')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('budget.currentSpend')}</h3>
          </div>
          <p className="text-3xl font-black text-gray-900" dir="ltr">{formatCurrency(totalSpend)}</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3" dir="ltr">
            <div
              className={cn('h-1.5 rounded-full', totalBudget > 0 && totalSpend / totalBudget > 0.9 ? 'bg-red-500' : 'bg-indigo-600')}
              style={{ width: `${totalBudget > 0 ? Math.min((totalSpend / totalBudget) * 100, 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('budget.remaining')}</h3>
          </div>
          <p className="text-3xl font-black text-gray-900" dir="ltr">{formatCurrency(remainingBudget)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('budget.availableAllocation')}</p>
        </div>
      </div>

      {/* Smart Budget Automation (compact) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm">
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-indigo-900">{t('budget.aiOptimization')}</h2>
            <p className="text-xs text-indigo-700 mt-0.5">{t('budget.aiOptimizationDesc')}</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-gray-600">
              {isHebrew ? 'ROAS יעד' : 'Target ROAS'}
              <input
                type="number"
                min={0}
                step={0.1}
                value={targetRoas}
                onChange={(e) => setTargetRoas(Math.max(0, Number(e.target.value || 0)))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              {isHebrew ? 'מינימום הוצאה לפלטפורמה' : 'Min platform spend'}
              <input
                type="number"
                min={0}
                value={minPlatformSpend}
                onChange={(e) => setMinPlatformSpend(Math.max(0, Number(e.target.value || 0)))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              {isHebrew ? '% העברה מקסימלי' : 'Max transfer %'}
              <input
                type="number"
                min={1}
                max={50}
                value={reallocationPercent}
                onChange={(e) => setReallocationPercent(Math.min(50, Math.max(1, Number(e.target.value || 1))))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-end text-xs text-gray-600">
              <span className="inline-flex items-center gap-2 pb-1.5">
                <input
                  type="checkbox"
                  checked={smartEnabled}
                  onChange={(e) => setSmartEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                {isHebrew ? 'הפעל אוטומציה חכמה' : 'Enable smart automation'}
              </span>
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="w-full space-y-1">
              {transferPlan ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {isHebrew ? `הפחתה מ-${PLATFORM_LABELS[transferPlan.from]}` : `Reduce from ${PLATFORM_LABELS[transferPlan.from]}`}
                    </span>
                    <span className="font-bold text-red-600" dir="ltr">{formatSigned(-transferPlan.amount)}</span>
                  </div>
                  <div className="hidden md:block">
                    {dir === 'rtl' ? (
                      <ArrowLeft className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {isHebrew ? `הגדלה ל-${PLATFORM_LABELS[transferPlan.to]}` : `Increase to ${PLATFORM_LABELS[transferPlan.to]}`}
                    </span>
                    <span className="font-bold text-emerald-600" dir="ltr">{formatSigned(transferPlan.amount)}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{transferPlan.reason}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500">
                  {isHebrew
                    ? 'אין כרגע המלצת העברה אוטומטית (או שחסרים מספיק נתונים חיים).'
                    : 'No automatic transfer suggestion right now (or not enough live data).'}
                </p>
              )}
            </div>
            <div className="w-full md:w-auto">
              <button
                onClick={applyTransferPlan}
                disabled={!transferPlan || applying || isWorkspaceReadOnly}
                className="w-full md:w-auto px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors text-xs shadow-sm disabled:opacity-50"
              >
                {applying ? (isHebrew ? 'מיישם...' : 'Applying...') : t('budget.applyTransfer')}
              </button>
            </div>
          </div>

          {campaignControlPreview.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
                {isHebrew ? 'שליטה חכמה ברמת קמפיין (תצוגה לפני החלה)' : 'Smart campaign-level control (pre-apply preview)'}
              </div>
              <div className="max-h-44 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-white text-gray-500">
                    <tr className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>
                      <th className="px-3 py-2">{t('campaigns.campaignName')}</th>
                      <th className="px-3 py-2">{t('campaigns.platform')}</th>
                      <th className="px-3 py-2">{t('budget.currentSpend')}</th>
                      <th className="px-3 py-2">{isHebrew ? 'תקציב יעד' : 'Target budget'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaignControlPreview.map((row) => (
                      <tr key={`preview-${row.id}`} className={cn(dir === 'rtl' ? 'text-right' : 'text-left')}>
                        <td className="px-3 py-2">
                          <div className="max-w-[220px] truncate" title={row.name}>{row.name}</div>
                        </td>
                        <td className="px-3 py-2">{row.platform}</td>
                        <td className="px-3 py-2" dir="ltr">{formatCurrency(row.currentBudget)}</td>
                        <td className="px-3 py-2 font-medium" dir="ltr">{formatCurrency(row.targetBudget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Platform Breakdown (live) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{t('budget.allocationByPlatform')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className={cn('w-full text-sm', dir === 'rtl' ? 'text-right' : 'text-left')}>
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">{t('budget.platform')}</th>
                <th className="px-6 py-4 font-semibold">{t('budget.allocatedBudget')}</th>
                <th className="px-6 py-4 font-semibold">{t('budget.currentSpend')}</th>
                <th className="px-6 py-4 font-semibold">{t('budget.roas')}</th>
                <th className="px-6 py-4 font-semibold">{t('budget.status')}</th>
                <th className={cn('px-6 py-4 font-semibold', dir === 'rtl' ? 'text-left' : 'text-right')}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {platformSummaries.map((platform) => (
                <tr key={platform.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div>{platform.name}</div>
                    <div className="text-[11px] text-gray-500">{platform.campaignCount} {isHebrew ? 'קמפיינים' : 'campaigns'}</div>
                  </td>
                  <td className="px-6 py-4" dir="ltr">{formatCurrency(platform.allocatedBudget)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span dir="ltr">{formatCurrency(platform.currentSpend)}</span>
                      <span className="text-xs text-gray-500" dir="ltr">
                        ({platform.allocatedBudget > 0 ? Math.round((platform.currentSpend / platform.allocatedBudget) * 100) : 0}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600" dir="ltr">{platform.roas.toFixed(2)}x</td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit',
                        platform.status === 'optimal'
                          ? 'bg-emerald-100 text-emerald-700'
                          : platform.status === 'overspending'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {platform.status === 'optimal' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {platform.status === 'overspending' && <AlertCircle className="w-3.5 h-3.5" />}
                      {platform.status === 'underperforming' && <TrendingDown className="w-3.5 h-3.5" />}
                      {platform.status === 'optimal'
                        ? t('budget.statusOptimal')
                        : platform.status === 'overspending'
                        ? t('budget.statusOverspending')
                        : t('budget.statusUnderperforming')}
                    </span>
                  </td>
                  <td className={cn('px-6 py-4', dir === 'rtl' ? 'text-left' : 'text-right')}>
                    <button
                      onClick={() =>
                        setSavedAllocations((prev) => ({
                          ...prev,
                          [platform.id]: Math.max(0, Math.round(platform.currentSpend * 1.15)),
                        }))
                      }
                      className="text-indigo-600 hover:text-indigo-900 font-bold text-sm"
                    >
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

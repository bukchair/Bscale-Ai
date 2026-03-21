"use client";

import React from 'react';
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
import { useBudget, type PlatformId, type PlatformSummary, type TransferPlan, PLATFORM_LABELS, toAmount } from './budget/useBudget';

export function Budget() {
  const { t, dir, language } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { dateRange } = useDateRange();
  const bounds = useDateRangeBounds();
  const { connections, dataOwnerUid, isWorkspaceReadOnly } = useConnections();


  const isHebrew = language === 'he';
  const periodLabel =
    dateRange === 'today'
      ? t('dashboard.today')
      : dateRange === '7days'
      ? t('dashboard.last7Days')
      : dateRange === '30days'
      ? t('dashboard.last30Days')
      : t('dashboard.customRange');

  const {
    loading,
    applying,
    loadError,
    campaignRows,
    totalBudget, setTotalBudget,
    savedAllocations, setSavedAllocations,
    smartEnabled, setSmartEnabled,
    targetRoas, setTargetRoas,
    minPlatformSpend, setMinPlatformSpend,
    reallocationPercent, setReallocationPercent,
    platformSummaries,
    totalSpend,
    remainingBudget,
    currentAllocations,
    transferPlan,
    campaignControlPreview,
    saveAutomationSettings,
    applyTransferPlan,
  } = useBudget({
    connections,
    dataOwnerUid,
    isWorkspaceReadOnly,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    isHebrew,
  });

  const formatSigned = (amount: number) => `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;

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

'use client';

import React from 'react';
import { DollarSign, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CopyText, PlatformRevenueSummary } from './types';
import { SourceTag, InlineTooltip } from './helpers';

interface RevenueCardProps {
  text: CopyText;
  dir: string;
  financialAvailability: {
    revenue: boolean;
    spend: boolean;
    netProfit: boolean;
    roas: boolean;
    metaSpend: boolean;
    metaRevenue: boolean;
  };
  safeTotalRevenue: number;
  safeTotalSpend: number;
  safeNetProfit: number;
  safeRoas: string;
  platformRevenue: PlatformRevenueSummary;
  isMetaConnected: boolean;
  formatCurrency: (v: number) => string;
  onGoOrders: () => void;
}

export function RevenueCard({
  text,
  dir,
  financialAvailability,
  safeTotalRevenue,
  safeTotalSpend,
  safeNetProfit,
  safeRoas,
  platformRevenue,
  isMetaConnected,
  formatCurrency,
  onGoOrders,
}: RevenueCardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">{text.revenueCard}</h2>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            {text.totalRevenue}
            <SourceTag live={financialAvailability.revenue} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
          </span>
          <span className="font-extrabold text-emerald-700">
            {financialAvailability.revenue ? formatCurrency(safeTotalRevenue) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            {text.totalSpend}
            <SourceTag live={financialAvailability.spend} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
          </span>
          <span className="font-bold text-red-600">
            {financialAvailability.spend ? formatCurrency(safeTotalSpend) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            {text.netProfit}
            <SourceTag live={financialAvailability.netProfit} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
          </span>
          <span className="font-bold text-indigo-600">
            {financialAvailability.netProfit ? formatCurrency(safeNetProfit) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            {text.roas}
            <SourceTag live={financialAvailability.roas} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
          </span>
          <span className="font-black text-gray-900 dark:text-white">
            {financialAvailability.roas ? `${safeRoas}x` : '—'}
          </span>
        </div>
        {isMetaConnected && (
          <>
            <div className="my-1 border-t border-gray-100" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.metaSpend}
                <SourceTag live={financialAvailability.metaSpend} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </span>
              <span className="font-bold text-red-600">
                {financialAvailability.metaSpend ? formatCurrency(platformRevenue.meta.spend) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 inline-flex items-center gap-1.5">
                {text.metaRevenue}
                <InlineTooltip message={text.metaRevenueTooltip} dir={dir} />
                <SourceTag live={financialAvailability.metaRevenue} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </span>
              <span className="font-bold text-emerald-700">
                {financialAvailability.metaRevenue
                  ? formatCurrency(platformRevenue.meta.attributedRevenue)
                  : '—'}
              </span>
            </div>
          </>
        )}
        {!financialAvailability.revenue && !financialAvailability.spend && (
          <p className="text-xs text-gray-500">{text.noFinanceData}</p>
        )}
      </div>

      <button
        onClick={onGoOrders}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
      >
        {text.goOrders}
        <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
      </button>
    </div>
  );
}

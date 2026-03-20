'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export const DemoTag = ({ show }: { show: boolean }) =>
  show ? (
    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      Demo data
    </span>
  ) : null;

export const SourceTag = ({ live, sourceLive, sourceMissing }: { live: boolean; sourceLive: string; sourceMissing: string }) => (
  <span
    className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
      live
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : 'text-gray-600 bg-gray-100 border-gray-200'
    )}
  >
    {live ? sourceLive : sourceMissing}
  </span>
);

export const InlineTooltip = ({ message, dir }: { message: string; dir: string }) => (
  <span className="relative inline-flex group">
    <button
      type="button"
      aria-label={message}
      title={message}
      className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute top-full mt-1 z-20 hidden w-64 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] leading-relaxed text-gray-700 shadow-lg dark:border-white/10 dark:bg-[#111] dark:text-gray-200 group-hover:block group-focus-within:block',
        dir === 'rtl' ? 'left-0' : 'right-0'
      )}
    >
      {message}
    </span>
  </span>
);

export const orderStatusBadgeClass = (status: string) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'processing') return 'bg-sky-100 text-sky-700';
  if (normalized === 'pending' || normalized === 'on-hold') return 'bg-amber-100 text-amber-700';
  if (normalized === 'cancelled' || normalized === 'refunded' || normalized === 'failed') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-gray-100 text-gray-700';
};

export const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

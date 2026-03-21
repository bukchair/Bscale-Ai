'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { CopyText, Ga4TopPage } from './types';
import { DemoTag, SourceTag } from './helpers';

interface GA4CardProps {
  text: CopyText;
  isHebrew: boolean;
  isGa4UsingDemo: boolean;
  hasGa4Data: boolean;
  ga4Availability: { activeNow: boolean; totalUsers: boolean };
  ga4LiveAvailability: { activeNow: boolean; totalUsers: boolean };
  safeGa4Stats: { activeNow: number; totalUsers: number };
  ga4Users24h: number | null;
  ga4TopPages: Ga4TopPage[];
  isGa4TopPagesDemo: boolean;
}

export function GA4Card({
  text,
  isHebrew,
  isGa4UsingDemo,
  hasGa4Data,
  ga4Availability,
  ga4LiveAvailability,
  safeGa4Stats,
  ga4Users24h,
  ga4TopPages,
  isGa4TopPagesDemo,
}: GA4CardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white tracking-tight">{text.ga4Card}</h2>
            <p className="text-[11px] font-semibold text-indigo-600">{text.ga4LiveSync}</p>
          </div>
        </div>
        <DemoTag show={isGa4UsingDemo} />
      </div>

      {hasGa4Data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <p className="text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1.5">
                {text.activeNow}
                <SourceTag live={ga4LiveAvailability.activeNow} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-3xl font-black text-blue-600 mt-1">
                {ga4Availability.activeNow ? safeGa4Stats.activeNow : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
              <p className="text-[11px] font-semibold text-indigo-700 inline-flex items-center gap-1.5">
                {text.totalUsers}
                <SourceTag live={!isGa4TopPagesDemo} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-3xl font-black text-indigo-600 mt-1">
                {ga4Users24h !== null
                  ? ga4Users24h.toLocaleString()
                  : ga4Availability.totalUsers
                    ? safeGa4Stats.totalUsers.toLocaleString()
                    : '—'}
              </p>
            </div>
          </div>

          {ga4TopPages.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/5 p-3 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 inline-flex items-center gap-1.5">
                  {text.topPagesLabel}
                  <SourceTag live={!isGa4TopPagesDemo} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
                </p>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{isHebrew ? 'גולשים פעילים' : 'active users'}</span>
              </div>
              {ga4TopPages.slice(0, 7).map((page, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
                    <span className="text-gray-400 dark:text-gray-500 me-1">{i + 1}.</span>
                    {page.title || page.path}
                  </p>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
                    {page.views > 0 ? page.views.toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            {text.ga4Desc}
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-500">
          {text.noGa4}
        </p>
      )}
    </div>
  );
}

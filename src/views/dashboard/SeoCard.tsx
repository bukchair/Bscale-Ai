'use client';

import React from 'react';
import { Search, ArrowRight, Store, Globe } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CopyText } from './types';
import { DemoTag, SourceTag } from './helpers';

interface SeoCardProps {
  text: CopyText;
  dir: string;
  isGscUsingDemo: boolean;
  seoAvailability: {
    siteScore: boolean;
    searchConsoleScore: boolean;
    clicks: boolean;
    impressions: boolean;
    ctr: boolean;
    avgPosition: boolean;
  };
  seoLiveAvailability: {
    siteScore: boolean;
    searchConsoleScore: boolean;
    clicks: boolean;
    impressions: boolean;
    ctr: boolean;
    avgPosition: boolean;
  };
  siteSeoScore: number;
  searchConsoleSeoScore: number;
  safeGscStats: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    ctr: number;
  };
  onGoSeo: () => void;
}

export function SeoCard({
  text,
  dir,
  isGscUsingDemo,
  seoAvailability,
  seoLiveAvailability,
  siteSeoScore,
  searchConsoleSeoScore,
  safeGscStats,
  onGoSeo,
}: SeoCardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
            <Search className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">{text.seoCard}</h2>
        </div>
        <DemoTag show={isGscUsingDemo} />
      </div>

      {seoAvailability.siteScore || seoAvailability.searchConsoleScore || seoAvailability.clicks ? (
        <>
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 inline-flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" /> {text.siteSeo}
                  <SourceTag live={seoLiveAvailability.siteScore} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
                </span>
                <span className="font-black text-gray-900">
                  {seoAvailability.siteScore ? `${siteSeoScore}/100` : '—'}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${seoAvailability.siteScore ? Math.min(siteSeoScore, 100) : 0}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 inline-flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {text.scSeo}
                  <SourceTag live={seoLiveAvailability.searchConsoleScore} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
                </span>
                <span className="font-black text-gray-900">
                  {seoAvailability.searchConsoleScore ? `${searchConsoleSeoScore}/100` : '—'}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${seoAvailability.searchConsoleScore ? Math.min(searchConsoleSeoScore, 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500 inline-flex items-center gap-1.5">
                {text.clicks}
                <SourceTag live={seoLiveAvailability.clicks} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="font-bold text-gray-900">
                {seoAvailability.clicks ? safeGscStats.clicks.toLocaleString() : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500 inline-flex items-center gap-1.5">
                {text.impressions}
                <SourceTag live={seoLiveAvailability.impressions} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="font-bold text-gray-900">
                {seoAvailability.impressions ? safeGscStats.impressions.toLocaleString() : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500 inline-flex items-center gap-1.5">
                {text.ctr}
                <SourceTag live={seoLiveAvailability.ctr} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="font-bold text-gray-900">
                {seoAvailability.ctr ? `${safeGscStats.ctr.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
              <p className="text-gray-500 inline-flex items-center gap-1.5">
                {text.avgPosition}
                <SourceTag live={seoLiveAvailability.avgPosition} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="font-bold text-gray-900">
                {seoAvailability.avgPosition ? `#${safeGscStats.avgPosition.toFixed(1)}` : '—'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-500">{text.noSeo}</p>
      )}

      <button
        onClick={onGoSeo}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
      >
        {text.goSeo}
        <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
      </button>
    </div>
  );
}

'use client';

import React from 'react';
import { Sparkles, ArrowRight, Activity, Target } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CopyText } from './types';

interface RecommendationsCardProps {
  text: CopyText;
  dir: string;
  optimizationRecommendations: string[];
  hasAnyOptimizationInput: boolean;
  onGoAiRecs: () => void;
  onGoCampaigns: () => void;
}

export function RecommendationsCard({
  text,
  dir,
  optimizationRecommendations,
  hasAnyOptimizationInput,
  onGoAiRecs,
  onGoCampaigns,
}: RecommendationsCardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="font-bold text-gray-900 dark:text-white">{text.optimizationCard}</h2>
      </div>

      <div className="space-y-2.5">
        {optimizationRecommendations.length > 0 ? (
          optimizationRecommendations.map((rec, idx) => (
            <div key={idx} className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
              <div className="flex items-start gap-2">
                <Activity className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-800 leading-relaxed">{rec}</p>
              </div>
            </div>
          ))
        ) : hasAnyOptimizationInput ? (
          <p className="text-xs text-gray-500">{text.noFreshRecs}</p>
        ) : (
          <p className="text-xs text-gray-500">{text.noRecsData}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onGoAiRecs}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
        >
          {text.aiRecs}
          <ArrowRight className={cn('w-3.5 h-3.5', dir === 'rtl' ? 'rotate-180' : '')} />
        </button>
        <button
          onClick={onGoCampaigns}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl py-2"
        >
          {text.campaignOptimization}
          <Target className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

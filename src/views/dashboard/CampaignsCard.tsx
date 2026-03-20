'use client';

import React from 'react';
import { Megaphone, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CopyText, CampaignSummary } from './types';
import { DemoTag, SourceTag } from './helpers';

interface CampaignsCardProps {
  text: CopyText;
  dir: string;
  isCampaignsUsingDemo: boolean;
  campaignSummary: CampaignSummary;
  campaignAvailability: {
    totalCampaigns: boolean;
    activeCampaigns: boolean;
    spend: boolean;
    roas: boolean;
  };
  campaignLiveAvailability: {
    totalCampaigns: boolean;
    activeCampaigns: boolean;
    spend: boolean;
    roas: boolean;
  };
  hasCampaignData: boolean;
  formatCurrency: (v: number) => string;
  onGoCampaigns: () => void;
}

export function CampaignsCard({
  text,
  dir,
  isCampaignsUsingDemo,
  campaignSummary,
  campaignAvailability,
  campaignLiveAvailability,
  hasCampaignData,
  formatCurrency,
  onGoCampaigns,
}: CampaignsCardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">{text.campaignsCard}</h2>
        </div>
        <DemoTag show={isCampaignsUsingDemo} />
      </div>

      {hasCampaignData || campaignAvailability.spend || campaignAvailability.roas ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                {text.totalCampaigns}
                <SourceTag live={campaignLiveAvailability.totalCampaigns} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-xl font-black text-gray-900">
                {campaignAvailability.totalCampaigns ? campaignSummary.totalCampaigns : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                {text.activeCampaigns}
                <SourceTag live={campaignLiveAvailability.activeCampaigns} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-xl font-black text-emerald-600">
                {campaignAvailability.activeCampaigns ? campaignSummary.activeCampaigns : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                {text.totalCampaignSpend}
                <SourceTag live={campaignLiveAvailability.spend} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-xl font-black text-red-600">
                {campaignAvailability.spend ? formatCurrency(campaignSummary.totalSpend) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-gray-500 text-xs inline-flex items-center gap-1.5">
                {text.roasRos}
                <SourceTag live={campaignLiveAvailability.roas} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
              </p>
              <p className="text-xl font-black text-indigo-600">
                {campaignAvailability.roas ? `${campaignSummary.avgRoas.toFixed(2)}x` : '—'}
              </p>
            </div>
          </div>

          {campaignSummary.platformBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {campaignSummary.platformBreakdown.map((row) => (
                <span
                  key={row.platform}
                  className="text-[11px] font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full"
                >
                  {row.platform}: {row.count}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-500">{text.noCampaigns}</p>
      )}

      <button
        onClick={onGoCampaigns}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
      >
        {text.goCampaigns}
        <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
      </button>
    </div>
  );
}

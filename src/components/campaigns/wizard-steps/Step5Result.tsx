import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { OneClickPlatform, OneClickResult, PlatformResult } from '../../../lib/one-click/types';
import { PLATFORM_ICONS } from './wizard-types';

const PLATFORM_OPEN_URLS: Partial<Record<OneClickPlatform, string>> = {
  Google: 'https://ads.google.com',
  Meta: 'https://business.facebook.com',
  TikTok: 'https://ads.tiktok.com',
};

interface Props {
  launching: boolean;
  result: OneClickResult | null;
  launchError: string | null;
  selectedPlatforms: OneClickPlatform[];
  tx: {
    step5Title: string;
    launching: string;
    success: string;
    partial: string;
    failed: string;
    openPlatform: string;
  };
}

export function Step5Result({ launching, result, launchError, selectedPlatforms, tx }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900">{tx.step5Title}</h3>

      {launching && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
          <p className="text-sm text-gray-600">{tx.launching}</p>
        </div>
      )}

      {launchError && !launching && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{launchError}
        </div>
      )}

      {result && !launching && (
        <div className="space-y-4">
          {/* Overall status badge */}
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold',
            result.status === 'SUCCESS'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : result.status === 'PARTIAL'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          )}>
            {result.status === 'SUCCESS'
              ? <CheckCircle2 className="w-5 h-5" />
              : <AlertCircle className="w-5 h-5" />}
            {result.status === 'SUCCESS' ? tx.success : result.status === 'PARTIAL' ? tx.partial : tx.failed}
          </div>

          {/* Per-platform result */}
          {selectedPlatforms.map((platform) => {
            const pr: PlatformResult | undefined = (result.results as Record<string, PlatformResult>)[platform];
            if (!pr) return null;
            return (
              <div key={platform} className={cn(
                'rounded-xl border p-4',
                pr.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {pr.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-bold text-gray-800">{PLATFORM_ICONS[platform]} {platform}</span>
                    {pr.ok && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        {pr.campaignStatus || 'Draft'}
                      </span>
                    )}
                  </div>
                  {pr.ok && PLATFORM_OPEN_URLS[platform] && (
                    <a
                      href={PLATFORM_OPEN_URLS[platform]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {tx.openPlatform}
                    </a>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-600">{pr.message}</p>
                {pr.campaignId && (
                  <p className="mt-0.5 text-[10px] text-gray-400 font-mono">ID: {pr.campaignId}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

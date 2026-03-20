import { AlertCircle, Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { OneClickPlatform, OneClickStrategy } from '../../../lib/one-click/types';
import { PLATFORM_COLORS, PLATFORM_ICONS } from './wizard-types';

interface Props {
  generatingStrategy: boolean;
  previewStrategy: OneClickStrategy | null;
  previewError: string | null;
  selectedPlatforms: OneClickPlatform[];
  activateImmediately: boolean;
  setActivateImmediately: (v: boolean) => void;
  onRegenerate: () => void;
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
  isHebrew: boolean;
  tx: {
    step4Title: string;
    generatingAi: string;
    campaignName: string;
    audiences: string;
    adCopyPerPlatform: string;
    title2: string;
    body: string;
    regenerate: string;
    launchConfirm: string;
  };
}

export function Step4Preview({
  generatingStrategy,
  previewStrategy,
  previewError,
  selectedPlatforms,
  activateImmediately,
  setActivateImmediately,
  onRegenerate,
  copiedField,
  onCopy,
  isHebrew,
  tx,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{tx.step4Title}</h3>
        {previewStrategy && !generatingStrategy && (
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
          >
            <RefreshCw className="w-3 h-3" />{tx.regenerate}
          </button>
        )}
      </div>

      {generatingStrategy && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-violet-600" />
          </div>
          <p className="text-sm text-gray-600">{tx.generatingAi}</p>
        </div>
      )}

      {previewError && !generatingStrategy && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {previewError}
        </div>
      )}

      {previewStrategy && !generatingStrategy && (
        <div className="space-y-4">
          {/* Campaign name */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-semibold text-violet-800 mb-1">{tx.campaignName}</p>
            <p className="text-sm font-bold text-violet-900">{previewStrategy.campaignName}</p>
            {previewStrategy.shortTitle && (
              <p className="text-xs text-violet-600 mt-0.5">{previewStrategy.shortTitle}</p>
            )}
          </div>

          {/* Audiences */}
          {previewStrategy.audiences.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">{tx.audiences}</p>
              <div className="flex flex-wrap gap-1.5">
                {previewStrategy.audiences.map((aud, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{aud}</span>
                ))}
              </div>
            </div>
          )}

          {/* Ad copy per platform */}
          {selectedPlatforms.filter((p) => previewStrategy.platformCopy[p]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">{tx.adCopyPerPlatform}</p>
              <div className="space-y-3">
                {selectedPlatforms.map((platform) => {
                  const copy = previewStrategy.platformCopy[platform];
                  if (!copy) return null;
                  return (
                    <div key={platform} className={cn('rounded-xl border p-3', PLATFORM_COLORS[platform])}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold">{PLATFORM_ICONS[platform]} {platform}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-semibold shrink-0 mt-0.5 opacity-70">{tx.title2}</span>
                          <span className="text-xs font-medium flex-1">{copy.title}</span>
                          <button
                            onClick={() => onCopy(copy.title, `${platform}-title`)}
                            className="shrink-0 opacity-50 hover:opacity-100"
                          >
                            {copiedField === `${platform}-title` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-semibold shrink-0 mt-0.5 opacity-70">{tx.body}</span>
                          <span className="text-xs flex-1">{copy.description}</span>
                          <button
                            onClick={() => onCopy(copy.description, `${platform}-desc`)}
                            className="shrink-0 opacity-50 hover:opacity-100"
                          >
                            {copiedField === `${platform}-desc` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activate immediately toggle */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-800">
                {isHebrew ? 'הפעל מיד לאחר יצירה' : 'Activate immediately after creation'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isHebrew
                  ? activateImmediately
                    ? 'המודעות יתחילו לרוץ מיד — ללא כניסה לפלטפורמה'
                    : 'המודעות ייצרו כטיוטה — תצטרך להפעיל ידנית'
                  : activateImmediately
                  ? 'Ads will go live immediately — no need to visit each platform'
                  : 'Ads created as drafts — activate manually on each platform'}
              </p>
            </div>
            <button
              onClick={() => setActivateImmediately(!activateImmediately)}
              className={cn(
                'relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none',
                activateImmediately ? 'bg-violet-600' : 'bg-gray-300'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                activateImmediately ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {/* Launch confirmation notice */}
          {!activateImmediately && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {tx.launchConfirm}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

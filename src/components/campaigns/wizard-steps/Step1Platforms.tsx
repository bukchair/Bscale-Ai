import { AlertCircle, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { OneClickPlatform } from '../../../lib/one-click/types';
import { PLATFORM_COLORS, PLATFORM_ICONS, PLATFORM_SELECTED } from './wizard-types';

interface Props {
  connectedPlatforms: OneClickPlatform[];
  selectedPlatforms: OneClickPlatform[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<OneClickPlatform[]>>;
  tx: {
    step1Title: string;
    step1Hint: string;
    noPlatforms: string;
    platformConnected: string;
    platformDisconnected: string;
  };
}

export function Step1Platforms({ connectedPlatforms, selectedPlatforms, setSelectedPlatforms, tx }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">{tx.step1Title}</h3>
        <p className="text-xs text-gray-500">{tx.step1Hint}</p>
      </div>
      {connectedPlatforms.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {tx.noPlatforms}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['Google', 'Meta', 'TikTok'] as OneClickPlatform[]).map((platform) => {
            const connected = connectedPlatforms.includes(platform);
            const selected = selectedPlatforms.includes(platform);
            return (
              <button
                key={platform}
                disabled={!connected}
                onClick={() => {
                  if (!connected) return;
                  setSelectedPlatforms((prev) =>
                    prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
                  );
                }}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus:outline-none',
                  !connected
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                    : selected
                    ? PLATFORM_SELECTED[platform]
                    : `${PLATFORM_COLORS[platform]} hover:opacity-90 cursor-pointer`
                )}
              >
                <span className="text-2xl">{PLATFORM_ICONS[platform]}</span>
                <span>{platform}</span>
                <span className={cn('text-[10px] font-normal', connected ? 'text-green-600' : 'text-gray-400')}>
                  {connected ? `✓ ${tx.platformConnected}` : tx.platformDisconnected}
                </span>
                {selected && connected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

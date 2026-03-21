import React from 'react';

export type WizardResumeBannerProps = {
  isHebrew: boolean;
  wizardCompletedCount: number;
  wizardTotalCount: number;
  wizardLastSavedLabel: string | null;
  wizardProgressPercent: number;
  onResume: () => void;
  onClear: () => void;
};

export function WizardResumeBanner({
  isHebrew,
  wizardCompletedCount,
  wizardTotalCount,
  wizardLastSavedLabel,
  wizardProgressPercent,
  onResume,
  onClear,
}: WizardResumeBannerProps) {
  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/70 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-indigo-900">
            {isHebrew ? 'אשף החיבורים מוכן להמשך' : 'Connections wizard ready to continue'}
          </p>
          <p className="text-xs text-indigo-700 mt-1">
            {isHebrew
              ? `הושלמו ${wizardCompletedCount} מתוך ${wizardTotalCount} חיבורים. אפשר לחזור בכל רגע ולהמשיך מאותה נקודה.`
              : `${wizardCompletedCount} of ${wizardTotalCount} connections completed. Return anytime and continue from the same point.`}
          </p>
          {wizardLastSavedLabel && (
            <p className="text-[11px] text-indigo-600 mt-1">
              {isHebrew ? `עודכן לאחרונה: ${wizardLastSavedLabel}` : `Last updated: ${wizardLastSavedLabel}`}
            </p>
          )}
          <div className="mt-3 h-2 w-full max-w-md rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, wizardProgressPercent))}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onResume} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-colors">
            {isHebrew ? 'המשך הגדרות אשף' : 'Continue wizard setup'}
          </button>
          <button onClick={onClear} className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-white text-xs sm:text-sm font-semibold hover:bg-indigo-50 transition-colors">
            {isHebrew ? 'איפוס זיכרון אשף' : 'Reset wizard memory'}
          </button>
        </div>
      </div>
    </div>
  );
}

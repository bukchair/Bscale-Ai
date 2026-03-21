import React from 'react';
import { Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PlatformName, PlatformCopyDraft } from './types';

export type CampaignPlatformCopyProps = {
  isHebrew: boolean;
  draftPlatforms: string[];
  selectedCopyPlatform: string;
  platformCopyDrafts: Partial<Record<PlatformName, PlatformCopyDraft>>;
  text: Record<string, string>;
  getPlatformTitleLimit: (platform: PlatformName) => number;
  getPlatformDescriptionLimit: (platform: PlatformName) => number;
  setSelectedCopyPlatform: React.Dispatch<React.SetStateAction<PlatformName>>;
  setPlatformCopyDrafts: React.Dispatch<React.SetStateAction<Partial<Record<PlatformName, PlatformCopyDraft>>>>;
  applyPlatformCopyToFields: (platform: PlatformName) => void;
};

export function CampaignPlatformCopy({
  isHebrew, draftPlatforms, selectedCopyPlatform, platformCopyDrafts, text,
  getPlatformTitleLimit, getPlatformDescriptionLimit,
  setSelectedCopyPlatform, setPlatformCopyDrafts, applyPlatformCopyToFields,
}: CampaignPlatformCopyProps) {
  if (draftPlatforms.length === 0) return null;

  const platform = selectedCopyPlatform;
  const draft = platformCopyDrafts[platform as PlatformName];
  const titleLimit = getPlatformTitleLimit(platform as PlatformName);
  const descriptionLimit = getPlatformDescriptionLimit(platform as PlatformName);

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/50 p-4">
      <h4 className="text-sm font-bold text-violet-900 mb-1">{text.platformCopyTitle}</h4>
      <p className="text-xs text-violet-700 mb-3">{text.platformCopySubtitle}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {draftPlatforms.map((p) => {
          const selected = selectedCopyPlatform === p;
          const titleLength = (platformCopyDrafts[p as PlatformName]?.title || '').trim().length;
          const descriptionLength = (platformCopyDrafts[p as PlatformName]?.description || '').trim().length;
          return (
            <button
              key={`platform-copy-tab-${p}`}
              type="button"
              onClick={() => setSelectedCopyPlatform(p as PlatformName)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                selected
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
              )}
            >
              {p}
              <span className={cn('text-[10px]', selected ? 'text-violet-100' : 'text-violet-500')}>
                {titleLength}/{descriptionLength}
              </span>
            </button>
          );
        })}
      </div>
      {draft && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="rounded-lg border border-violet-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-violet-900">{platform}</p>
              <button
                type="button"
                onClick={() => applyPlatformCopyToFields(platform as PlatformName)}
                className="inline-flex items-center rounded-md border border-violet-300 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
              >
                {text.applyPlatformCopy}
              </button>
            </div>
            <label className="text-[11px] font-semibold text-gray-600">
              {isHebrew ? 'כותרת' : 'Title'} · {draft.title.trim().length}/{titleLimit}
            </label>
            <input
              value={draft.title}
              onChange={(e) =>
                setPlatformCopyDrafts((prev) => ({
                  ...prev,
                  [platform]: {
                    ...(prev[platform as PlatformName] || { title: '', description: '' }),
                    title: e.target.value,
                  },
                }))
              }
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs mb-2"
              placeholder={isHebrew ? 'כותרת מותאמת פלטפורמה' : 'Platform title'}
            />
            <label className="text-[11px] font-semibold text-gray-600">
              {isHebrew ? 'טקסט מודעה' : 'Ad text'} · {draft.description.trim().length}/{descriptionLimit}
            </label>
            <textarea
              value={draft.description}
              onChange={(e) =>
                setPlatformCopyDrafts((prev) => ({
                  ...prev,
                  [platform]: {
                    ...(prev[platform as PlatformName] || { title: '', description: '' }),
                    description: e.target.value,
                  },
                }))
              }
              rows={3}
              className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs"
              placeholder={isHebrew ? 'תיאור מותאם פלטפורמה' : 'Platform description'}
            />
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <p className="text-[11px] font-bold text-violet-900 inline-flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5" />
              {isHebrew ? 'תצוגה מהירה של הטיוטה' : 'Quick draft preview'}
            </p>
            <div className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1.5">
              <p className="text-[12px] font-extrabold text-gray-900">
                {draft.title.trim() || (isHebrew ? 'כותרת מודעה' : 'Ad headline')}
              </p>
              <p className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                {draft.description.trim() || text.previewNoText}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Plug, CheckCircle2, RotateCcw, Loader2, Settings2 } from 'lucide-react';
import type { Connection } from '../../contexts/ConnectionsContext';

export type IntegrationsHeaderProps = {
  connections: Connection[];
  language: string;
  isHebrew: boolean;
  connectedCount: number;
  wizardResumeAvailable: boolean;
  reinstallingGoogleAndMeta: boolean;
  reinstallingManagedPlatform: string | null;
  t: (key: string) => string;
  onOpenWizard: () => void;
  onTestAll: () => void;
  onResetAll: () => void;
  onReinstallGoogleAndMeta: () => void;
};

export function IntegrationsHeader({
  connections,
  language,
  isHebrew,
  connectedCount,
  wizardResumeAvailable,
  reinstallingGoogleAndMeta,
  reinstallingManagedPlatform,
  t,
  onOpenWizard,
  onTestAll,
  onResetAll,
  onReinstallGoogleAndMeta,
}: IntegrationsHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white shadow-xl mx-auto max-w-7xl mb-8">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-80" />
      <div className="relative px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <Plug className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{t('integrations.title')}</h1>
              <p className="text-indigo-100 text-sm sm:text-base mt-1 font-medium max-w-xl">{t('integrations.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/20">
              <span className="text-2xl font-black">{connectedCount}</span>
              <span className="text-indigo-100 text-sm font-medium">
                / {connections.length} {language === 'he' ? 'מחוברים' : 'connected'}
              </span>
            </div>
            <button
              onClick={onOpenWizard}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-sm hover:bg-white/30 transition-all"
            >
              <Settings2 className="w-4 h-4" />
              {wizardResumeAvailable
                ? (isHebrew ? 'חזרה מהירה לאשף' : 'Quick return to wizard')
                : (isHebrew ? 'שאלון התחברות לנכסים' : 'Assets connection wizard')}
            </button>
            <button
              onClick={onTestAll}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('integrations.testAll')}
            </button>
            <button
              onClick={onResetAll}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-sm hover:bg-white/30 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              {t('integrations.resetAll')}
            </button>
            <button
              onClick={onReinstallGoogleAndMeta}
              disabled={reinstallingGoogleAndMeta || reinstallingManagedPlatform !== null}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-sm hover:bg-amber-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {reinstallingGoogleAndMeta ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              {isHebrew ? 'התקנה מחדש Google + Meta' : 'Re-install Google + Meta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

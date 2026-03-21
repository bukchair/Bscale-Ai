'use client';

import React from 'react';
import { Settings2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Connection } from '../../contexts/ConnectionsContext';
import { TabId, RenderIntegrationSettings } from './types';

type OverviewTabProps = {
  googleConnections: Connection[];
  metaConnections: Connection[];
  tiktokConnections: Connection[];
  ecommerceConnections: Connection[];
  aiConnections: Connection[];
  aiConnectedCount: number;
  isAdmin: boolean;
  language: string;
  expandedAiConnection: Connection | null;
  t: (key: string) => string;
  setActiveTab: (tab: TabId) => void;
  handleExpand: (integration: Connection) => void;
  handleMigrateAi: () => void;
  renderIntegrationSettings: RenderIntegrationSettings;
};

export function OverviewTab({
  googleConnections,
  metaConnections,
  tiktokConnections,
  ecommerceConnections,
  aiConnections,
  aiConnectedCount,
  isAdmin,
  language,
  expandedAiConnection,
  t,
  setActiveTab,
  handleExpand,
  handleMigrateAi,
  renderIntegrationSettings,
}: OverviewTabProps) {
  return (
    <>
      <section className="rounded-3xl border border-gray-200/80 bg-white/80 p-4 sm:p-5 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-4">{t('integrations.overviewTitle')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...googleConnections, ...metaConnections, ...tiktokConnections, ...ecommerceConnections].map((connection) => {
            const isConnected = connection.status === 'connected';
            const isError = connection.status === 'error';
            const isConnecting = connection.status === 'connecting';
            const targetTab: TabId = connection.category === 'Google' ? 'google'
              : connection.id === 'meta' ? 'meta'
              : connection.id === 'tiktok' ? 'tiktok'
              : 'more';
            return (
              <button
                key={`overview-card-${connection.id}`}
                onClick={() => setActiveTab(targetTab)}
                className="rounded-2xl border border-gray-200 bg-white p-3 text-start hover:border-indigo-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    isConnected ? 'bg-emerald-500' : isError ? 'bg-red-500' : isConnecting ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                  )} />
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded',
                    isConnected ? 'text-emerald-700 bg-emerald-50' : isError ? 'text-red-700 bg-red-50' : isConnecting ? 'text-blue-700 bg-blue-50' : 'text-gray-500 bg-gray-50'
                  )}>
                    {isConnected ? t('integrations.connected') : isError ? t('integrations.errorStatus') : isConnecting ? t('integrations.connecting') : t('integrations.disconnected')}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{t(connection.name)}</p>
              </button>
            );
          })}
        </div>
      </section>

      {aiConnections.length > 0 && (
        <section className="rounded-3xl border border-violet-200/80 bg-gradient-to-b from-violet-50/70 to-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">{t('integrations.aiEngine')}</h2>
                <p className="text-xs text-gray-500 font-medium">{t('integrations.sharedForAllUsers')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">
                {aiConnectedCount}/{aiConnections.length} {language === 'he' ? 'מחוברים' : 'connected'}
              </span>
              {isAdmin && (
                <button
                  onClick={handleMigrateAi}
                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'he' ? 'סנכרון AI לכל המשתמשים' : 'Sync AI for all users'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {aiConnections.map((connection) => {
              const isConnected = connection.status === 'connected';
              const isError = connection.status === 'error';
              const isConnecting = connection.status === 'connecting';
              const aiIconBg = connection.id === 'gemini' ? 'from-blue-500 to-cyan-500'
                : connection.id === 'openai' ? 'from-gray-700 to-gray-900'
                : 'from-orange-400 to-orange-600';
              const aiIconLabel = connection.id === 'gemini' ? 'G' : connection.id === 'openai' ? 'AI' : 'C';
              return (
                <div
                  key={`overview-ai-${connection.id}`}
                  className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center gap-3"
                >
                  <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow', aiIconBg)}>
                    {aiIconLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{t(connection.name)}</p>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-bold mt-0.5',
                      isConnected ? 'text-emerald-600' : isError ? 'text-red-600' : isConnecting ? 'text-blue-600' : 'text-gray-400'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-emerald-500' : isError ? 'bg-red-500' : isConnecting ? 'bg-blue-500 animate-pulse' : 'bg-gray-300')} />
                      {isConnected ? t('integrations.connected') : isError ? t('integrations.errorStatus') : isConnecting ? t('integrations.connecting') : t('integrations.disconnected')}
                    </span>
                  </div>
                  <button onClick={() => handleExpand(connection)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          {expandedAiConnection && (
            <div className="mt-2 rounded-2xl border border-violet-200 bg-white p-4 sm:p-5">
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t(expandedAiConnection.description)}</p>
              {renderIntegrationSettings(expandedAiConnection)}
            </div>
          )}
        </section>
      )}
    </>
  );
}

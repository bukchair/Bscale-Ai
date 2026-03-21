import React from 'react';
import { Plug, CheckCircle2, Loader2, AlertCircle, HelpCircle, Settings2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import type { Connection } from '../../contexts/ConnectionsContext';
import { INTEGRATION_ICON_MAP, getIntegrationBrand, getActiveAccountSummary } from './integrationUtils';
import type { WizardPlatform, WIZARD_FIELDS } from './wizardTypes';

export type ConnectionCardProps = {
  integration: Connection;
  expandedId: string | null;
  isHebrew: boolean;
  t: (key: string) => string;
  supportsWizard: boolean;
  onExpand: (integration: Connection) => void;
  onOpenWizard: (platform: WizardPlatform) => void;
  renderSettings: (integration: Connection) => React.ReactNode;
};

export function ConnectionCard({
  integration,
  expandedId,
  isHebrew,
  t,
  supportsWizard,
  onExpand,
  onOpenWizard,
  renderSettings,
}: ConnectionCardProps) {
  const isConnected = integration.status === 'connected';
  const isConnecting = integration.status === 'connecting';
  const hasError = integration.status === 'error';
  const Icon = INTEGRATION_ICON_MAP[integration.id] || Plug;
  const isExpanded = expandedId === integration.id;
  const brand = getIntegrationBrand(integration.id);
  const activeAccountSummary = getActiveAccountSummary(integration);

  return (
    <motion.div
      layout
      key={integration.id}
      className={cn(
        'bg-white rounded-2xl border-2 transition-all duration-300 flex flex-col overflow-hidden group relative shadow-sm hover:shadow-xl',
        isConnected ? 'border-emerald-200 shadow-emerald-100/50' :
        hasError    ? 'border-red-200 shadow-red-100/50' : 'border-gray-200/80 hover:border-indigo-200',
        isExpanded && 'ring-2 ring-indigo-400 ring-offset-2 border-indigo-300 shadow-xl md:col-span-2'
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl shrink-0 shadow-md transition-transform duration-300 group-hover:scale-105',
              brand.bg, brand.text
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{t(integration.name)}</h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t(integration.description)}</p>
              <div className="flex items-center gap-1.5 mt-2">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('integrations.connected')}
                  </span>
                ) : isConnecting ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('integrations.connecting')}
                  </span>
                ) : hasError ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" /> {t('integrations.errorStatus')}
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">
                    {t('integrations.disconnected')}
                  </span>
                )}
              </div>
              {isConnected && activeAccountSummary ? (
                <p className="mt-1 text-[11px] text-gray-600 truncate">
                  <span className="font-semibold text-gray-700">
                    {isHebrew ? 'חשבון פעיל:' : 'Active account:'}
                  </span>{' '}
                  <span className="font-medium">{activeAccountSummary}</span>
                </p>
              ) : null}
            </div>
          </div>

          {!isExpanded && !(integration.category === 'AI Engine') && (
            <div className="shrink-0 flex items-center gap-2">
              {supportsWizard && (
                <button
                  onClick={() => onOpenWizard(integration.id as WizardPlatform)}
                  disabled={isConnecting}
                  title={isHebrew ? 'פתח שאלון נכסים' : 'Open assets questionnaire'}
                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-50 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onExpand(integration)}
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 font-bold text-sm',
                  isConnected || hasError
                    ? isConnected ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                  : 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                )}
              >
                {isConnecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isConnected ? (
                  <Settings2 className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>

        {isConnected && integration.score != null && !isExpanded && (
          <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${integration.score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                integration.score >= 90 ? 'bg-emerald-500' :
                integration.score >= 70 ? 'bg-amber-500' : 'bg-red-500'
              )}
            />
          </div>
        )}

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{t(integration.description)}</p>
                {renderSettings(integration)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

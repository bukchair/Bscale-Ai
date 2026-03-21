import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ErrorState = { id: string; message: string } | null;

export type IntegrationsAlertsProps = {
  success: string | null;
  error: ErrorState;
  connections: Array<{ id: string; name: string }>;
  isHebrew: boolean;
  t: (key: string) => string;
  onClearSuccess: () => void;
  onClearError: () => void;
};

export function IntegrationsAlerts({
  success,
  error,
  connections,
  isHebrew,
  t,
  onClearSuccess,
  onClearError,
}: IntegrationsAlertsProps) {
  return (
    <>
      {success && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <p className="text-sm font-bold text-emerald-800">{success}</p>
            </div>
            <button onClick={onClearSuccess} className="text-emerald-600 hover:text-emerald-800 p-2 hover:bg-emerald-100 rounded-xl transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-start justify-between shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-800">
                  {(() => {
                    const connectionName = connections.find(i => i.id === error.id)?.name || '';
                    const errorTemplate = t('integrations.error');
                    return errorTemplate.includes('{{name}}')
                      ? errorTemplate.replace('{{name}}', connectionName)
                      : `${errorTemplate} ${connectionName}`.trim();
                  })()}
                </h3>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
                {error.id === 'google' && (
                  <p className="text-sm text-amber-700 mt-2 font-medium">{t('integrations.googleReconnectHint')}</p>
                )}
              </div>
            </div>
            <button onClick={onClearError} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-100 rounded-xl transition-colors shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

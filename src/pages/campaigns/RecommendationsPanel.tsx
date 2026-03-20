'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Mail, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

type RecommendationsPanelProps = {
  recommendations: any[];
  loading: boolean;
  appliedRecs: number[];
  expandedRecs: number[];
  sendingEmail: boolean;
  onApply: (index: number) => void;
  onToggleExpanded: (index: number) => void;
  onSendEmail: () => void;
  t: (key: string) => string;
};

export function RecommendationsPanel({
  recommendations,
  loading,
  appliedRecs,
  expandedRecs,
  sendingEmail,
  onApply,
  onToggleExpanded,
  onSendEmail,
  t,
}: RecommendationsPanelProps) {
  return (
    <section className="bg-white shadow rounded-lg overflow-hidden flex flex-col border border-gray-200">
      <div className="px-3 py-3 sm:px-4 border-b border-gray-200 bg-indigo-50 flex items-center justify-between">
        <h3 className="text-base leading-6 font-semibold text-indigo-900 flex items-center">
          <Zap className="w-4 h-4 ml-1.5 text-indigo-600" />
          {t('campaigns.aiRecommendations')}
        </h3>
        {recommendations.length > 0 && (
          <button
            onClick={onSendEmail}
            disabled={sendingEmail}
            className="inline-flex items-center p-1.5 border border-indigo-200 rounded-md text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
            title="Send to Email"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          </button>
        )}
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : recommendations.length > 0 ? (
          <ul className="space-y-1.5 max-h-[250px] overflow-y-auto pe-1">
            {recommendations.map((rec, index) => (
              <li key={`ai-rec-${index}`} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => onToggleExpanded(index)}
                  className="w-full px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
                        rec.impact === 'High' ? "bg-red-100 text-red-800" :
                        rec.impact === 'Medium' ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      )}>
                        {t('campaigns.impact')}: {
                          rec.impact === 'High' ? t('campaigns.impactHigh') :
                          rec.impact === 'Medium' ? t('campaigns.impactMedium') :
                          t('campaigns.impactLow')
                        }
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">{rec.platform}</span>
                    </div>
                    <h4 className="text-xs font-bold text-gray-900 truncate text-start">{rec.title}</h4>
                  </div>
                  {expandedRecs.includes(index) ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                </button>
                <div className={cn(
                  "px-2.5 overflow-hidden transition-all duration-200",
                  expandedRecs.includes(index) ? "max-h-44 pb-2.5" : "max-h-0"
                )}>
                  <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-4">{rec.description}</p>
                  <div className="mt-1.5">
                    <button
                      onClick={() => onApply(index)}
                      disabled={appliedRecs.includes(index)}
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 border border-transparent text-[11px] font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
                        appliedRecs.includes(index)
                          ? "bg-green-50 text-green-700 border-green-200 cursor-not-allowed"
                          : "text-white bg-indigo-600 hover:bg-indigo-700"
                      )}
                    >
                      {appliedRecs.includes(index) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                          {t('campaigns.appliedSuccess')}
                        </>
                      ) : (
                        t('campaigns.applyAuto')
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p>{t('campaigns.noRecommendations')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

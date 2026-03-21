"use client";

import React from 'react';
import { motion } from 'motion/react';
import {
  Settings2, X, CheckCircle2, Sparkles, Loader2, Megaphone, RotateCcw,
  Facebook, Video, LinkIcon, Trash2, Plug, Key, HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Connection } from '../../contexts/ConnectionsContext';
import type { MetaAssetsPayload } from './integrationUtils';
import {
  parseManagedGoogleAdsAccounts,
  formatGoogleAdsAccountId,
  normalizeMetaAccountId,
} from './integrationUtils';

export type Toast = { message: string; type: 'success' | 'error' };

export interface IntegrationSettingsPanelProps {
  integration: Connection;

  // display flags
  isDemo: boolean;
  isAdmin: boolean;
  isHebrew: boolean;
  language: string;
  dir: string;

  // form & async state
  formValues: Record<string, string>;
  testingId: string | null;
  reinstallingManagedPlatform: 'google' | 'meta' | 'tiktok' | null;
  reinstallingGoogleAndMeta: boolean;
  metaAssets: MetaAssetsPayload | null;
  metaAssetsLoading: boolean;
  metaAssetsError: string | null;
  tiktokAccounts: Array<{ externalAccountId: string; name?: string }>;
  tiktokAccountsLoading: boolean;
  tiktokAccountsError: string | null;

  // actions
  onClose: () => void;
  onInputChange: (key: string, value: string) => void;
  onSave: (id: string) => void;
  onTest: (id: string) => void;
  onHardReset: (id: string) => void;
  onMigrateAi: () => void;
  onGoogleConnect: () => void;
  onMetaConnect: () => void;
  onTikTokConnect: () => void;
  onReinstallPlatform: (platform: 'google' | 'meta' | 'tiktok') => void;
  onLoadMetaAssets: (values?: Record<string, string>) => void;
  onLoadTikTokAccounts: (values?: Record<string, string>) => void;
  onClearConnectionSettings: (id: string) => Promise<void>;
  onSetFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetToast: (toast: Toast | null) => void;

  t: (key: string) => string;
}

export function IntegrationSettingsPanel({
  integration,
  isDemo,
  isAdmin,
  isHebrew,
  language,
  dir,
  formValues,
  testingId,
  reinstallingManagedPlatform,
  reinstallingGoogleAndMeta,
  metaAssets,
  metaAssetsLoading,
  metaAssetsError,
  tiktokAccounts,
  tiktokAccountsLoading,
  tiktokAccountsError,
  onClose,
  onInputChange,
  onSave,
  onTest,
  onHardReset,
  onMigrateAi,
  onGoogleConnect,
  onMetaConnect,
  onTikTokConnect,
  onReinstallPlatform,
  onLoadMetaAssets,
  onLoadTikTokAccounts,
  onClearConnectionSettings,
  onSetFormValues,
  onSetToast,
  t,
}: IntegrationSettingsPanelProps) {
  const isConnected = integration.status === 'connected';
  const isConnecting = integration.status === 'connecting';
  const isAiReadOnly = integration.category === 'AI Engine' && !isAdmin;

  // — Demo mode —
  if (isDemo) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-300 p-4 text-sm text-gray-700">
            <p className="font-bold mb-1">{language === 'he' ? 'מצב דמו פעיל' : 'Demo mode is active'}</p>
            <p className="text-xs text-gray-500">
              {language === 'he'
                ? 'בחשבון דמו לא ניתן לחבר פלטפורמות אמיתיות. כל הנתונים במסכים השונים מוצגים כנתוני דוגמה בלבד כדי שתוכל לראות איך המערכת נראית. להצטרפות לחבילה פעילה וחיבור פלטפורמות — עבור למסך המנויים.'
                : 'In demo accounts, real platform connections are disabled. Data shown across the app is sample data so you can explore the system. To connect real platforms, upgrade your subscription.'}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // — AI read-only (non-admin) —
  if (isAiReadOnly) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-500" />
              {t('integrations.connectionSettings')} — {t(integration.name)}
            </h4>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="rounded-2xl bg-gray-50 border-2 border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {isConnected ? (
                <span className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> {t('integrations.connected')}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-gray-500">{t('integrations.disconnected')}</span>
              )}
            </p>
            <p className="text-xs text-gray-500">{t('integrations.aiAdminOnly')}</p>
            {isAdmin ? (
              <button
                onClick={onMigrateAi}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {t('integrations.aiSharedWithAll')}
              </button>
            ) : (
              <p className="text-xs text-indigo-600 mt-1">{t('integrations.aiSharedWithAll')}</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // — Main settings panel —
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-5 pt-5 border-t border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-500" />
            {t('integrations.connectionSettings')} — {t(integration.name)}
          </h4>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Fields column — filled in next steps */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* ── AI: Gemini ── */}
              {integration.id === 'gemini' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="AIzaSy..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? '••••••••••••••••' : '')} onChange={(e) => onInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || 'Gemini 1.5 Pro'} onChange={(e) => onInputChange('model', e.target.value)}>
                      <option>Gemini 1.5 Pro</option>
                      <option>Gemini 1.5 Flash</option>
                    </select>
                  </div>
                </>
              )}

              {/* ── AI: OpenAI ── */}
              {integration.id === 'openai' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="sk-..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? '••••••••••••••••' : '')} onChange={(e) => onInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || 'gpt-4o'} onChange={(e) => onInputChange('model', e.target.value)}>
                      <option>gpt-4o</option>
                      <option>gpt-4o-mini</option>
                      <option>gpt-4-turbo</option>
                    </select>
                  </div>
                </>
              )}

              {/* ── AI: Claude ── */}
              {integration.id === 'claude' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="sk-ant-..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? '••••••••••••••••' : '')} onChange={(e) => onInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || 'claude-sonnet-4-20250514'} onChange={(e) => onInputChange('model', e.target.value)}>
                      <option>claude-sonnet-4-20250514</option>
                      <option>claude-3-5-sonnet-20241022</option>
                      <option>claude-3-haiku-20240307</option>
                    </select>
                  </div>
                </>
              )}

              {/* ── Google ── */}
              {integration.id === 'google' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={onGoogleConnect}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-600 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Megaphone className="w-4 h-4" />
                      {isConnected ? t('integrations.reconnectGoogleEcosystem') : t('integrations.connectGoogleEcosystem')}
                    </button>
                  </div>
                  {isConnected && (
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => onReinstallPlatform('google')}
                        disabled={reinstallingGoogleAndMeta || reinstallingManagedPlatform === 'google' || isConnecting}
                        className="w-full inline-flex items-center justify-center gap-2 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 rounded-lg text-xs font-bold hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {reinstallingManagedPlatform === 'google' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {isHebrew ? 'התקנה מחדש ל-Google (ניתוק + חיבור)' : 'Re-install Google (disconnect + reconnect)'}
                      </button>
                    </div>
                  )}
                  {isConnected && (
                    <>
                      {(() => {
                        const managedAccounts = parseManagedGoogleAdsAccounts(formValues.googleAdsAccounts);
                        if (managedAccounts.length > 0) {
                          return (
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                {language === 'he' ? 'חשבון ברירת מחדל ל-Google Ads' : 'Default Google Ads account'}
                              </label>
                              <select
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white"
                                value={
                                  formValues.googleAdsId
                                    ? formatGoogleAdsAccountId(formValues.googleAdsId)
                                    : formatGoogleAdsAccountId(managedAccounts[0]?.externalAccountId || '')
                                }
                                onChange={(e) => onInputChange('googleAdsId', e.target.value)}
                              >
                                {managedAccounts.map((account) => {
                                  const formatted = formatGoogleAdsAccountId(account.externalAccountId);
                                  const suffix = account.currency ? ` · ${account.currency}` : '';
                                  return (
                                    <option key={account.externalAccountId} value={formatted}>
                                      {account.name || formatted} ({formatted}){suffix}
                                    </option>
                                  );
                                })}
                              </select>
                              <p className="mt-1 text-[10px] text-gray-500">
                                {language === 'he'
                                  ? `יובאו ${managedAccounts.length} חשבונות. בחר ברירת מחדל לבדיקה וסנכרון.`
                                  : `${managedAccounts.length} accounts imported. Choose the default for test and sync.`}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                              {t('integrations.adsAccountId')}
                            </label>
                            <input
                              type="text"
                              placeholder="123-456-7890"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left"
                              dir="ltr"
                              value={formValues.googleAdsId || ''}
                              onChange={(e) => onInputChange('googleAdsId', e.target.value)}
                            />
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.ga4MeasurementId')}</label>
                        <input type="text" placeholder="123456789" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.ga4Id || ''} onChange={(e) => onInputChange('ga4Id', e.target.value)} />
                        <p className="mt-1 text-[10px] text-gray-500">
                          {isHebrew
                            ? 'יש להזין GA4 Property ID מספרי בלבד (לא Measurement ID שמתחיל ב‑G-).'
                            : 'Use GA4 Property ID (digits only), not Measurement ID that starts with G-.'}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Google Access Token</label>
                        <input type="password" placeholder="ya29..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left bg-gray-50" dir="ltr" value={formValues.googleAccessToken || ''} readOnly />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Meta ── */}
              {integration.id === 'meta' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={onMetaConnect}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Facebook className="w-4 h-4" />
                      {isConnected ? 'Reconnect Meta Ads' : 'Connect with Meta Ads'}
                    </button>
                  </div>
                  {isConnected && (
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => onReinstallPlatform('meta')}
                        disabled={reinstallingGoogleAndMeta || reinstallingManagedPlatform === 'meta' || isConnecting}
                        className="w-full inline-flex items-center justify-center gap-2 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 rounded-lg text-xs font-bold hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {reinstallingManagedPlatform === 'meta' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {isHebrew ? 'התקנה מחדש ל-Meta (ניתוק + חיבור)' : 'Re-install Meta (disconnect + reconnect)'}
                      </button>
                    </div>
                  )}
                  {isConnected && (
                    <>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => onLoadMetaAssets(formValues)}
                          disabled={metaAssetsLoading}
                          className="w-full inline-flex items-center justify-center gap-2 py-1.5 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg text-xs font-bold hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {metaAssetsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          {isHebrew ? 'טען/רענן נכסים קיימים מ‑Meta' : 'Load/refresh existing Meta assets'}
                        </button>
                        {metaAssetsError && <p className="mt-1 text-[11px] text-red-600">{metaAssetsError}</p>}
                        <p className="mt-1 text-[10px] text-gray-500">
                          {isHebrew
                            ? 'אם רשימת חשבונות ההודעות ריקה, לחץ Reconnect ואשר גם הרשאות Pages.'
                            : 'If messaging accounts are empty, click Reconnect and approve Page permissions as well.'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.adsAccountId')}</label>
                        <select
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white"
                          value={normalizeMetaAccountId(formValues.metaAdsId || '')}
                          onChange={(e) => onInputChange('metaAdsId', normalizeMetaAccountId(e.target.value))}
                        >
                          <option value="">{isHebrew ? 'בחר חשבון מודעות' : 'Select ad account'}</option>
                          {(metaAssets?.adAccounts || []).map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.id.startsWith('act_') ? account.id : `act_${account.id}`})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.businessId')}</label>
                        <select
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white"
                          value={formValues.businessId || ''}
                          onChange={(e) => onInputChange('businessId', e.target.value)}
                        >
                          <option value="">{isHebrew ? 'בחר Business Manager' : 'Select Business Manager'}</option>
                          {(metaAssets?.businesses || []).map((business) => (
                            <option key={business.id} value={business.id}>
                              {business.name} ({business.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                          {isHebrew ? 'חשבון הודעות' : 'Messaging account'}
                        </label>
                        <select
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white"
                          value={formValues.messageAccountId || ''}
                          onChange={(e) => onInputChange('messageAccountId', e.target.value)}
                        >
                          <option value="">{isHebrew ? 'בחר חשבון הודעות' : 'Select messaging account'}</option>
                          {(metaAssets?.messageAccounts || []).map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.pixelId')}</label>
                        <select
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white"
                          value={formValues.pixelId || ''}
                          onChange={(e) => onInputChange('pixelId', e.target.value)}
                        >
                          <option value="">{isHebrew ? 'בחר Pixel' : 'Select pixel'}</option>
                          {(metaAssets?.pixels || [])
                            .filter((pixel) => {
                              const selectedAccount = normalizeMetaAccountId(formValues.metaAdsId || '');
                              if (!selectedAccount) return true;
                              return !pixel.adAccountId || normalizeMetaAccountId(pixel.adAccountId) === selectedAccount;
                            })
                            .map((pixel) => (
                              <option key={`${pixel.adAccountId || 'any'}-${pixel.id}`} value={pixel.id}>
                                {pixel.name} ({pixel.id})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.accessToken')}</label>
                        <input type="password" placeholder="EAAB..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left bg-gray-50" dir="ltr" value={formValues.metaToken || ''} readOnly />
                      </div>
                      {Array.isArray(metaAssets?.warnings) && metaAssets!.warnings!.length > 0 && (
                        <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="text-[11px] font-bold text-amber-800">
                            {isHebrew ? 'הערות מה‑API של Meta:' : 'Meta API notes:'}
                          </p>
                          <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-700 space-y-0.5">
                            {metaAssets!.warnings!.slice(0, 3).map((warning, idx) => (
                              <li key={`meta-warning-${idx}`}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* platform fields TikTok/Woo/Shopify — step 2ו */}
            </div>
            {/* action buttons — step 2ז */}
          </div>

          {/* Quick guide column — step 2ח */}
          <div className="w-full lg:w-56 shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}

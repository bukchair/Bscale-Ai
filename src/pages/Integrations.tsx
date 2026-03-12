import React, { useState } from 'react';
import { Plug, CheckCircle2, ShoppingCart, BarChart2, Mail, Search, Megaphone, Video, Facebook, AlertCircle, Loader2, X, Store, HelpCircle, ChevronDown, ChevronUp, Sparkles, Settings2, Key, Link as LinkIcon, Trash2, Plus, Zap, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useConnections, Connection } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';

const iconMap: Record<string, React.ElementType> = {
  'gemini': Sparkles,
  'openai': Zap,
  'claude': BrainCircuit,
  'google': Megaphone,
  'meta': Facebook,
  'tiktok': Video,
  'woocommerce': ShoppingCart,
  'shopify': Store,
};

const brandStyles: Record<string, { bg: string, text: string, border: string, lightBg: string }> = {
  'gemini': { bg: 'bg-gradient-to-br from-purple-500 to-blue-500', text: 'text-white', border: 'border-purple-200', lightBg: 'bg-purple-50' },
  'openai': { bg: 'bg-gradient-to-br from-emerald-600 to-teal-600', text: 'text-white', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
  'claude': { bg: 'bg-gradient-to-br from-amber-600 to-orange-600', text: 'text-white', border: 'border-amber-200', lightBg: 'bg-amber-50' },
  'google': { bg: 'bg-gradient-to-br from-blue-500 to-red-400', text: 'text-white', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  'meta': { bg: 'bg-gradient-to-br from-blue-600 to-blue-700', text: 'text-white', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  'tiktok': { bg: 'bg-gradient-to-br from-gray-800 to-black', text: 'text-white', border: 'border-gray-300', lightBg: 'bg-gray-100' },
  'woocommerce': { bg: 'bg-gradient-to-br from-purple-600 to-purple-800', text: 'text-white', border: 'border-purple-200', lightBg: 'bg-purple-50' },
  'shopify': { bg: 'bg-gradient-to-br from-emerald-500 to-green-600', text: 'text-white', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
};

export function Integrations({ userProfile }: { userProfile?: { role?: string } | null }) {
  const isAdmin = userProfile?.role === 'admin';
  const { t, dir } = useLanguage();
  const { connections, toggleConnection, updateConnectionSettings, clearConnectionSettings, testConnection } = useConnections();
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleTikTokConnect = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_URL}/api/auth/tiktok/url`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'tiktok_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      console.error("Failed to get TikTok auth URL:", err);
      setToast({ message: "Failed to start TikTok authentication", type: 'error' });
    }
  };

  const handleMetaConnect = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_URL}/api/auth/meta/url`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'meta_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      console.error("Failed to get Meta auth URL:", err);
      setToast({ message: "Failed to start Meta authentication", type: 'error' });
    }
  };

  const handleGoogleConnect = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_URL}/api/auth/google/url`);
      
      // Log the full response for debugging
      const responseText = await response.text();
      console.log("Google Auth URL Response:", {
        status: response.status,
        ok: response.ok,
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to get auth URL: ${response.status} ${responseText}`);
      }
      
      const { url } = JSON.parse(responseText);
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (err) {
      console.error("Failed to get Google auth URL:", err);
      setToast({ message: `Failed to start Google authentication: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
    }
  };

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("Received postMessage:", event.data);
      // Simple origin check for development and production
      const isAllowedOrigin = event.origin.includes(window.location.hostname) || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('.run.app');
      
      if (!isAllowedOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'tiktok') {
        const { data } = event.data;
        // Update connection settings with the new token
        handleSave('tiktok', { 
          tiktokToken: data.access_token,
        });
        setToast({ message: "Successfully connected to TikTok Ads!", type: 'success' });
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'meta') {
        const { data } = event.data;
        // Update connection settings with the new token
        handleSave('meta', { 
          metaToken: data.access_token,
        });
        setToast({ message: "Successfully connected to Meta Ads!", type: 'success' });
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'google') {
        const { tokens } = event.data;
        // Update connection settings with the new tokens
        handleSave('google', { 
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || '',
          googleExpiry: (Date.now() + tokens.expires_in * 1000).toString(),
        });
        setToast({ message: "Successfully connected to Google Workspace!", type: 'success' });
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setToast({ message: event.data.error || "TikTok authentication failed", type: 'error' });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [formValues]);

  const handleExpand = (integration: Connection) => {
    if (expandedId === integration.id) {
      setExpandedId(null);
    } else {
      setExpandedId(integration.id);
      setFormValues(integration.settings || {});
      setSuccess(null);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (id: string, overrideSettings?: Record<string, string>) => {
    setError(null);
    setSuccess(null);
    const settingsToSave = overrideSettings || formValues;
    try {
      // Show a more realistic verification process
      await updateConnectionSettings(id, settingsToSave);
      setExpandedId(null);
      setSuccess(t('integrations.success', { name: connections.find(c => c.id === id)?.name || '' }));
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError({ id, message: t('integrations.error', { name: connections.find(c => c.id === id)?.name || '' }) });
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError(null);
    setSuccess(null);
    try {
      const result = await testConnection(id);
      if (result.success) {
        setSuccess(result.message);
        setToast({ message: result.message, type: 'success' });
        setTimeout(() => {
          setSuccess(null);
          setToast(null);
        }, 5000);
      } else {
        setError({ id, message: result.message });
        setToast({ message: result.message, type: 'error' });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (err) {
      setError({ id, message: t('common.error') });
      setToast({ message: t('common.error'), type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (id: string, subId?: string) => {
    setError(null);
    try {
      await toggleConnection(id, subId);
    } catch (err) {
      setError({ id, message: t('common.error') });
    }
  };

  const renderIntegrationSettings = (integration: Connection) => {
    const isConnected = integration.status === 'connected';
    const isConnecting = integration.status === 'connecting';
    const isAiReadOnly = integration.category === 'AI Engine' && !isAdmin;

    if (isAiReadOnly) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-gray-400" />
                {t('integrations.connectionSettings')} - {t(integration.name)}
              </h4>
              <button onClick={() => setExpandedId(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10 p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {isConnected ? (
                  <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> {t('integrations.connected')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-gray-500">{t('integrations.disconnected')}</span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('integrations.aiAdminOnly')}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-gray-400" />
              {t('integrations.connectionSettings')} - {t(integration.name)}
            </h4>
            <button 
              onClick={() => setExpandedId(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-2 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 space-y-3">
            {/* Dynamic Form Fields based on Integration ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {integration.id === 'gemini' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="AIzaSy..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? "••••••••••••••••" : "")} onChange={(e) => handleInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || "Gemini 1.5 Pro"} onChange={(e) => handleInputChange('model', e.target.value)}>
                      <option>Gemini 1.5 Pro</option>
                      <option>Gemini 1.5 Flash</option>
                    </select>
                  </div>
                </>
              )}

              {integration.id === 'openai' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="sk-..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? "••••••••••••••••" : "")} onChange={(e) => handleInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || "gpt-4o"} onChange={(e) => handleInputChange('model', e.target.value)}>
                      <option>gpt-4o</option>
                      <option>gpt-4o-mini</option>
                      <option>gpt-4-turbo</option>
                    </select>
                  </div>
                </>
              )}

              {integration.id === 'claude' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.apiKey')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Key className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="password" placeholder="sk-ant-..." className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.apiKey || (isConnected ? "••••••••••••••••" : "")} onChange={(e) => handleInputChange('apiKey', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.defaultModel')}</label>
                    <select className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-xs" value={formValues.model || "claude-sonnet-4-20250514"} onChange={(e) => handleInputChange('model', e.target.value)}>
                      <option>claude-sonnet-4-20250514</option>
                      <option>claude-3-5-sonnet-20241022</option>
                      <option>claude-3-haiku-20240307</option>
                    </select>
                  </div>
                </>
              )}

              {integration.id === 'google' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleGoogleConnect}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-600 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Megaphone className="w-4 h-4" />
                      {isConnected ? "Reconnect Google Workspace" : "Connect with Google"}
                    </button>
                  </div>
                  {isConnected && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.adsAccountId')}</label>
                        <input type="text" placeholder="123-456-7890" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.googleAdsId || ""} onChange={(e) => handleInputChange('googleAdsId', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.ga4MeasurementId')}</label>
                        <input type="text" placeholder="G-XXXXXXXXXX" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.ga4Id || ""} onChange={(e) => handleInputChange('ga4Id', e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Google Access Token</label>
                        <input type="password" placeholder="ya29..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left bg-gray-50" dir="ltr" value={formValues.googleAccessToken || ""} readOnly />
                      </div>
                    </>
                  )}
                </>
              )}

              {integration.id === 'meta' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleMetaConnect}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Facebook className="w-4 h-4" />
                      {isConnected ? "Reconnect Meta Ads" : "Connect with Meta Ads"}
                    </button>
                  </div>
                  {isConnected && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.adsAccountId')}</label>
                        <input type="text" placeholder="act_123456789" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.metaAdsId || ""} onChange={(e) => handleInputChange('metaAdsId', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.pixelId')}</label>
                        <input type="text" placeholder="1234567890" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.pixelId || ""} onChange={(e) => handleInputChange('pixelId', e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.accessToken')}</label>
                        <input type="password" placeholder="EAAB..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left bg-gray-50" dir="ltr" value={formValues.metaToken || ""} readOnly />
                      </div>
                    </>
                  )}
                </>
              )}

              {integration.id === 'tiktok' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={handleTikTokConnect}
                      className="w-full flex items-center justify-center gap-2 bg-black text-white py-2 rounded-lg font-bold hover:bg-gray-900 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Video className="w-4 h-4" />
                      {isConnected ? "Reconnect TikTok Ads" : "Connect with TikTok Ads"}
                    </button>
                  </div>
                  {isConnected && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.advertiserId')}</label>
                        <input type="text" placeholder="7012345678901234567" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.tiktokAdvertiserId || ""} onChange={(e) => handleInputChange('tiktokAdvertiserId', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.accessToken')}</label>
                        <input type="password" placeholder="act_..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left bg-gray-50" dir="ltr" value={formValues.tiktokToken || ""} readOnly />
                      </div>
                    </>
                  )}
                </>
              )}

              {(integration.id === 'woocommerce' || integration.id === 'shopify') && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.storeUrl')}</label>
                    <div className="relative">
                      <div className={cn("absolute inset-y-0 flex items-center pointer-events-none", dir === 'rtl' ? "right-2.5" : "left-2.5")}>
                        <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input type="url" placeholder="https://mystore.co.il" className={cn("w-full py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left", dir === 'rtl' ? "pr-9 pl-3" : "pl-9 pr-3")} dir="ltr" value={formValues.storeUrl || (isConnected ? "https://mystore.co.il" : "")} onChange={(e) => handleInputChange('storeUrl', e.target.value)} />
                    </div>
                  </div>
                  
                  {integration.id === 'woocommerce' && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.consumerKey')}</label>
                        <input type="text" placeholder="ck_..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.wooKey || (isConnected ? "ck_1234567890" : "")} onChange={(e) => handleInputChange('wooKey', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.consumerSecret')}</label>
                        <input type="password" placeholder="cs_..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.wooSecret || (isConnected ? "••••••••••••••••" : "")} onChange={(e) => handleInputChange('wooSecret', e.target.value)} />
                      </div>
                      {isConnected && (
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(t('integrations.wooResetConfirm') || 'למחוק את החיבור ל-WooCommerce ולהגדיר מחדש?')) {
                                await clearConnectionSettings('woocommerce');
                                setFormValues((prev) => ({ ...prev, storeUrl: '', wooKey: '', wooSecret: '' }));
                                setToast({ message: t('integrations.wooResetDone') || 'החיבור נוקה. הזן פרטים חדשים למעלה.', type: 'success' });
                              }
                            }}
                            className="w-full py-2 rounded-lg text-xs font-bold border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('integrations.wooResetConnection') || 'מחק חיבור והגדר מחדש'}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {integration.id === 'shopify' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.adminAccessToken')}</label>
                      <input type="password" placeholder="shpat_..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.shopifyToken || (isConnected ? "••••••••••••••••" : "")} onChange={(e) => handleInputChange('shopifyToken', e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              {!isConnected ? (
                <button
                  onClick={() => handleSave(integration.id)}
                  disabled={isConnecting}
                  className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                  {t('integrations.saveAndConnect')}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSave(integration.id)}
                    disabled={isConnecting}
                    className="flex-1 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {t('integrations.updateSettings')}
                  </button>
                  <button
                    onClick={() => handleTest(integration.id)}
                    disabled={testingId === integration.id}
                    className="flex-1 bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {testingId === integration.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {t('integrations.testConnection')}
                  </button>
                  <button
                    onClick={() => {
                      handleToggle(integration.id);
                      setExpandedId(null);
                    }}
                    disabled={isConnecting}
                    className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('integrations.disconnect')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="w-full lg:w-48 shrink-0">
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 h-full">
              <h5 className="font-bold text-amber-900 mb-2 text-[10px] flex items-center gap-1.5 uppercase tracking-tight">
                <HelpCircle className="w-3 h-3 text-amber-600" />
                {t('integrations.quickGuide')}
              </h5>
              
              <div className="text-[10px] text-amber-800/80 leading-tight">
                {integration.id === 'gemini' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.gemini.step1')} <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">AI Studio</a></li>
                    <li>{t('integrations.gemini.step2')}</li>
                    <li>{t('integrations.gemini.step3')}</li>
                  </ul>
                )}
                {(integration.id === 'openai' || integration.id === 'claude') && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{integration.id === 'openai' ? 'OpenAI: platform.openai.com → API keys' : 'Anthropic: console.anthropic.com → API keys'}</li>
                    <li>Create a key with appropriate usage</li>
                    <li>Paste the key in the field on the left</li>
                  </ul>
                )}
                {integration.id === 'google' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.google.step1')}</li>
                    <li>{t('integrations.google.step2')}</li>
                    <li>{t('integrations.google.step3')}</li>
                  </ul>
                )}
                {integration.id === 'meta' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.meta.step1')}</li>
                    <li>{t('integrations.meta.step2')}</li>
                    <li>{t('integrations.meta.step3')}</li>
                  </ul>
                )}
                {integration.id === 'tiktok' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.tiktok.step1')}</li>
                    <li>{t('integrations.tiktok.step2')}</li>
                    <li>{t('integrations.tiktok.step3')}</li>
                  </ul>
                )}
                {integration.id === 'woocommerce' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.woo.step1')}</li>
                    <li>{t('integrations.woo.step2')}</li>
                    <li>{t('integrations.woo.step3')}</li>
                  </ul>
                )}
                {integration.id === 'shopify' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t('integrations.shopify.step1')}</li>
                    <li>{t('integrations.shopify.step2')}</li>
                    <li>{t('integrations.shopify.step3')}</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    );
  };

  const renderConnectionCard = (integration: Connection) => {
    const isConnected = integration.status === 'connected';
    const isConnecting = integration.status === 'connecting';
    const hasError = integration.status === 'error';
    const Icon = iconMap[integration.id] || Plug;
    const isExpanded = expandedId === integration.id;
    const brand = brandStyles[integration.id] || { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-200', lightBg: 'bg-gray-50' };
    
    return (
      <motion.div 
        layout
        key={integration.id} 
        className={cn(
          "bg-white rounded-lg border transition-all duration-300 flex flex-col overflow-hidden group relative",
          isConnected ? "border-emerald-200 shadow-sm" : 
          hasError ? "border-red-300 shadow-sm" : "border-gray-200 hover:border-indigo-300 hover:shadow-md",
          isExpanded ? "md:col-span-2 lg:col-span-3 ring-2 ring-indigo-500/20 border-indigo-300 shadow-lg" : ""
        )}
      >
        <div className="p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 shadow-sm transition-transform group-hover:scale-110",
                brand.bg, brand.text
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-gray-900 truncate tracking-tight">{t(integration.name)}</h3>
                <div className="flex items-center gap-1.5">
                  {isConnected ? (
                    <span className="flex items-center text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">
                      <CheckCircle2 className={cn("w-2.5 h-2.5", dir === 'rtl' ? "ml-0.5" : "mr-0.5")} /> {t('integrations.connected')}
                    </span>
                  ) : isConnecting ? (
                    <span className="flex items-center text-[9px] font-bold text-blue-600 uppercase tracking-tighter">
                      <Loader2 className={cn("w-2.5 h-2.5 animate-spin", dir === 'rtl' ? "ml-0.5" : "mr-0.5")} /> {t('integrations.connecting')}
                    </span>
                  ) : hasError ? (
                    <span className="flex items-center text-[9px] font-bold text-red-600 uppercase tracking-tighter">
                      <AlertCircle className={cn("w-2.5 h-2.5", dir === 'rtl' ? "ml-0.5" : "mr-0.5")} /> {t('integrations.errorStatus')}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{t('integrations.disconnected')}</span>
                  )}
                </div>
              </div>
            </div>

            {!isExpanded && (
              <button
                onClick={() => handleExpand(integration)}
                disabled={isConnecting}
                className={cn(
                  "shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-all duration-200 disabled:opacity-50",
                  isConnected
                    ? "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                    : hasError
                    ? "text-red-600 bg-red-50 hover:bg-red-100"
                    : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                )}
              >
                {isConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isConnected ? (
                  <Settings2 className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {isConnected && integration.score && !isExpanded && (
            <div className="mt-2 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  integration.score >= 90 ? "bg-emerald-500" :
                  integration.score >= 70 ? "bg-amber-500" :
                  "bg-red-500"
                )}
                style={{ width: `${integration.score}%` }}
              />
            </div>
          )}

          <AnimatePresence>
            {isExpanded && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                <p className="text-[10px] text-gray-500 mb-2.5 leading-tight italic">{t(integration.description)}</p>
                {renderIntegrationSettings(integration)}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  const aiConnections = connections.filter(c => c.category === 'AI Engine');
  const googleConnections = connections.filter(c => c.category === 'Google');
  const socialConnections = connections.filter(c => c.category === 'Social');
  const ecommerceConnections = connections.filter(c => c.category === 'E-commerce');

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-tight">{t('integrations.title')}</h1>
            <p className="text-[11px] text-gray-500 font-medium">{t('integrations.subtitle')}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            const connected = connections.filter(c => c.status === 'connected');
            connected.forEach(c => handleTest(c.id));
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {t('integrations.testAll')}
        </button>
      </div>
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border",
              toast.type === 'success' ? "bg-emerald-600 border-emerald-500 text-white" : "bg-red-600 border-red-500 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-sm font-bold">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center">
            <CheckCircle2 className={cn("h-5 w-5 text-emerald-500", dir === 'rtl' ? "ml-3" : "mr-3")} />
            <p className="text-sm font-bold text-emerald-800">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 p-1 hover:bg-emerald-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center">
            <AlertCircle className={cn("h-5 w-5 text-red-500", dir === 'rtl' ? "ml-3" : "mr-3")} />
            <div>
              <h3 className="text-sm font-bold text-red-800">{t('integrations.error', { name: connections.find(i => i.id === error.id)?.name || '' })}</h3>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {aiConnections.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('integrations.aiEngine')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {aiConnections.map(renderConnectionCard)}
            </div>
          </section>
        )}

        {googleConnections.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('integrations.googleWorkspace')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {googleConnections.map(renderConnectionCard)}
            </div>
          </section>
        )}

        {socialConnections.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('integrations.socialMedia')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {socialConnections.map(renderConnectionCard)}
            </div>
          </section>
        )}

        {ecommerceConnections.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-indigo-600 rounded-full" />
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('integrations.ecommerce')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {ecommerceConnections.map(renderConnectionCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

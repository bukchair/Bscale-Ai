import React, { useState } from 'react';
import { Plug, CheckCircle2, ShoppingCart, BarChart2, Mail, Search, Megaphone, Video, Facebook, AlertCircle, Loader2, X, Store, HelpCircle, ChevronDown, ChevronUp, Sparkles, Settings2, Key, Link as LinkIcon, Trash2, Plus, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useConnections, Connection } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchGoogleDiscovery } from '../services/googleService';

const iconMap: Record<string, React.ElementType> = {
  'gemini': Sparkles,
  'google': Megaphone,
  'meta': Facebook,
  'tiktok': Video,
  'woocommerce': ShoppingCart,
  'shopify': Store,
};

const brandStyles: Record<string, { bg: string, text: string, border: string, lightBg: string }> = {
  'gemini': { bg: 'bg-gradient-to-br from-purple-500 to-blue-500', text: 'text-white', border: 'border-purple-200', lightBg: 'bg-purple-50' },
  'google': { bg: 'bg-gradient-to-br from-blue-500 to-red-400', text: 'text-white', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  'meta': { bg: 'bg-gradient-to-br from-blue-600 to-blue-700', text: 'text-white', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  'tiktok': { bg: 'bg-gradient-to-br from-gray-800 to-black', text: 'text-white', border: 'border-gray-300', lightBg: 'bg-gray-100' },
  'woocommerce': { bg: 'bg-gradient-to-br from-purple-600 to-purple-800', text: 'text-white', border: 'border-purple-200', lightBg: 'bg-purple-50' },
  'shopify': { bg: 'bg-gradient-to-br from-emerald-500 to-green-600', text: 'text-white', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
};

export function Integrations() {
  const { t, dir } = useLanguage();
  const { connections, toggleConnection, updateConnectionSettings, testConnection } = useConnections();
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringGoogle, setDiscoveringGoogle] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const withFallback = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const getConnectionDisplayName = (connection?: Connection) => {
    if (!connection) return 'Integration';
    const translated = t(connection.name);
    return translated === connection.name ? connection.id : translated;
  };

  const handleTikTokConnect = async () => {
    try {
      const response = await fetch(`/api/auth/tiktok/url`);
      if (!response.ok) throw new Error(t('integrations.oauth.getAuthUrlFailed'));
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
      setToast({ message: t('integrations.oauth.tiktokStartFailed'), type: 'error' });
    }
  };

  const handleMetaConnect = async () => {
    try {
      const response = await fetch(`/api/auth/meta/url`);
      if (!response.ok) throw new Error(t('integrations.oauth.getAuthUrlFailed'));
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
      setToast({ message: t('integrations.oauth.metaStartFailed'), type: 'error' });
    }
  };

  const handleGoogleConnect = async (selectDifferentAccount = false) => {
    try {
      const response = await fetch(`/api/auth/google/url?select_account=${selectDifferentAccount ? '1' : '0'}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${t('integrations.oauth.getAuthUrlFailed')}: ${response.status} ${text}`);
      }
      const { url } = await response.json();
      
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
      setToast({ message: `${t('integrations.oauth.googleStartFailed')}: ${err instanceof Error ? err.message : t('common.error')}`, type: 'error' });
    }
  };

  const getDiscoveredGoogleSettings = async (accessToken: string) => {
    const discovery = await fetchGoogleDiscovery(accessToken);
    const discovered = discovery.discovered || {};
    return {
      googleAdsId: discovered.googleAdsId || '',
      ga4PropertyId: discovered.ga4PropertyId || '',
      gscSiteUrl: discovered.gscSiteUrl || '',
      ga4PropertyName: discovered.ga4PropertyName || '',
    };
  };

  const handleGoogleDiscovery = async () => {
    const googleConn = connections.find(c => c.id === 'google');
    const accessToken = formValues.googleAccessToken || googleConn?.settings?.googleAccessToken;
    if (!accessToken) {
      setToast({ message: t('integrations.oauth.googleTokenMissing'), type: 'error' });
      return;
    }

    setDiscoveringGoogle(true);
    try {
      const discoveredSettings = await getDiscoveredGoogleSettings(accessToken);
      const mergedSettings = { ...formValues, ...discoveredSettings };
      setFormValues(mergedSettings);
      await handleSave('google', mergedSettings);
      setToast({ message: t('integrations.oauth.googleScanSuccess'), type: 'success' });
    } catch (err) {
      console.error("Google discovery failed:", err);
      setToast({ message: t('integrations.oauth.googleScanFailed'), type: 'error' });
    } finally {
      setDiscoveringGoogle(false);
    }
  };

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
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
        setToast({ message: t('integrations.oauth.tiktokConnected'), type: 'success' });
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'meta') {
        const { data } = event.data;
        // Update connection settings with the new token
        handleSave('meta', { 
          metaToken: data.access_token,
        });
        setToast({ message: t('integrations.oauth.metaConnected'), type: 'success' });
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'google') {
        const { tokens } = event.data;
        // Update connection settings with tokens and discovered resource IDs
        const tokenSettings = {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || '',
          googleExpiry: (Date.now() + tokens.expires_in * 1000).toString(),
        };

        try {
          const discoveredSettings = await getDiscoveredGoogleSettings(tokens.access_token);
          await handleSave('google', { ...tokenSettings, ...discoveredSettings });
          setToast({ message: t('integrations.oauth.googleConnectedAndSynced'), type: 'success' });
        } catch (err) {
          console.error("Google discovery during OAuth failed:", err);
          await handleSave('google', tokenSettings);
          setToast({ message: t('integrations.oauth.googleConnectedScanFailed'), type: 'error' });
        }
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setToast({ message: event.data.error || t('integrations.oauth.authFailed'), type: 'error' });
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
      setSuccess(t('integrations.success', { name: getConnectionDisplayName(connections.find(c => c.id === id)) }));
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError({ id, message: t('integrations.error', { name: getConnectionDisplayName(connections.find(c => c.id === id)) }) });
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

  const renderQuickGuideContent = (integrationId: string) => {
    const linkClass = "text-amber-700 font-bold underline hover:text-amber-900";

    if (integrationId === 'gemini') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.gemini.step1')}{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className={linkClass}>
              aistudio.google.com/app/apikey
            </a>
          </li>
          <li>{t('integrations.guides.gemini.step2')}</li>
          <li>{t('integrations.guides.gemini.step3')}</li>
        </ul>
      );
    }

    if (integrationId === 'google') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.google.step1')}
          </li>
          <li>
            {t('integrations.guides.google.step2')}{' '}
            <a href="https://ads.google.com/aw/settings/account" target="_blank" rel="noreferrer" className={linkClass}>
              ads.google.com/aw/settings/account
            </a>
          </li>
          <li>
            {t('integrations.guides.google.step3')}{' '}
            <a href="https://analytics.google.com/analytics/web/#/admin" target="_blank" rel="noreferrer" className={linkClass}>
              analytics.google.com/#/admin
            </a>
          </li>
          <li>
            {t('integrations.guides.google.step4')}{' '}
            <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className={linkClass}>
              search.google.com/search-console
            </a>
          </li>
        </ul>
      );
    }

    if (integrationId === 'meta') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.meta.step1')}
          </li>
          <li>
            {t('integrations.guides.meta.step2')}{' '}
            <a href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer" className={linkClass}>
              adsmanager.facebook.com
            </a>
          </li>
          <li>
            {t('integrations.guides.meta.step3')}{' '}
            <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className={linkClass}>
              business.facebook.com/settings
            </a>
          </li>
          <li>
            {t('integrations.guides.meta.step4')}{' '}
            <a href="https://business.facebook.com/events_manager2/list/pixel" target="_blank" rel="noreferrer" className={linkClass}>
              business.facebook.com/events_manager2/list/pixel
            </a>
          </li>
        </ul>
      );
    }

    if (integrationId === 'tiktok') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.tiktok.step1')}
          </li>
          <li>
            {t('integrations.guides.tiktok.step2')}{' '}
            <a href="https://ads.tiktok.com/" target="_blank" rel="noreferrer" className={linkClass}>
              ads.tiktok.com
            </a>
          </li>
          <li>{t('integrations.guides.tiktok.step3')}</li>
          <li>
            {t('integrations.guides.tiktok.step4')}{' '}
            <a href="https://ads.tiktok.com/marketing_api/docs" target="_blank" rel="noreferrer" className={linkClass}>
              ads.tiktok.com/marketing_api/docs
            </a>
          </li>
        </ul>
      );
    }

    if (integrationId === 'woocommerce') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.woocommerce.step1')}{' '}
            <a href="https://woocommerce.com/document/woocommerce-rest-api/" target="_blank" rel="noreferrer" className={linkClass}>
              {t('integrations.guides.woocommerce.docsLabel')}
            </a>
          </li>
          <li>{t('integrations.guides.woocommerce.step2')}</li>
          <li>{t('integrations.guides.woocommerce.step3')}</li>
          <li>{t('integrations.guides.woocommerce.step4')}</li>
        </ul>
      );
    }

    if (integrationId === 'shopify') {
      return (
        <ul className="space-y-1.5 list-disc list-inside">
          <li>
            {t('integrations.guides.shopify.step1')}{' '}
            <a href="https://admin.shopify.com/" target="_blank" rel="noreferrer" className={linkClass}>
              admin.shopify.com
            </a>
          </li>
          <li>{t('integrations.guides.shopify.step2')}</li>
          <li>{t('integrations.guides.shopify.step3')}</li>
          <li>{t('integrations.guides.shopify.step4')}</li>
        </ul>
      );
    }

    return null;
  };

  const getQuickGuideLinks = (integrationId: string): { label: string; url: string }[] => {
    if (integrationId === 'gemini') {
      return [
        { label: 'AI Studio API Keys', url: 'https://aistudio.google.com/app/apikey' },
      ];
    }
    if (integrationId === 'google') {
      return [
        { label: 'Google Ads', url: 'https://ads.google.com/aw/settings/account' },
        { label: 'GA4 Admin', url: 'https://analytics.google.com/analytics/web/#/admin' },
        { label: 'Search Console', url: 'https://search.google.com/search-console' },
      ];
    }
    if (integrationId === 'meta') {
      return [
        { label: 'Ads Manager', url: 'https://adsmanager.facebook.com/' },
        { label: 'Business Settings', url: 'https://business.facebook.com/settings' },
        { label: 'Events Manager', url: 'https://business.facebook.com/events_manager2/list/pixel' },
      ];
    }
    if (integrationId === 'tiktok') {
      return [
        { label: 'TikTok Ads', url: 'https://ads.tiktok.com/' },
        { label: 'TikTok API Docs', url: 'https://ads.tiktok.com/marketing_api/docs' },
      ];
    }
    if (integrationId === 'woocommerce') {
      return [
        { label: 'REST API Docs', url: 'https://woocommerce.com/document/woocommerce-rest-api/' },
      ];
    }
    if (integrationId === 'shopify') {
      return [
        { label: 'Shopify Admin', url: 'https://admin.shopify.com/' },
      ];
    }
    return [];
  };

  const renderIntegrationSettings = (integration: Connection) => {
    const isConnected = integration.status === 'connected';
    const isConnecting = integration.status === 'connecting';

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

              {integration.id === 'google' && (
                <>
                  <div className="sm:col-span-2">
                    <button
                      onClick={() => handleGoogleConnect(false)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-600 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Megaphone className="w-4 h-4" />
                      {isConnected ? t('integrations.reconnectGoogle') : t('integrations.connectGoogle')}
                    </button>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={() => handleGoogleConnect(true)}
                      className="w-full flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-700 py-2 rounded-lg font-bold hover:bg-blue-50 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('integrations.connectGoogleDifferent')}
                    </button>
                  </div>
                  {isConnected && (
                    <div className="sm:col-span-2">
                      <button
                        onClick={handleGoogleDiscovery}
                        disabled={discoveringGoogle}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-all border border-indigo-100 disabled:opacity-60"
                      >
                        {discoveringGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {discoveringGoogle ? t('integrations.scanGoogleInProgress') : t('integrations.scanGoogle')}
                      </button>
                    </div>
                  )}
                  {isConnected && (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.adsAccountId')}</label>
                        <input type="text" placeholder="123-456-7890" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.googleAdsId || ""} onChange={(e) => handleInputChange('googleAdsId', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.ga4PropertyId')}</label>
                        <input type="text" placeholder="123456789 (property ID)" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.ga4PropertyId || formValues.ga4Id || ""} onChange={(e) => handleInputChange('ga4PropertyId', e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.searchConsoleSiteUrl')}</label>
                        <input type="text" placeholder="sc-domain:example.com or https://example.com/" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-left" dir="ltr" value={formValues.gscSiteUrl || ""} onChange={(e) => handleInputChange('gscSiteUrl', e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('integrations.googleAccessToken')}</label>
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
                      {isConnected ? t('integrations.reconnectMeta') : t('integrations.connectMeta')}
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
                      {isConnected ? t('integrations.reconnectTikTok') : t('integrations.connectTikTok')}
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

              {getQuickGuideLinks(integration.id).length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {getQuickGuideLinks(integration.id).map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 bg-white/80 border border-amber-200 rounded-md px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-white"
                    >
                      <span className="truncate">{link.label}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
              
              <div className="text-[10px] text-amber-800/80 leading-tight">
                {renderQuickGuideContent(integration.id)}
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
                <h3 className="text-[13px] font-bold text-gray-900 truncate tracking-tight">{getConnectionDisplayName(integration)}</h3>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
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
          className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center justify-center gap-2"
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
              "fixed bottom-4 sm:bottom-8 left-1/2 z-[100] px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 w-[calc(100vw-1rem)] sm:w-auto sm:min-w-[300px] max-w-[560px] border",
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
              <h3 className="text-sm font-bold text-red-800">
                {t('integrations.error', {
                  name: getConnectionDisplayName(connections.find(i => i.id === error.id))
                })}
              </h3>
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
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{withFallback('integrations.aiEngine', 'AI Engine')}</h2>
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
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{withFallback('integrations.googleWorkspace', 'Google Workspace')}</h2>
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
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{withFallback('integrations.socialMedia', 'Social Media')}</h2>
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
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">{withFallback('integrations.ecommerce', 'E-commerce')}</h2>
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

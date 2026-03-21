"use client";

import React, { useState } from 'react';
import { Plug, ShoppingCart, Store, CheckCircle2, Megaphone, Video, Facebook, AlertCircle, Loader2, X, HelpCircle, ChevronDown, ChevronUp, Sparkles, Settings2, Key, Link as LinkIcon, Plus, Zap, BrainCircuit, RotateCcw, Grid3X3, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useConnections, Connection } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, onAuthStateChanged } from '../lib/firebase';
import { OverviewTab } from './integrations/OverviewTab';
import { GoogleTab } from './integrations/GoogleTab';
import { MetaTab } from './integrations/MetaTab';
import { TikTokTab } from './integrations/TikTokTab';
import { EcommerceTab } from './integrations/EcommerceTab';
import { ConnectionWizard } from './integrations/ConnectionWizard';
import { IntegrationSettingsPanel } from './integrations/IntegrationSettingsPanel';
import type {
  ManagedGoogleAdsAccount,
  MetaAssetsPayload,
} from './integrations/integrationUtils';
import {
  parseManagedGoogleAdsAccounts,
  formatGoogleAdsAccountId,
  normalizeMetaAccountId,
  normalizeGoogleAdsAccountId,
} from './integrations/integrationUtils';

const viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? undefined)
    : undefined;
const configuredApiBase = (typeof viteEnv?.VITE_APP_URL === 'string' && viteEnv.VITE_APP_URL.trim()) || '';
const API_BASE = (() => {
  if (!configuredApiBase || typeof window === 'undefined') return '';
  try {
    const configuredOrigin = new URL(configuredApiBase, window.location.origin).origin;
    return configuredOrigin === window.location.origin ? configuredOrigin : '';
  } catch {
    return '';
  }
})();


const getActiveAccountSummary = (integration: Connection): string | null => {
  const settings = integration.settings || {};

  if (integration.id === 'google') {
    const managedAccounts = parseManagedGoogleAdsAccounts(settings.googleAdsAccounts);
    const selected = managedAccounts.find((account) => account.isSelected) || managedAccounts[0];
    if (selected?.externalAccountId) {
      const formatted = formatGoogleAdsAccountId(selected.externalAccountId);
      return selected.name ? `${selected.name} (${formatted})` : formatted;
    }
    if (settings.googleAdsId) {
      return formatGoogleAdsAccountId(settings.googleAdsId);
    }
    return null;
  }

  if (integration.id === 'meta') {
    const id = String(settings.metaAdsId || '').trim();
    return id || null;
  }

  if (integration.id === 'tiktok') {
    const id = String(settings.tiktokAdvertiserId || '').trim();
    return id || null;
  }

  if (integration.id === 'woocommerce' || integration.id === 'shopify') {
    const storeUrl = String(settings.storeUrl || '').trim();
    return storeUrl || null;
  }

  return null;
};

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

type WizardPlatform = 'google' | 'meta' | 'tiktok' | 'woocommerce' | 'shopify';
type WizardStep = 1 | 2 | 3;

type WizardField = {
  key: string;
  labelHe: string;
  labelEn: string;
  placeholder: string;
  required?: boolean;
  type?: 'text' | 'password' | 'url';
};

type WizardDraft = {
  platform: WizardPlatform;
  step: WizardStep;
  values: Record<string, string>;
  completedPlatforms: WizardPlatform[];
  updatedAt: number;
};

const WIZARD_STORAGE_PREFIX = 'bscale.integrations.wizardDraft';

const WIZARD_PLATFORM_OPTIONS: Array<{ id: WizardPlatform; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'meta', label: 'Meta' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'woocommerce', label: 'WooCommerce' },
  { id: 'shopify', label: 'Shopify' },
];

const WIZARD_FIELDS: Record<WizardPlatform, WizardField[]> = {
  google: [
    { key: 'googleAdsId', labelHe: 'מזהה חשבון מודעות', labelEn: 'Ads account ID', placeholder: '123-456-7890', required: true },
    { key: 'loginCustomerId', labelHe: 'Login Customer ID', labelEn: 'Login Customer ID', placeholder: '123-456-7890' },
    { key: 'ga4Id', labelHe: 'GA4 Property ID', labelEn: 'GA4 Property ID', placeholder: '123456789' },
    { key: 'siteUrl', labelHe: 'Site URL ל-GSC', labelEn: 'Site URL for GSC', placeholder: 'https://example.com', type: 'url' },
    { key: 'googleAccessToken', labelHe: 'Google Access Token', labelEn: 'Google Access Token', placeholder: 'ya29...' },
  ],
  meta: [
    { key: 'metaAdsId', labelHe: 'מזהה חשבון מודעות', labelEn: 'Ads account ID', placeholder: 'act_123456789', required: true },
    { key: 'pixelId', labelHe: 'Pixel ID', labelEn: 'Pixel ID', placeholder: '123456789012345', required: true },
    { key: 'businessId', labelHe: 'Business Manager ID', labelEn: 'Business Manager ID', placeholder: '112233445566778' },
    { key: 'metaToken', labelHe: 'Meta Access Token', labelEn: 'Meta Access Token', placeholder: 'EAAB...' },
  ],
  tiktok: [
    { key: 'tiktokAdvertiserId', labelHe: 'Advertiser ID', labelEn: 'Advertiser ID', placeholder: '7012345678901234567', required: true },
    { key: 'tiktokPixelId', labelHe: 'Pixel ID', labelEn: 'Pixel ID', placeholder: 'TT-PIXEL-123' },
  ],
  woocommerce: [
    { key: 'storeUrl', labelHe: 'כתובת החנות', labelEn: 'Store URL', placeholder: 'https://mystore.com', type: 'url', required: true },
    { key: 'wooKey', labelHe: 'Consumer Key', labelEn: 'Consumer Key', placeholder: 'ck_...', required: true },
    { key: 'wooSecret', labelHe: 'Consumer Secret', labelEn: 'Consumer Secret', placeholder: 'cs_...', required: true, type: 'password' },
  ],
  shopify: [
    { key: 'storeUrl', labelHe: 'כתובת החנות', labelEn: 'Store URL', placeholder: 'https://mystore.myshopify.com', type: 'url', required: true },
    { key: 'shopifyToken', labelHe: 'Admin API Access Token', labelEn: 'Admin API Access Token', placeholder: 'shpat_...', required: true, type: 'password' },
  ],
};

export function Integrations({ userProfile }: { userProfile?: { role?: string; subscriptionStatus?: string } | null }) {
  const isAdmin = userProfile?.role === 'admin';
  const isDemo = userProfile?.subscriptionStatus === 'demo';
  const { t, dir, language } = useLanguage();
  const {
    connections,
    dataOwnerUid,
    updateConnectionSettings,
    clearConnectionSettings,
    resetAllConnections,
    testConnection,
    migrateAiConnectionsFromUser,
    isWorkspaceReadOnly,
  } = useConnections();
  type TabId = 'overview' | 'google' | 'meta' | 'tiktok' | 'whatsapp' | 'more';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [metaAssets, setMetaAssets] = useState<MetaAssetsPayload | null>(null);
  const [metaAssetsLoading, setMetaAssetsLoading] = useState(false);
  const [metaAssetsError, setMetaAssetsError] = useState<string | null>(null);
  const [tiktokAccounts, setTiktokAccounts] = useState<Array<{ externalAccountId: string; name?: string }>>([]);
  const [tiktokAccountsLoading, setTiktokAccountsLoading] = useState(false);
  const [tiktokAccountsError, setTiktokAccountsError] = useState<string | null>(null);
  const [reinstallingManagedPlatform, setReinstallingManagedPlatform] = useState<
    'google' | 'meta' | 'tiktok' | null
  >(null);
  const [reinstallingGoogleAndMeta, setReinstallingGoogleAndMeta] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardPlatform, setWizardPlatform] = useState<WizardPlatform>('google');
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardValues, setWizardValues] = useState<Record<string, string>>({
    wizardBusinessName: '',
    wizardMainGoal: '',
    wizardNotes: '',
  });
  const [wizardResumeAvailable, setWizardResumeAvailable] = useState(false);
  const [wizardLastSavedAt, setWizardLastSavedAt] = useState<number | null>(null);
  const [wizardLoadedStorageKey, setWizardLoadedStorageKey] = useState<string | null>(null);
  const blockIfReadOnly = (): boolean => {
    if (!isWorkspaceReadOnly) return false;
    setToast({
      message:
        languageSafeText(t('integrations.readOnlyWorkspace'), 'Workspace is view only for this user.'),
      type: 'error',
    });
    setTimeout(() => setToast(null), 3000);
    return true;
  };
  const languageSafeText = (value: string, fallback: string) => (value && value !== 'integrations.readOnlyWorkspace' ? value : fallback);
  const isHebrew = language === 'he';
  const wizardStorageKey = `${WIZARD_STORAGE_PREFIX}:${dataOwnerUid || 'default'}`;

  const getConnectionSettingsById = (id: string): Record<string, string> => {
    return connections.find((c) => c.id === id)?.settings || {};
  };

  const isWizardPlatformDone = (platform: WizardPlatform, sourceSettings?: Record<string, string>) => {
    const connection = connections.find((c) => c.id === platform);
    const settings = sourceSettings || connection?.settings || {};
    const required = WIZARD_FIELDS[platform].filter((field) => field.required);
    const requiredComplete = required.every((field) => String(settings[field.key] || '').trim());
    const anyFieldFilled = Object.keys(settings).some((key) => String(settings[key] || '').trim());
    return Boolean(connection?.status === 'connected' || requiredComplete || anyFieldFilled);
  };

  const isWizardValuesMeaningful = (values: Record<string, string>) => {
    const nonEmptyKeys = Object.keys(values).filter((key) => String(values[key] || '').trim());
    return nonEmptyKeys.length > 0;
  };

  const clearWizardDraft = () => {
    try {
      localStorage.removeItem(wizardStorageKey);
    } catch (err) {
      console.error('Failed to clear wizard draft:', err);
    }
    setWizardResumeAvailable(false);
    setWizardLastSavedAt(null);
    setWizardStep(1);
    setWizardPlatform('google');
    setWizardValues({
      wizardBusinessName: '',
      wizardMainGoal: '',
      wizardNotes: '',
    });
  };

  const pauseWizardForLater = () => {
    setIsWizardOpen(false);
    setWizardResumeAvailable(true);
    setToast({
      message: isHebrew ? 'ההתקדמות נשמרה. אפשר להמשיך מהנקודה הזו בהמשך.' : 'Progress saved. You can continue from this point later.',
      type: 'success',
    });
    setTimeout(() => setToast(null), 3000);
  };

  const resumeWizard = () => {
    if (blockIfReadOnly()) return;
    setIsWizardOpen(true);
  };

  const wizardPlatforms = React.useMemo(
    () => WIZARD_PLATFORM_OPTIONS.map((platform) => platform.id),
    []
  );
  const completedWizardPlatforms = React.useMemo(
    () => wizardPlatforms.filter((platform) => isWizardPlatformDone(platform)),
    [wizardPlatforms, connections]
  );
  const wizardCompletedCount = completedWizardPlatforms.length;
  const wizardTotalCount = wizardPlatforms.length;
  const wizardHasPendingPlatforms = wizardCompletedCount < wizardTotalCount;
  const wizardProgressPercent = Math.round((wizardCompletedCount / Math.max(wizardTotalCount, 1)) * 100);
  const wizardLastSavedLabel = wizardLastSavedAt
    ? new Date(wizardLastSavedAt).toLocaleString(isHebrew ? 'he-IL' : 'en-US')
    : null;

  const openConnectionWizard = (platform: WizardPlatform) => {
    if (blockIfReadOnly()) return;
    const base = getConnectionSettingsById(platform);
    setWizardPlatform(platform);
    setWizardStep(1);
    setWizardValues((prev) => ({
      wizardBusinessName: prev.wizardBusinessName || '',
      wizardMainGoal: prev.wizardMainGoal || '',
      wizardNotes: prev.wizardNotes || '',
      ...base,
    }));
    setIsWizardOpen(true);
  };

  const handleWizardInput = (key: string, value: string) => {
    setWizardValues((prev) => ({ ...prev, [key]: value }));
  };

  const runOAuthForWizard = async () => {
    if (wizardPlatform === 'google') {
      await handleGoogleConnect();
      return;
    }
    if (wizardPlatform === 'meta') {
      await handleMetaConnect();
      return;
    }
    if (wizardPlatform === 'tiktok') {
      await handleTikTokConnect();
    }
  };

  const validateWizardStep = (): boolean => {
    if (wizardStep === 1) {
      if (!wizardValues.wizardBusinessName?.trim()) {
        setToast({
          message: isHebrew ? 'יש להזין שם עסק/חשבון לחיבור.' : 'Please enter business/account name.',
          type: 'error',
        });
        return false;
      }
      return true;
    }

    if (wizardStep === 2) {
      const missingRequired = WIZARD_FIELDS[wizardPlatform].filter(
        (field) => field.required && !String(wizardValues[field.key] || '').trim()
      );
      if (missingRequired.length > 0) {
        setToast({
          message: isHebrew
            ? 'חסרים פרטי נכסים נדרשים לחיבור (כמו חשבון מודעות/פיקסל).'
            : 'Missing required asset details (e.g. ad account / pixel).',
          type: 'error',
        });
        return false;
      }
    }
    return true;
  };

  const handleWizardNext = () => {
    if (!validateWizardStep()) return;
    setWizardStep((prev) => (prev < 3 ? ((prev + 1) as WizardStep) : prev));
  };

  const handleWizardBack = () => {
    setWizardStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));
  };

  const handleWizardSubmit = async () => {
    if (blockIfReadOnly()) return;
    if (!validateWizardStep()) return;
    setWizardSaving(true);
    try {
      const payload: Record<string, string> = {
        ...getConnectionSettingsById(wizardPlatform),
        ...wizardValues,
      };
      await handleSave(wizardPlatform, payload);
      setIsWizardOpen(false);
      setWizardStep(1);
      setWizardResumeAvailable(true);
      setWizardLastSavedAt(Date.now());
      setToast({
        message: isHebrew
          ? 'שאלון ההתחברות הושלם והנכסים נשמרו לחיבור.'
          : 'Connection questionnaire completed and assets were saved.',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        message: isHebrew
          ? 'שמירת שאלון ההתחברות נכשלה. נסה שוב.'
          : 'Failed saving connection questionnaire. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setWizardSaving(false);
    }
  };

  React.useEffect(() => {
    if (wizardLoadedStorageKey === wizardStorageKey) return;
    setWizardLoadedStorageKey(wizardStorageKey);
    setWizardStep(1);
    setWizardPlatform('google');
    setWizardValues({
      wizardBusinessName: '',
      wizardMainGoal: '',
      wizardNotes: '',
    });
    setWizardLastSavedAt(null);
    try {
      const raw = localStorage.getItem(wizardStorageKey);
      if (!raw) {
        setWizardResumeAvailable(false);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WizardDraft>;
      const parsedPlatform = parsed.platform;
      const parsedStep = parsed.step;
      const parsedValues = parsed.values;
      const platformIsValid = parsedPlatform && WIZARD_PLATFORM_OPTIONS.some((item) => item.id === parsedPlatform);
      const stepIsValid = parsedStep === 1 || parsedStep === 2 || parsedStep === 3;
      if (platformIsValid) {
        setWizardPlatform(parsedPlatform);
      }
      if (stepIsValid) {
        setWizardStep(parsedStep);
      }
      if (parsedValues && typeof parsedValues === 'object') {
        setWizardValues((prev) => ({ ...prev, ...parsedValues }));
        setWizardResumeAvailable(isWizardValuesMeaningful(parsedValues));
      }
      if (typeof parsed.updatedAt === 'number') {
        setWizardLastSavedAt(parsed.updatedAt);
      }
    } catch (err) {
      console.error('Failed to hydrate wizard draft:', err);
      setWizardResumeAvailable(false);
    }
  }, [wizardStorageKey, wizardLoadedStorageKey]);

  React.useEffect(() => {
    const draft: WizardDraft = {
      platform: wizardPlatform,
      step: wizardStep,
      values: wizardValues,
      completedPlatforms: completedWizardPlatforms,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(wizardStorageKey, JSON.stringify(draft));
      setWizardLastSavedAt(draft.updatedAt);
      setWizardResumeAvailable(isWizardValuesMeaningful(wizardValues) || completedWizardPlatforms.length > 0);
    } catch (err) {
      console.error('Failed to persist wizard draft:', err);
    }
  }, [wizardPlatform, wizardStep, wizardValues, completedWizardPlatforms, wizardStorageKey]);

  const handleMigrateAi = async () => {
    if (blockIfReadOnly()) return;
    try {
      const result = await migrateAiConnectionsFromUser();
      setToast({ message: result.message, type: result.success ? 'success' : 'error' });
    } catch (err) {
      setToast({ message: t('common.error'), type: 'error' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const bootstrapManagedSession = async (timeoutMs = 3000): Promise<boolean> => {
    // Fast-path: if the server session cookie is already valid, skip bootstrap.
    try {
      const sessionCheck = await fetch(`${API_BASE}/api/connections`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (sessionCheck.ok) return true;
    } catch {
      // Ignore network errors and proceed to re-bootstrap below.
    }

    // Wait for Firebase auth to initialize before reading currentUser.
    // A plain auth.currentUser check races with Firebase's async initialization
    // and returns null immediately after a redirect, causing 401s on the next API call.
    const currentUser =
      auth.currentUser ||
      (await new Promise<import('firebase/auth').User | null>((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          unsubscribe();
          resolve(auth.currentUser);
        }, timeoutMs);
        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve(nextUser);
        });
      }));
    if (!currentUser) return false;
    // Force-refresh the Firebase ID token to avoid using a stale cached token.
    const idToken = await currentUser.getIdToken(true);
    const bootstrapRes = await fetch(`${API_BASE}/api/auth/session/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    return bootstrapRes.ok;
  };

  const persistManagedGoogleSelection = async (googleAdsId: string) => {
    const normalizedId = normalizeGoogleAdsAccountId(googleAdsId);
    if (!normalizedId) return;
    await bootstrapManagedSession();
    await fetch(`${API_BASE}/api/connections/google-ads/select-accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountIds: [normalizedId] }),
    });
  };

  const loadManagedTikTokAccounts = async (seedValues?: Record<string, string>) => {
    await bootstrapManagedSession();
    setTiktokAccountsLoading(true);
    setTiktokAccountsError(null);
    try {
      let response = await fetch(`${API_BASE}/api/connections/tiktok/accounts`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      // If the session was not yet ready (e.g. right after an OAuth redirect),
      // re-bootstrap with a longer timeout and retry once.
      if (response.status === 401) {
        await bootstrapManagedSession(8000);
        response = await fetch(`${API_BASE}/api/connections/tiktok/accounts`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
      }
      const payload = await response.json() as { success?: boolean; message?: string; data?: { accounts?: Array<{ externalAccountId: string; name?: string }> } };
      if (!response.ok || !payload?.success) {
        setTiktokAccountsError(payload?.message || 'Failed to load TikTok advertiser accounts.');
        return;
      }
      const accounts = payload?.data?.accounts ?? [];
      setTiktokAccounts(accounts);
      if (!accounts.length) return;
      setFormValues((prev) => {
        const source = seedValues || prev;
        if (String(source.tiktokAdvertiserId || '').trim()) return prev;
        // Auto-fill the first discovered advertiser ID.
        return { ...prev, tiktokAdvertiserId: accounts[0].externalAccountId };
      });
    } catch (err) {
      setTiktokAccountsError(err instanceof Error ? err.message : 'Failed to load TikTok advertiser accounts.');
    } finally {
      setTiktokAccountsLoading(false);
    }
  };

  const persistManagedTikTokSelection = async (advertiserId: string) => {
    const id = String(advertiserId || '').trim();
    if (!id) return;
    await bootstrapManagedSession();
    await fetch(`${API_BASE}/api/connections/tiktok/select-accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountIds: [id] }),
    });
  };

  const loadManagedMetaAssets = async (seedValues?: Record<string, string>) => {
    await bootstrapManagedSession();
    setMetaAssetsLoading(true);
    setMetaAssetsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/connections/meta/assets`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      const text = await response.text();
      let payload:
        | {
            success?: boolean;
            message?: string;
            data?: MetaAssetsPayload;
          }
        | null = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.message || `Failed to load Meta assets (${response.status}).`);
      }

      const assets = payload.data;
      setMetaAssets(assets);

      setFormValues((prev) => {
        const source = seedValues || prev;
        const next = { ...prev };
        if (!String(source.metaAdsId || '').trim() && assets.defaultAdAccountId) {
          next.metaAdsId = assets.defaultAdAccountId;
        }
        if (!String(source.businessId || '').trim() && assets.defaultBusinessId) {
          next.businessId = assets.defaultBusinessId;
        }
        if (!String(source.messageAccountId || '').trim() && assets.defaultMessageAccountId) {
          next.messageAccountId = assets.defaultMessageAccountId;
        }
        if (!String(source.pixelId || '').trim() && assets.defaultPixelId) {
          next.pixelId = assets.defaultPixelId;
        }
        return next;
      });
    } catch (err) {
      setMetaAssets(null);
      setMetaAssetsError(err instanceof Error ? err.message : 'Failed to load Meta assets.');
    } finally {
      setMetaAssetsLoading(false);
    }
  };

  const startManagedOAuth = async (
    platformSlug: 'google-ads' | 'meta' | 'tiktok',
    failureMessage: string
  ) => {
    await bootstrapManagedSession();

    const parsePayload = async (
      response: Response
    ): Promise<
      | {
          success?: boolean;
          message?: string;
          errorCode?: string;
          data?: { authorizationUrl?: string };
        }
      | null
    > => {
      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    };

    // Start with GET to avoid method rewrite edge-cases behind domain redirects/proxies.
    let response = await fetch(`${API_BASE}/api/connections/${platformSlug}/start`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    let payload = await parsePayload(response);

    if (response.status === 405) {
      response = await fetch(`${API_BASE}/api/connections/${platformSlug}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      payload = await parsePayload(response);
    }

    if (!response.ok || !payload?.success || !payload?.data?.authorizationUrl) {
      const detailedMessage = payload?.message || `${failureMessage} (${response.status})`;
      throw new Error(detailedMessage);
    }

    window.location.assign(payload.data.authorizationUrl);
  };

  const handleTikTokConnect = async () => {
    if (blockIfReadOnly()) return;
    try {
      await startManagedOAuth('tiktok', 'Failed to start TikTok authentication');
    } catch (err) {
      console.error("Failed to get TikTok auth URL:", err);
      setToast({ message: err instanceof Error && err.message ? err.message : 'Failed to start TikTok authentication', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleMetaConnect = async () => {
    if (blockIfReadOnly()) return;
    try {
      await startManagedOAuth('meta', 'Failed to start Meta authentication');
    } catch (err) {
      console.error("Failed to get Meta auth URL:", err);
      setToast({ message: err instanceof Error && err.message ? err.message : 'Failed to start Meta authentication', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleGoogleConnect = async () => {
    if (blockIfReadOnly()) return;
    try {
      await startManagedOAuth('google-ads', 'Failed to start Google authentication');
    } catch (err) {
      console.error("Failed to get Google auth URL:", err);
      setToast({ message: err instanceof Error && err.message ? err.message : 'Failed to start Google authentication', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleReinstallManagedConnection = async (platform: 'google' | 'meta' | 'tiktok') => {
    if (blockIfReadOnly()) return;

    const confirmMessage =
      platform === 'google'
        ? isHebrew
          ? 'לבצע התקנה מחדש לחיבור Google? הפעולה תנתק את החיבור הנוכחי (Ads/GA4/GSC/Gmail) ותפתח התחברות מחדש.'
          : 'Re-install Google connection? This will disconnect the current Google link (Ads/GA4/GSC/Gmail) and start OAuth again.'
        : platform === 'meta'
        ? isHebrew
          ? 'לבצע התקנה מחדש לחיבור Meta? הפעולה תנתק את החיבור הנוכחי ותפתח התחברות מחדש.'
          : 'Re-install Meta connection? This will disconnect the current Meta link and start OAuth again.'
        : isHebrew
        ? 'לבצע התקנה מחדש לחיבור TikTok? הפעולה תנתק את החיבור הנוכחי ותפתח התחברות מחדש.'
        : 'Re-install TikTok connection? This will disconnect the current TikTok link and start OAuth again.';

    if (!window.confirm(confirmMessage)) return;

    setError(null);
    setSuccess(null);
    setReinstallingManagedPlatform(platform);
    try {
      await clearConnectionSettings(platform);
      setExpandedId(null);
      setFormValues({});

      if (platform === 'google') {
        await startManagedOAuth('google-ads', 'Failed to start Google authentication');
      } else if (platform === 'meta') {
        await startManagedOAuth('meta', 'Failed to start Meta authentication');
      } else {
        await startManagedOAuth('tiktok', 'Failed to start TikTok authentication');
      }
    } catch (err) {
      setToast({
        message:
          err instanceof Error && err.message
            ? err.message
            : isHebrew
            ? 'התקנה מחדש נכשלה. נסה שוב.'
            : 'Re-install failed. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setReinstallingManagedPlatform(null);
    }
  };

  const handleReinstallGoogleAndMeta = async () => {
    if (blockIfReadOnly()) return;

    const confirmMessage = isHebrew
      ? 'לבצע התקנה מחדש גם ל-Google וגם ל-Meta? הפעולה תמחק את החיבורים הקיימים ותתחיל התחברות מחדש.'
      : 'Re-install both Google and Meta? This will delete existing connections and start OAuth setup again.';

    if (!window.confirm(confirmMessage)) return;

    setError(null);
    setSuccess(null);
    setReinstallingGoogleAndMeta(true);
    try {
      await clearConnectionSettings('google');
      await clearConnectionSettings('meta');
      setExpandedId(null);
      setFormValues({});

      setToast({
        message: isHebrew
          ? 'החיבורים הישנים נמחקו. ממשיך להתחברות Google מחדש...'
          : 'Previous connections deleted. Continuing with Google re-authentication...',
        type: 'success',
      });

      await startManagedOAuth('google-ads', 'Failed to start Google authentication');
    } catch (err) {
      setToast({
        message:
          err instanceof Error && err.message
            ? err.message
            : isHebrew
            ? 'התקנה מחדש ל-Google+Meta נכשלה. נסה שוב.'
            : 'Google+Meta re-install failed. Please retry.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setReinstallingGoogleAndMeta(false);
    }
  };

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('connected');
    const errorMessage = url.searchParams.get('error');

    if (!connected && !errorMessage) return;

    if (connected === '1') {
      setToast({
        message: isHebrew ? 'החיבור הושלם בהצלחה.' : 'Connection completed successfully.',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3000);
    } else if (errorMessage) {
      setToast({ message: errorMessage, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }

    url.searchParams.delete('connected');
    url.searchParams.delete('error');
    url.searchParams.delete('platform');
    const nextQuery = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}${url.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [isHebrew]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Simple origin check for development and production
      const isAllowedOrigin = event.origin.includes(window.location.hostname) || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('.run.app');
      
      if (!isAllowedOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'meta') {
        const { data } = event.data;
        // Update connection settings with the new token
        handleSave('meta', { 
          metaToken: data.access_token,
        });
        setWizardValues((prev) => ({ ...prev, metaToken: data.access_token || '' }));
        setToast({ message: "Successfully connected to Meta Ads!", type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.platform === 'google') {
        const { tokens } = event.data;
        // Update connection settings with the new tokens
        handleSave('google', { 
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || '',
          googleExpiry: (Date.now() + tokens.expires_in * 1000).toString(),
        });
        setWizardValues((prev) => ({
          ...prev,
          googleAccessToken: tokens.access_token || '',
          googleRefreshToken: tokens.refresh_token || '',
        }));
        setToast({ message: t('integrations.googleEcosystemConnected'), type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setToast({ message: event.data.error || "TikTok authentication failed", type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [formValues]);

  const handleExpand = (integration: Connection) => {
    if (isWorkspaceReadOnly) return;
    if (expandedId === integration.id) {
      setExpandedId(null);
    } else {
      setExpandedId(integration.id);
      setFormValues(integration.settings || {});
      setSuccess(null);
      if (integration.id === 'meta' && integration.status === 'connected') {
        void loadManagedMetaAssets(integration.settings || {});
      } else {
        setMetaAssets(null);
        setMetaAssetsError(null);
      }
      if (integration.id === 'tiktok' && integration.status === 'connected') {
        void loadManagedTikTokAccounts(integration.settings || {});
      } else {
        setTiktokAccounts([]);
        setTiktokAccountsError(null);
      }
    }
  };

  const handleInputChange = (key: string, value: string) => {
    if (isWorkspaceReadOnly) return;
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (id: string, overrideSettings?: Record<string, string>) => {
    if (blockIfReadOnly()) return;
    setError(null);
    setSuccess(null);
    const settingsToSave = overrideSettings || formValues;
    try {
      // Show a more realistic verification process
      await updateConnectionSettings(id, settingsToSave);
      if (id === 'tiktok' && settingsToSave.tiktokAdvertiserId) {
        try {
          await persistManagedTikTokSelection(settingsToSave.tiktokAdvertiserId);
        } catch (selectionError) {
          console.warn('Failed to persist TikTok advertiser selection:', selectionError);
        }
      }
      if (id === 'google' && settingsToSave.googleAdsId) {
        try {
          await persistManagedGoogleSelection(settingsToSave.googleAdsId);
        } catch (selectionError) {
          setToast({
            message:
              language === 'he'
                ? 'החיבור נשמר, אך בחירת חשבון ברירת המחדל ל-Google Ads נכשלה. נסה שוב.'
                : 'Connection was saved, but default Google Ads account selection failed. Please retry.',
            type: 'error',
          });
          setTimeout(() => setToast(null), 3500);
          console.warn('Failed to persist managed Google Ads selection:', selectionError);
        }
      }
      setExpandedId(null);
      const connectionName = connections.find((c) => c.id === id)?.name || '';
      const successTemplate = t('integrations.success');
      setSuccess(
        successTemplate.includes('{{name}}')
          ? successTemplate.replace('{{name}}', connectionName)
          : `${successTemplate} ${connectionName}`.trim()
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const connectionName = connections.find((c) => c.id === id)?.name || '';
      const errorTemplate = t('integrations.error');
      setError({
        id,
        message: errorTemplate.includes('{{name}}')
          ? errorTemplate.replace('{{name}}', connectionName)
          : `${errorTemplate} ${connectionName}`.trim(),
      });
    }
  };

  const handleTest = async (id: string) => {
    if (blockIfReadOnly()) return;
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
        }, 3000);
      } else {
        setError({ id, message: result.message });
        setToast({ message: result.message, type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      setError({ id, message: t('common.error') });
      setToast({ message: t('common.error'), type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setTestingId(null);
    }
  };

  const handleHardResetConnection = async (id: string) => {
    if (blockIfReadOnly()) return;
    const confirmDelete = window.confirm(
      isHebrew
        ? 'למחוק את החיבור וההגדרות שנשמרו לפלטפורמה זו?'
        : 'Delete this connection and its saved settings?'
    );
    if (!confirmDelete) return;

    setError(null);
    setSuccess(null);
    try {
      await clearConnectionSettings(id);
      setExpandedId(id);
      setFormValues({});
      setToast({
        message: isHebrew ? 'החיבור אופס בהצלחה.' : 'Connection reset successfully.',
        type: 'success',
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error && err.message
            ? err.message
            : isHebrew
            ? 'איפוס החיבור נכשל. נסה שוב.'
            : 'Failed to reset connection. Please retry.',
        type: 'error',
      });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const renderIntegrationSettings = (integration: Connection) => (
    <IntegrationSettingsPanel
      integration={integration}
      isDemo={isDemo}
      isAdmin={isAdmin}
      isHebrew={isHebrew}
      language={language}
      dir={dir}
      formValues={formValues}
      testingId={testingId}
      reinstallingManagedPlatform={reinstallingManagedPlatform}
      reinstallingGoogleAndMeta={reinstallingGoogleAndMeta}
      metaAssets={metaAssets}
      metaAssetsLoading={metaAssetsLoading}
      metaAssetsError={metaAssetsError}
      tiktokAccounts={tiktokAccounts}
      tiktokAccountsLoading={tiktokAccountsLoading}
      tiktokAccountsError={tiktokAccountsError}
      onClose={() => setExpandedId(null)}
      onInputChange={handleInputChange}
      onSave={handleSave}
      onTest={handleTest}
      onHardReset={handleHardResetConnection}
      onMigrateAi={handleMigrateAi}
      onGoogleConnect={handleGoogleConnect}
      onMetaConnect={handleMetaConnect}
      onTikTokConnect={handleTikTokConnect}
      onReinstallPlatform={handleReinstallManagedConnection}
      onLoadMetaAssets={loadManagedMetaAssets}
      onLoadTikTokAccounts={loadManagedTikTokAccounts}
      onClearConnectionSettings={clearConnectionSettings}
      onSetFormValues={setFormValues}
      onSetToast={setToast}
      t={t}
    />
  );

  const renderConnectionCard = (integration: Connection) => {
    const isConnected = integration.status === 'connected';
    const isConnecting = integration.status === 'connecting';
    const hasError = integration.status === 'error';
    const Icon = iconMap[integration.id] || Plug;
    const isExpanded = expandedId === integration.id;
    const supportsWizard = Object.prototype.hasOwnProperty.call(WIZARD_FIELDS, integration.id);
    const brand = brandStyles[integration.id] || { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-200', lightBg: 'bg-gray-50' };
    const activeAccountSummary = getActiveAccountSummary(integration);
    
    return (
      <motion.div 
        layout
        key={integration.id} 
        className={cn(
          "bg-white rounded-2xl border-2 transition-all duration-300 flex flex-col overflow-hidden group relative shadow-sm hover:shadow-xl",
          isConnected ? "border-emerald-200 shadow-emerald-100/50" : 
          hasError ? "border-red-200 shadow-red-100/50" : "border-gray-200/80 hover:border-indigo-200",
          isExpanded && "ring-2 ring-indigo-400 ring-offset-2 border-indigo-300 shadow-xl md:col-span-2"
        )}
      >
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 shadow-md transition-transform duration-300 group-hover:scale-105",
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
                    <span className="inline-flex items-center text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{t('integrations.disconnected')}</span>
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

            {!isExpanded && !(integration.category === 'AI Engine' && !isAdmin) && (
              <div className="shrink-0 flex items-center gap-2">
                {supportsWizard && (
                  <button
                    onClick={() => openConnectionWizard(integration.id as WizardPlatform)}
                    disabled={isConnecting}
                    title={isHebrew ? 'פתח שאלון נכסים' : 'Open assets questionnaire'}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-50 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => handleExpand(integration)}
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 font-bold text-sm",
                    isConnected
                      ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                      : hasError
                      ? "text-red-600 bg-red-50 hover:bg-red-100"
                      : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
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
                  "h-full rounded-full",
                  integration.score >= 90 ? "bg-emerald-500" :
                  integration.score >= 70 ? "bg-amber-500" :
                  "bg-red-500"
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
                  {renderIntegrationSettings(integration)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  const aiConnections = connections.filter(c => c.category === 'AI Engine');
  const googleConnections = connections.filter(c => c.category === 'Google');
  const socialConnections = connections.filter(c => c.category === 'Social');
  const metaConnections = socialConnections.filter(c => c.id === 'meta');
  const tiktokConnections = socialConnections.filter(c => c.id === 'tiktok');
  const ecommerceConnections = connections.filter(c => c.category === 'E-commerce');
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const aiConnectedCount = aiConnections.filter((connection) => connection.status === 'connected').length;
  const expandedAiConnection = aiConnections.find((connection) => connection.id === expandedId) || null;
  const wizardFields = WIZARD_FIELDS[wizardPlatform];
  const wizardConnection = connections.find((c) => c.id === wizardPlatform);
  const oauthTokenKey: Record<WizardPlatform, string | null> = {
    google: 'googleAccessToken',
    meta: 'metaToken',
    tiktok: null, // Token is stored server-side via OAuth, not in client settings.
    woocommerce: null,
    shopify: null,
  };
  const oauthSupportedPlatforms: WizardPlatform[] = ['google', 'meta', 'tiktok'];
  const oauthSupported = oauthSupportedPlatforms.includes(wizardPlatform);
  const activeOauthTokenKey = oauthTokenKey[wizardPlatform];
  const hasOauthToken = activeOauthTokenKey
    ? Boolean(wizardValues[activeOauthTokenKey] || wizardConnection?.settings?.[activeOauthTokenKey])
    : true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Hero Header */}
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
                onClick={() => {
                  if (wizardResumeAvailable) {
                    resumeWizard();
                    return;
                  }
                  openConnectionWizard('google');
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-sm hover:bg-white/30 transition-all"
              >
                <Settings2 className="w-4 h-4" />
                {wizardResumeAvailable
                  ? (isHebrew ? 'חזרה מהירה לאשף' : 'Quick return to wizard')
                  : (isHebrew ? 'שאלון התחברות לנכסים' : 'Assets connection wizard')}
              </button>
              <button
                onClick={() => {
                  const connected = connections.filter(c => c.status === 'connected');
                  connected.forEach(c => handleTest(c.id));
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('integrations.testAll')}
              </button>
              <button
                onClick={async () => {
                  if (window.confirm(t('integrations.resetAllConfirm'))) {
                    try {
                      await resetAllConnections();
                      setExpandedId(null);
                      setFormValues({});
                      setToast({ message: t('integrations.resetAllDone'), type: 'success' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (err) {
                      setToast({
                        message:
                          err instanceof Error && err.message
                            ? err.message
                            : isHebrew
                            ? 'איפוס כולל נכשל. נסה שוב.'
                            : 'Failed to reset all connections. Please retry.',
                        type: 'error',
                      });
                      setTimeout(() => setToast(null), 3500);
                    }
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-sm hover:bg-white/30 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                {t('integrations.resetAll')}
              </button>
              <button
                onClick={() => {
                  void handleReinstallGoogleAndMeta();
                }}
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

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto" dir="ltr">
            {(
              [
                { id: 'overview' as const, label: t('integrations.tabs.overview'), icon: <Grid3X3 className="w-4 h-4" /> },
                { id: 'google' as const, label: 'Google', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )},
                { id: 'meta' as const, label: 'Meta', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#0866FF">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )},
                { id: 'tiktok' as const, label: 'TikTok', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.42a8.16 8.16 0 0 0 4.77 1.52V7.49a4.85 4.85 0 0 1-1-.8z"/>
                  </svg>
                )},
                { id: 'whatsapp' as const, label: 'WhatsApp', icon: (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                )},
                { id: 'more' as const, label: t('integrations.tabs.more'), icon: <MoreHorizontal className="w-4 h-4" /> },
              ] as Array<{ id: TabId; label: string; icon: React.ReactNode }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 flex-shrink-0',
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50/60'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              "fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-1.5rem)] max-w-md sm:w-auto sm:min-w-[320px] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2",
              toast.type === 'success' ? "bg-emerald-600 border-emerald-400 text-white" : "bg-red-600 border-red-400 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-bold break-words">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {(wizardResumeAvailable || (wizardCompletedCount > 0 && wizardHasPendingPlatforms)) && !isWizardOpen && (
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
              <button
                onClick={resumeWizard}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                {isHebrew ? 'המשך הגדרות אשף' : 'Continue wizard setup'}
              </button>
              <button
                onClick={clearWizardDraft}
                className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-white text-xs sm:text-sm font-semibold hover:bg-indigo-50 transition-colors"
              >
                {isHebrew ? 'איפוס זיכרון אשף' : 'Reset wizard memory'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConnectionWizard
        isWizardOpen={isWizardOpen}
        wizardStep={wizardStep}
        wizardPlatform={wizardPlatform}
        wizardSaving={wizardSaving}
        wizardValues={wizardValues}
        wizardFields={wizardFields}
        wizardConnection={wizardConnection}
        oauthSupported={oauthSupported}
        hasOauthToken={hasOauthToken}
        isHebrew={isHebrew}
        connections={connections}
        isWizardPlatformDone={isWizardPlatformDone}
        getConnectionSettingsById={getConnectionSettingsById}
        setWizardPlatform={setWizardPlatform}
        setWizardValues={setWizardValues}
        setIsWizardOpen={setIsWizardOpen}
        handleWizardInput={handleWizardInput}
        handleWizardNext={handleWizardNext}
        handleWizardBack={handleWizardBack}
        handleWizardSubmit={handleWizardSubmit}
        pauseWizardForLater={pauseWizardForLater}
        runOAuthForWizard={runOAuthForWizard}
      />

      {/* Success / Error inline */}
      {success && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <p className="text-sm font-bold text-emerald-800">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800 p-2 hover:bg-emerald-100 rounded-xl transition-colors">
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
                    const connectionName = connections.find((i) => i.id === error.id)?.name || '';
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
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-100 rounded-xl transition-colors shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="max-w-7xl mx-auto space-y-10 pb-12">
        {isWorkspaceReadOnly && (
          <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl text-sm font-bold text-amber-800">
            {t('integrations.readOnlyWorkspace')}
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────── */}
        {activeTab === 'overview' && (
          <OverviewTab
            googleConnections={googleConnections}
            metaConnections={metaConnections}
            tiktokConnections={tiktokConnections}
            ecommerceConnections={ecommerceConnections}
            aiConnections={aiConnections}
            aiConnectedCount={aiConnectedCount}
            isAdmin={isAdmin}
            language={language}
            expandedAiConnection={expandedAiConnection}
            t={t}
            setActiveTab={setActiveTab}
            handleExpand={handleExpand}
            handleMigrateAi={handleMigrateAi}
            renderIntegrationSettings={renderIntegrationSettings}
          />
        )}

        {/* ── GOOGLE TAB ───────────────────────────────── */}
        {activeTab === 'google' && (
          <GoogleTab
            googleConnections={googleConnections}
            t={t}
            renderConnectionCard={renderConnectionCard}
          />
        )}

        {/* ── META TAB ─────────────────────────────────── */}
        {activeTab === 'meta' && (
          <MetaTab
            metaConnections={metaConnections}
            renderConnectionCard={renderConnectionCard}
          />
        )}

        {/* ── TIKTOK TAB ───────────────────────────────── */}
        {activeTab === 'tiktok' && (
          <TikTokTab
            tiktokConnections={tiktokConnections}
            renderConnectionCard={renderConnectionCard}
          />
        )}

        {/* ── WHATSAPP TAB ─────────────────────────────── */}
        {activeTab === 'whatsapp' && (
          <section className="rounded-3xl border border-gray-200/80 bg-white/80 p-8 shadow-sm flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#25D366] flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">WhatsApp</h2>
              <p className="text-gray-500 text-sm mt-1">{t('integrations.whatsappComingSoon')}</p>
            </div>
          </section>
        )}

        {/* ── MORE TAB ─────────────────────────────────── */}
        {activeTab === 'more' && (
          <EcommerceTab
            ecommerceConnections={ecommerceConnections}
            t={t}
            renderConnectionCard={renderConnectionCard}
          />
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import type { Connection } from '../../contexts/ConnectionsContext';
import type { MetaAssetsPayload } from './integrationUtils';
import {
  type WizardPlatform,
  type WizardStep,
  type WizardDraft,
  WIZARD_STORAGE_PREFIX,
  WIZARD_PLATFORM_OPTIONS,
  WIZARD_FIELDS,
} from './wizardTypes';

export interface UseIntegrationsLogicProps {
  connections: Connection[];
  dataOwnerUid: string | null | undefined;
  isWorkspaceReadOnly: boolean;
  isHebrew: boolean;
  language: string;
  t: (key: string) => string;
  updateConnectionSettings: (id: string, settings: Record<string, string>) => Promise<void>;
  clearConnectionSettings: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  migrateAiConnectionsFromUser: () => Promise<{ success: boolean; message: string }>;
}

// ── API_BASE (mirrors the one in Integrations.tsx) ─────────────────────────
const _viteEnv =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env?: Record<string, unknown> }).env ?? undefined)
    : undefined;
const _configuredApiBase = (typeof _viteEnv?.VITE_APP_URL === 'string' && _viteEnv.VITE_APP_URL.trim()) || '';
const API_BASE = (() => {
  if (!_configuredApiBase || typeof window === 'undefined') return '';
  try {
    const origin = new URL(_configuredApiBase, window.location.origin).origin;
    return origin === window.location.origin ? origin : '';
  } catch {
    return '';
  }
})();

export function useIntegrationsLogic({
  connections,
  dataOwnerUid,
  isWorkspaceReadOnly,
  isHebrew,
  language,
  t,
  updateConnectionSettings,
  clearConnectionSettings,
  testConnection,
  migrateAiConnectionsFromUser,
}: UseIntegrationsLogicProps) {

  // ── Form / card state ────────────────────────────────────────────────────
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Managed-connection state ─────────────────────────────────────────────
  const [metaAssets, setMetaAssets] = useState<MetaAssetsPayload | null>(null);
  const [metaAssetsLoading, setMetaAssetsLoading] = useState(false);
  const [metaAssetsError, setMetaAssetsError] = useState<string | null>(null);
  const [tiktokAccounts, setTiktokAccounts] = useState<Array<{ externalAccountId: string; name?: string }>>([]);
  const [tiktokAccountsLoading, setTiktokAccountsLoading] = useState(false);
  const [tiktokAccountsError, setTiktokAccountsError] = useState<string | null>(null);
  const [reinstallingManagedPlatform, setReinstallingManagedPlatform] = useState<'google' | 'meta' | 'tiktok' | null>(null);
  const [reinstallingGoogleAndMeta, setReinstallingGoogleAndMeta] = useState(false);

  // ── Wizard state ─────────────────────────────────────────────────────────
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

  // ── Shared helpers ───────────────────────────────────────────────────────
  const wizardStorageKey = `${WIZARD_STORAGE_PREFIX}:${dataOwnerUid || 'default'}`;

  const languageSafeText = (value: string, fallback: string) =>
    value && value !== 'integrations.readOnlyWorkspace' ? value : fallback;

  const blockIfReadOnly = (): boolean => {
    if (!isWorkspaceReadOnly) return false;
    setToast({
      message: languageSafeText(t('integrations.readOnlyWorkspace'), 'Workspace is view only for this user.'),
      type: 'error',
    });
    setTimeout(() => setToast(null), 3000);
    return true;
  };

  const getConnectionSettingsById = (id: string): Record<string, string> =>
    connections.find((c) => c.id === id)?.settings || {};

  const isWizardPlatformDone = (platform: WizardPlatform, sourceSettings?: Record<string, string>) => {
    const connection = connections.find((c) => c.id === platform);
    const settings = sourceSettings || connection?.settings || {};
    const required = WIZARD_FIELDS[platform].filter((f) => f.required);
    const requiredComplete = required.every((f) => String(settings[f.key] || '').trim());
    const anyFieldFilled = Object.keys(settings).some((key) => String(settings[key] || '').trim());
    return Boolean(connection?.status === 'connected' || requiredComplete || anyFieldFilled);
  };

  const isWizardValuesMeaningful = (values: Record<string, string>) =>
    Object.keys(values).some((key) => String(values[key] || '').trim());

  const clearWizardDraft = () => {
    try { localStorage.removeItem(wizardStorageKey); } catch (err) { console.error('Failed to clear wizard draft:', err); }
    setWizardResumeAvailable(false);
    setWizardLastSavedAt(null);
    setWizardStep(1);
    setWizardPlatform('google');
    setWizardValues({ wizardBusinessName: '', wizardMainGoal: '', wizardNotes: '' });
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

  const wizardPlatforms = React.useMemo(() => WIZARD_PLATFORM_OPTIONS.map((p) => p.id), []);

  const completedWizardPlatforms = React.useMemo(
    () => wizardPlatforms.filter((p) => isWizardPlatformDone(p)),
    [wizardPlatforms, connections] // eslint-disable-line react-hooks/exhaustive-deps
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

  const handleWizardInput = (key: string, value: string) =>
    setWizardValues((prev) => ({ ...prev, [key]: value }));

  const validateWizardStep = (): boolean => {
    if (wizardStep === 1) {
      if (!wizardValues.wizardBusinessName?.trim()) {
        setToast({ message: isHebrew ? 'יש להזין שם עסק/חשבון לחיבור.' : 'Please enter business/account name.', type: 'error' });
        return false;
      }
      return true;
    }
    if (wizardStep === 2) {
      const missingRequired = WIZARD_FIELDS[wizardPlatform].filter(
        (f) => f.required && !String(wizardValues[f.key] || '').trim()
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

  const handleWizardBack = () =>
    setWizardStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));

  // ── Wizard draft: load on uid change ────────────────────────────────────
  React.useEffect(() => {
    if (wizardLoadedStorageKey === wizardStorageKey) return;
    setWizardLoadedStorageKey(wizardStorageKey);
    setWizardStep(1);
    setWizardPlatform('google');
    setWizardValues({ wizardBusinessName: '', wizardMainGoal: '', wizardNotes: '' });
    setWizardLastSavedAt(null);
    try {
      const raw = localStorage.getItem(wizardStorageKey);
      if (!raw) { setWizardResumeAvailable(false); return; }
      const parsed = JSON.parse(raw) as Partial<WizardDraft>;
      const parsedPlatform = parsed.platform;
      const parsedStep = parsed.step;
      const parsedValues = parsed.values;
      const platformIsValid = parsedPlatform && WIZARD_PLATFORM_OPTIONS.some((item) => item.id === parsedPlatform);
      const stepIsValid = parsedStep === 1 || parsedStep === 2 || parsedStep === 3;
      if (platformIsValid) setWizardPlatform(parsedPlatform);
      if (stepIsValid) setWizardStep(parsedStep);
      if (parsedValues && typeof parsedValues === 'object') {
        setWizardValues((prev) => ({ ...prev, ...parsedValues }));
        setWizardResumeAvailable(isWizardValuesMeaningful(parsedValues));
      }
      if (typeof parsed.updatedAt === 'number') setWizardLastSavedAt(parsed.updatedAt);
    } catch (err) {
      console.error('Failed to hydrate wizard draft:', err);
      setWizardResumeAvailable(false);
    }
  }, [wizardStorageKey, wizardLoadedStorageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wizard draft: persist on change ────────────────────────────────────
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
  }, [wizardPlatform, wizardStep, wizardValues, completedWizardPlatforms, wizardStorageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Placeholders for functions added in later steps ──────────────────────
  // (managed connections — added in ט-3)
  const _bootstrapManagedSession = async (_timeoutMs?: number): Promise<boolean> => false; // replaced in ט-3
  const loadManagedMetaAssets = async (_seedValues?: Record<string, string>) => {};         // replaced in ט-3
  const loadManagedTikTokAccounts = async (_seedValues?: Record<string, string>) => {};     // replaced in ט-3
  const handleGoogleConnect = async () => {};                                               // replaced in ט-3
  const handleMetaConnect = async () => {};                                                 // replaced in ט-3
  const handleTikTokConnect = async () => {};                                               // replaced in ט-3
  const handleReinstallManagedConnection = async (_platform: 'google' | 'meta' | 'tiktok') => {}; // replaced in ט-3
  const handleReinstallGoogleAndMeta = async () => {};                                      // replaced in ט-3

  // (form handlers — added in ט-4)
  const handleMigrateAi = async () => {};                                                   // replaced in ט-4
  const handleSave = async (_id: string, _overrideSettings?: Record<string, string>) => {}; // replaced in ט-4
  const handleTest = async (_id: string) => {};                                             // replaced in ט-4
  const handleHardResetConnection = async (_id: string) => {};                              // replaced in ט-4
  const handleExpand = (_integration: Connection) => {};                                    // replaced in ט-4
  const handleInputChange = (_key: string, _value: string) => {};                          // replaced in ט-4

  const runOAuthForWizard = async () => {
    if (wizardPlatform === 'google') { await handleGoogleConnect(); return; }
    if (wizardPlatform === 'meta') { await handleMetaConnect(); return; }
    if (wizardPlatform === 'tiktok') { await handleTikTokConnect(); }
  };

  const handleWizardSubmit = async () => {
    if (blockIfReadOnly()) return;
    if (!validateWizardStep()) return;
    setWizardSaving(true);
    try {
      const payload: Record<string, string> = { ...getConnectionSettingsById(wizardPlatform), ...wizardValues };
      await handleSave(wizardPlatform, payload);
      setIsWizardOpen(false);
      setWizardStep(1);
      setWizardResumeAvailable(true);
      setWizardLastSavedAt(Date.now());
      setToast({
        message: isHebrew ? 'שאלון ההתחברות הושלם והנכסים נשמרו לחיבור.' : 'Connection questionnaire completed and assets were saved.',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast({
        message: isHebrew ? 'שמירת שאלון ההתחברות נכשלה. נסה שוב.' : 'Failed saving connection questionnaire. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setWizardSaving(false);
    }
  };

  return {
    // form state
    error, setError,
    expandedId, setExpandedId,
    formValues, setFormValues,
    testingId,
    success, setSuccess,
    toast, setToast,
    // managed-connection state
    metaAssets, metaAssetsLoading, metaAssetsError,
    tiktokAccounts, tiktokAccountsLoading, tiktokAccountsError,
    reinstallingManagedPlatform,
    reinstallingGoogleAndMeta,
    // wizard state
    isWizardOpen, setIsWizardOpen,
    wizardStep,
    wizardPlatform,
    wizardSaving,
    wizardValues, setWizardValues,
    wizardResumeAvailable,
    wizardLastSavedAt,
    // wizard computed
    wizardPlatforms,
    completedWizardPlatforms,
    wizardCompletedCount,
    wizardTotalCount,
    wizardHasPendingPlatforms,
    wizardProgressPercent,
    wizardLastSavedLabel,
    // wizard functions
    openConnectionWizard,
    handleWizardInput,
    handleWizardNext,
    handleWizardBack,
    handleWizardSubmit,
    runOAuthForWizard,
    clearWizardDraft,
    pauseWizardForLater,
    resumeWizard,
    // managed connections
    loadManagedMetaAssets,
    loadManagedTikTokAccounts,
    handleGoogleConnect,
    handleMetaConnect,
    handleTikTokConnect,
    handleReinstallManagedConnection,
    handleReinstallGoogleAndMeta,
    // form handlers
    handleMigrateAi,
    handleSave,
    handleTest,
    handleHardResetConnection,
    handleExpand,
    handleInputChange,
    // helpers
    blockIfReadOnly,
    languageSafeText,
  };
}

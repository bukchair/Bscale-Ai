"use client";

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useConnections, Connection } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useIntegrationsLogic } from './integrations/useIntegrationsLogic';
import { OverviewTab } from './integrations/OverviewTab';
import { GoogleTab } from './integrations/GoogleTab';
import { MetaTab } from './integrations/MetaTab';
import { TikTokTab } from './integrations/TikTokTab';
import { EcommerceTab } from './integrations/EcommerceTab';
import { ConnectionWizard } from './integrations/ConnectionWizard';
import { IntegrationSettingsPanel } from './integrations/IntegrationSettingsPanel';
import { ConnectionCard } from './integrations/ConnectionCard';
import { IntegrationsHeader } from './integrations/IntegrationsHeader';
import { IntegrationsTabNav, type TabId } from './integrations/IntegrationsTabNav';
import { WizardResumeBanner } from './integrations/WizardResumeBanner';
import { IntegrationsAlerts } from './integrations/IntegrationsAlerts';
import { type WizardPlatform, WIZARD_FIELDS } from './integrations/wizardTypes';

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
  const isHebrew = language === 'he';
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const {
    error, setError,
    expandedId, setExpandedId,
    formValues, setFormValues,
    testingId,
    success, setSuccess,
    toast, setToast,
    metaAssets, metaAssetsLoading, metaAssetsError,
    tiktokAccounts, tiktokAccountsLoading, tiktokAccountsError,
    reinstallingManagedPlatform,
    reinstallingGoogleAndMeta,
    isWizardOpen, setIsWizardOpen,
    wizardStep,
    wizardPlatform,
    wizardSaving,
    wizardValues, setWizardValues,
    wizardResumeAvailable,
    wizardLastSavedAt,
    wizardPlatforms,
    completedWizardPlatforms,
    wizardCompletedCount,
    wizardTotalCount,
    wizardHasPendingPlatforms,
    wizardProgressPercent,
    wizardLastSavedLabel,
    openConnectionWizard,
    handleWizardInput,
    handleWizardNext,
    handleWizardBack,
    handleWizardSubmit,
    runOAuthForWizard,
    clearWizardDraft,
    pauseWizardForLater,
    resumeWizard,
    loadManagedMetaAssets,
    loadManagedTikTokAccounts,
    handleGoogleConnect,
    handleMetaConnect,
    handleTikTokConnect,
    handleReinstallManagedConnection,
    handleReinstallGoogleAndMeta,
    handleMigrateAi,
    handleSave,
    handleTest,
    handleHardResetConnection,
    handleExpand,
    handleInputChange,
    blockIfReadOnly,
    languageSafeText,
    setWizardPlatform,
    isWizardPlatformDone,
    getConnectionSettingsById,
  } = useIntegrationsLogic({
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
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const aiConnections = connections.filter(c => c.category === 'AI Engine');
  const googleConnections = connections.filter(c => c.category === 'Google');
  const socialConnections = connections.filter(c => c.category === 'Social');
  const metaConnections = socialConnections.filter(c => c.id === 'meta');
  const tiktokConnections = socialConnections.filter(c => c.id === 'tiktok');
  const ecommerceConnections = connections.filter(c => c.category === 'E-commerce');
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const aiConnectedCount = aiConnections.filter(c => c.status === 'connected').length;
  const expandedAiConnection = aiConnections.find(c => c.id === expandedId) || null;

  const wizardFields = WIZARD_FIELDS[wizardPlatform];
  const wizardConnection = connections.find(c => c.id === wizardPlatform);
  const oauthTokenKey: Record<WizardPlatform, string | null> = {
    google: 'googleAccessToken', meta: 'metaToken',
    tiktok: null, woocommerce: null, shopify: null,
  };
  const oauthSupportedPlatforms: WizardPlatform[] = ['google', 'meta', 'tiktok'];
  const oauthSupported = oauthSupportedPlatforms.includes(wizardPlatform);
  const activeOauthTokenKey = oauthTokenKey[wizardPlatform];
  const hasOauthToken = activeOauthTokenKey
    ? Boolean(wizardValues[activeOauthTokenKey] || wizardConnection?.settings?.[activeOauthTokenKey])
    : true;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleResetAll = async () => {
    if (!window.confirm(t('integrations.resetAllConfirm'))) return;
    try {
      await resetAllConnections();
      setExpandedId(null);
      setFormValues({});
      setToast({ message: t('integrations.resetAllDone'), type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        message: err instanceof Error && err.message
          ? err.message
          : isHebrew ? 'איפוס כולל נכשל. נסה שוב.' : 'Failed to reset all connections. Please retry.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3500);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
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

  const renderConnectionCard = (integration: Connection) => (
    <React.Fragment key={integration.id}>
      <ConnectionCard
        integration={integration}
        expandedId={expandedId}
        isHebrew={isHebrew}
        t={t}
        supportsWizard={Object.prototype.hasOwnProperty.call(WIZARD_FIELDS, integration.id)}
        onExpand={handleExpand}
        onOpenWizard={openConnectionWizard}
        renderSettings={renderIntegrationSettings}
      />
    </React.Fragment>
  );

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <IntegrationsHeader
        connections={connections}
        language={language}
        isHebrew={isHebrew}
        connectedCount={connectedCount}
        wizardResumeAvailable={wizardResumeAvailable}
        reinstallingGoogleAndMeta={reinstallingGoogleAndMeta}
        reinstallingManagedPlatform={reinstallingManagedPlatform}
        t={t}
        onOpenWizard={() => wizardResumeAvailable ? resumeWizard() : openConnectionWizard('google')}
        onTestAll={() => connections.filter(c => c.status === 'connected').forEach(c => handleTest(c.id))}
        onResetAll={handleResetAll}
        onReinstallGoogleAndMeta={() => void handleReinstallGoogleAndMeta()}
      />

      <IntegrationsTabNav
        activeTab={activeTab}
        language={language}
        t={t}
        onTabChange={setActiveTab}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={cn(
              'fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-1.5rem)] max-w-md sm:w-auto sm:min-w-[320px] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2',
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-red-600 border-red-400 text-white'
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-bold break-words">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {(wizardResumeAvailable || (wizardCompletedCount > 0 && wizardHasPendingPlatforms)) && !isWizardOpen && (
        <WizardResumeBanner
          isHebrew={isHebrew}
          wizardCompletedCount={wizardCompletedCount}
          wizardTotalCount={wizardTotalCount}
          wizardLastSavedLabel={wizardLastSavedLabel}
          wizardProgressPercent={wizardProgressPercent}
          onResume={resumeWizard}
          onClear={clearWizardDraft}
        />
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

      <IntegrationsAlerts
        success={success}
        error={error}
        connections={connections}
        isHebrew={isHebrew}
        t={t}
        onClearSuccess={() => setSuccess(null)}
        onClearError={() => setError(null)}
      />

      {/* Tab content */}
      <div className="max-w-7xl mx-auto space-y-10 pb-12">
        {isWorkspaceReadOnly && (
          <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl text-sm font-bold text-amber-800">
            {t('integrations.readOnlyWorkspace')}
          </div>
        )}

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

        {activeTab === 'google' && (
          <GoogleTab googleConnections={googleConnections} t={t} renderConnectionCard={renderConnectionCard} />
        )}

        {activeTab === 'meta' && (
          <MetaTab metaConnections={metaConnections} renderConnectionCard={renderConnectionCard} />
        )}

        {activeTab === 'tiktok' && (
          <TikTokTab tiktokConnections={tiktokConnections} renderConnectionCard={renderConnectionCard} />
        )}

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

        {activeTab === 'more' && (
          <EcommerceTab ecommerceConnections={ecommerceConnections} t={t} renderConnectionCard={renderConnectionCard} />
        )}
      </div>
    </div>
  );
}

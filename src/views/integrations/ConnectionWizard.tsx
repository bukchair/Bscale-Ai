'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Connection } from '../../contexts/ConnectionsContext';
import { WizardPlatform, WizardStep, WizardField } from './types';

type ConnectionWizardProps = {
  isWizardOpen: boolean;
  wizardStep: WizardStep;
  wizardPlatform: WizardPlatform;
  wizardSaving: boolean;
  wizardValues: Record<string, string>;
  wizardFields: WizardField[];
  wizardConnection: Connection | undefined;
  oauthSupported: boolean;
  hasOauthToken: boolean;
  isHebrew: boolean;
  connections: Connection[];
  isWizardPlatformDone: (platform: WizardPlatform, settings?: Record<string, string>) => boolean;
  getConnectionSettingsById: (id: string) => Record<string, string>;
  setWizardPlatform: (platform: WizardPlatform) => void;
  setWizardValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setIsWizardOpen: (open: boolean) => void;
  handleWizardInput: (key: string, value: string) => void;
  handleWizardNext: () => void;
  handleWizardBack: () => void;
  handleWizardSubmit: () => void;
  pauseWizardForLater: () => void;
  runOAuthForWizard: () => void;
};

const WIZARD_PLATFORM_OPTIONS: Array<{ id: WizardPlatform; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'meta', label: 'Meta' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'woocommerce', label: 'WooCommerce' },
  { id: 'shopify', label: 'Shopify' },
];

export function ConnectionWizard({
  isWizardOpen,
  wizardStep,
  wizardPlatform,
  wizardSaving,
  wizardValues,
  wizardFields,
  oauthSupported,
  hasOauthToken,
  isHebrew,
  connections,
  isWizardPlatformDone,
  getConnectionSettingsById,
  setWizardPlatform,
  setWizardValues,
  setIsWizardOpen,
  handleWizardInput,
  handleWizardNext,
  handleWizardBack,
  handleWizardSubmit,
  pauseWizardForLater,
  runOAuthForWizard,
}: ConnectionWizardProps) {
  return (
    <AnimatePresence>
      {isWizardOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => {
            if (!wizardSaving) setIsWizardOpen(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {isHebrew ? 'חלון התחברות לפלטפורמות' : 'Platform connection window'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isHebrew
                    ? 'שאלון לנכסים קיימים כמו חשבון מודעות, פיקסל ושדות נדרשים.'
                    : 'Questionnaire for existing assets such as ad account, pixel, and required fields.'}
                </p>
              </div>
              <button
                onClick={() => setIsWizardOpen(false)}
                disabled={wizardSaving}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={`wizard-step-${step}`}>
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border',
                      wizardStep > step
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : wizardStep === step
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-500 border-gray-300'
                    )}
                  >
                    {step}
                  </div>
                  {step < 3 && <div className="h-0.5 w-8 bg-gray-200 rounded-full" />}
                </React.Fragment>
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">
                      {isHebrew ? 'בחר פלטפורמה לחיבור' : 'Choose platform'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {WIZARD_PLATFORM_OPTIONS.map((platform) => {
                        const connection = connections.find((c) => c.id === platform.id);
                        const connectionSettings = connection?.settings || {};
                        const hasAnySavedValue = Object.keys(connectionSettings).some((key) => String(connectionSettings[key] || '').trim());
                        const isDone = isWizardPlatformDone(platform.id, connectionSettings);
                        return (
                          <button
                            key={`wizard-platform-${platform.id}`}
                            onClick={() => {
                              const nextSettings = getConnectionSettingsById(platform.id);
                              setWizardPlatform(platform.id);
                              setWizardValues((prev) => ({ ...prev, ...nextSettings }));
                            }}
                            className={cn(
                              'px-3 py-2 rounded-lg border text-sm font-semibold text-left transition-colors',
                              wizardPlatform === platform.id
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{platform.label}</span>
                              <span
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full font-bold',
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : hasAnySavedValue
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-500'
                                )}
                              >
                                {isDone
                                  ? (isHebrew ? 'הושלם' : 'Completed')
                                  : hasAnySavedValue
                                  ? (isHebrew ? 'בטיוטה' : 'Draft')
                                  : (isHebrew ? 'לא הוגדר' : 'Not set')}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        {isHebrew ? 'שם עסק או חשבון' : 'Business or account name'} *
                      </label>
                      <input
                        type="text"
                        value={wizardValues.wizardBusinessName || ''}
                        onChange={(event) => handleWizardInput('wizardBusinessName', event.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={isHebrew ? 'למשל: BScale Agency' : 'e.g. BScale Agency'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        {isHebrew ? 'מטרה עסקית עיקרית' : 'Main business goal'}
                      </label>
                      <input
                        type="text"
                        value={wizardValues.wizardMainGoal || ''}
                        onChange={(event) => handleWizardInput('wizardMainGoal', event.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={isHebrew ? 'למשל: הגדלת לידים' : 'e.g. increase leads'}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">
                        {isHebrew ? 'הערות חיבור (אופציונלי)' : 'Connection notes (optional)'}
                      </label>
                      <textarea
                        value={wizardValues.wizardNotes || ''}
                        onChange={(event) => handleWizardInput('wizardNotes', event.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[88px]"
                        placeholder={isHebrew ? 'קמפיינים, נכסים קיימים, הרשאות ועוד' : 'Campaigns, existing assets, permissions, etc.'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-800">
                    {isHebrew
                      ? 'מלא את כל הנכסים הקיימים שברצונך לחבר לחשבון הספציפי.'
                      : 'Fill all existing assets you want to connect for this specific account.'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {wizardFields.map((field) => {
                      const label = isHebrew ? field.labelHe : field.labelEn;
                      const inputType = field.type || (field.key.toLowerCase().includes('token') ? 'password' : 'text');
                      const isLtrField =
                        field.key.toLowerCase().includes('id') ||
                        field.key.toLowerCase().includes('token') ||
                        field.key.toLowerCase().includes('url');
                      return (
                        <div key={`wizard-field-${field.key}`} className={field.key === 'googleAccessToken' ? 'sm:col-span-2' : ''}>
                          <label className="block text-xs font-bold text-gray-600 mb-1">
                            {label} {field.required ? '*' : ''}
                          </label>
                          <input
                            type={inputType}
                            value={wizardValues[field.key] || ''}
                            onChange={(event) => handleWizardInput(field.key, event.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder={field.placeholder}
                            dir={isLtrField ? 'ltr' : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {oauthSupported && (
                    <div className="rounded-xl border border-gray-200 p-3">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="text-xs">
                          <p className="font-bold text-gray-700">
                            {isHebrew ? 'חיבור OAuth' : 'OAuth login'}
                          </p>
                          <p className="text-gray-500 mt-0.5">
                            {hasOauthToken
                              ? (isHebrew ? 'טוקן זמין - ניתן להשלים חיבור.' : 'Token available - ready to complete.')
                              : (isHebrew ? 'לא זוהה טוקן. מומלץ לבצע התחברות מהירה.' : 'No token detected. Quick login is recommended.')}
                          </p>
                        </div>
                        <button
                          onClick={runOAuthForWizard}
                          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                        >
                          {isHebrew ? 'התחבר עכשיו' : 'Login now'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800">
                    {isHebrew
                      ? 'סקירה לפני שמירה. אשר כדי לשמור את החיבור והנכסים לפלטפורמה.'
                      : 'Review before saving. Confirm to save platform connection and assets.'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{isHebrew ? 'פלטפורמה' : 'Platform'}</p>
                      <p className="font-bold text-gray-900 mt-1">{wizardPlatform}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">{isHebrew ? 'שם עסק/חשבון' : 'Business/account name'}</p>
                      <p className="font-bold text-gray-900 mt-1">{wizardValues.wizardBusinessName || '-'}</p>
                    </div>
                    <div className="sm:col-span-2 rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 mb-2">{isHebrew ? 'נכסים שהוזנו' : 'Provided assets'}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {wizardFields.map((field) => (
                          <div key={`wizard-summary-${field.key}`} className="text-xs bg-gray-50 rounded-md px-2 py-1.5">
                            <span className="font-semibold text-gray-600">{isHebrew ? field.labelHe : field.labelEn}: </span>
                            <span className="text-gray-900">
                              {!wizardValues[field.key]
                                ? '-'
                                : /token|secret|key/i.test(field.key)
                                ? '••••••'
                                : wizardValues[field.key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWizardBack}
                  disabled={wizardStep === 1 || wizardSaving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-50"
                >
                  {isHebrew ? 'חזרה' : 'Back'}
                </button>
                <button
                  onClick={pauseWizardForLater}
                  disabled={wizardSaving}
                  className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 text-sm font-semibold disabled:opacity-50"
                >
                  {isHebrew ? 'המשך אחר כך' : 'Continue later'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {wizardStep < 3 ? (
                  <button
                    onClick={handleWizardNext}
                    disabled={wizardSaving}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isHebrew ? 'המשך' : 'Continue'}
                  </button>
                ) : (
                  <button
                    onClick={handleWizardSubmit}
                    disabled={wizardSaving}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {wizardSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isHebrew ? 'שמור וחבר פלטפורמה' : 'Save and connect platform'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

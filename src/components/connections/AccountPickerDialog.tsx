"use client";

'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Save, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '@/src/contexts/LanguageContext';

type AccountItem = {
  externalAccountId: string;
  name: string;
  currency?: string | null;
  timezone?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
};

type Props = {
  open: boolean;
  platformLabel: string;
  accounts: AccountItem[];
  initiallySelected: string[];
  loading: boolean;
  saving: boolean;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onSave: (selectedAccountIds: string[]) => Promise<void>;
};

export function AccountPickerDialog({
  open,
  platformLabel,
  accounts,
  initiallySelected,
  loading,
  saving,
  onRefresh,
  onClose,
  onSave,
}: Props) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string[]>(initiallySelected);

  useEffect(() => {
    setSelected(initiallySelected);
  }, [initiallySelected]);

  if (!open) return null;

  const toggle = (accountId: string) => {
    setSelected((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              {t('integrations.chooseAccounts')} — {platformLabel}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('integrations.accountsSubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button
            onClick={() => void onRefresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {t('integrations.refreshAccounts')}
          </button>

          {loading ? (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              {t('integrations.loadingAccounts')}
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
              {t('integrations.noAccountsFound')}
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => {
                const isSelected = selected.includes(account.externalAccountId);
                return (
                  <button
                    key={account.externalAccountId}
                    onClick={() => toggle(account.externalAccountId)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-start transition-colors',
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{account.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 break-all">
                          {account.externalAccountId}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {account.currency || '—'} | {account.timezone || '—'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {isSelected ? t('integrations.selected') : t('integrations.notSelected')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-white/10 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => void onSave(selected)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('integrations.saveSelection')}
          </button>
        </div>
      </div>
    </div>
  );
}

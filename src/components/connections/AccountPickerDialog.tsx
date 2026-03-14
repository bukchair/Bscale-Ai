'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Save, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-base font-black text-gray-900">Choose accounts - {platformLabel}</h3>
            <p className="text-xs text-gray-500">Select one or more accounts for dashboard sync.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button
            onClick={() => void onRefresh()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh account discovery
          </button>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No accounts found for this platform.
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
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">{account.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500 break-all">
                          {account.externalAccountId}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {account.currency || '—'} | {account.timezone || '—'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                          isSelected
                            ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                            : 'border-gray-200 bg-gray-100 text-gray-600'
                        )}
                      >
                        {isSelected ? 'Selected' : 'Not selected'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave(selected)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save selection
          </button>
        </div>
      </div>
    </div>
  );
}

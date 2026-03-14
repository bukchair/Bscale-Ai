'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ConnectionCard, type ConnectionCardData } from '@/src/components/connections/ConnectionCard';
import { AccountPickerDialog } from '@/src/components/connections/AccountPickerDialog';
import { cn } from '@/src/lib/utils';

type ApiSuccess<T> = { success: true; message: string; data: T };
type ApiFailure = { success: false; errorCode: string; message: string };
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type ConnectionsPayload = {
  connections: ConnectionCardData[];
};

const platformSlug: Record<ConnectionCardData['platform'], string> = {
  GOOGLE_ADS: 'google-ads',
  GA4: 'ga4',
  SEARCH_CONSOLE: 'search-console',
  GMAIL: 'gmail',
  META: 'meta',
  TIKTOK: 'tiktok',
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

export function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogPlatform, setDialogPlatform] = useState<ConnectionCardData['platform'] | null>(null);
  const [dialogAccounts, setDialogAccounts] = useState<
    Array<{ externalAccountId: string; name: string; currency?: string | null; timezone?: string | null; status?: string }>
  >([]);

  const dialogSelected = useMemo(() => {
    if (!dialogPlatform) return [];
    const connection = connections.find((item) => item.platform === dialogPlatform);
    return (connection?.accounts ?? []).filter((account) => account.isSelected).map((account) => account.externalAccountId);
  }, [connections, dialogPlatform]);

  const showToast = (next: ToastState) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  };

  const parseResponse = async <T,>(response: Response): Promise<ApiResponse<T>> => {
    const payload = (await response.json()) as ApiResponse<T>;
    return payload;
  };

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/connections', { method: 'GET', cache: 'no-store' });
      const payload = await parseResponse<ConnectionsPayload>(response);
      if (!payload.success) {
        throw new Error(payload.message);
      }
      setConnections(payload.data.connections);
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load connections.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConnections();
  }, []);

  const runAction = async (
    platform: ConnectionCardData['platform'],
    action: 'connect' | 'test' | 'sync' | 'disconnect',
    routeSuffix: 'start' | 'test' | 'sync' | 'disconnect'
  ) => {
    const slug = platformSlug[platform];
    const actionId = `${platform}:${action}`;
    setBusyAction(actionId);
    try {
      const response = await fetch(`/api/connections/${slug}/${routeSuffix}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: routeSuffix === 'sync' ? JSON.stringify({ forceRefresh: false }) : JSON.stringify({}),
      });
      const payload = await parseResponse<{ authorizationUrl?: string }>(response);
      if (!payload.success) {
        throw new Error(payload.message);
      }

      if (action === 'connect' && payload.data.authorizationUrl) {
        showToast({ type: 'success', message: 'Redirecting to provider authentication...' });
        window.location.href = payload.data.authorizationUrl;
        return;
      }

      showToast({ type: 'success', message: payload.message });
      await loadConnections();
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : `Failed action ${action}.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const openAccountPicker = async (platform: ConnectionCardData['platform']) => {
    const slug = platformSlug[platform];
    setDialogPlatform(platform);
    setDialogOpen(true);
    setDialogLoading(true);
    try {
      const response = await fetch(`/api/connections/${slug}/accounts`, { method: 'GET' });
      const payload = await parseResponse<{ accounts: typeof dialogAccounts }>(response);
      if (!payload.success) throw new Error(payload.message);
      setDialogAccounts(payload.data.accounts);
      await loadConnections();
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load account picker.',
      });
    } finally {
      setDialogLoading(false);
    }
  };

  const saveSelectedAccounts = async (selectedAccountIds: string[]) => {
    if (!dialogPlatform) return;
    const slug = platformSlug[dialogPlatform];
    setDialogSaving(true);
    try {
      const response = await fetch(`/api/connections/${slug}/select-accounts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountIds: selectedAccountIds }),
      });
      const payload = await parseResponse<{ selectedAccountIds: string[] }>(response);
      if (!payload.success) throw new Error(payload.message);
      showToast({ type: 'success', message: payload.message });
      setDialogOpen(false);
      await loadConnections();
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save account selection.',
      });
    } finally {
      setDialogSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Connections Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect platforms, select accounts, run tests, and trigger manual sync.
          </p>
        </div>
        <button
          onClick={() => void loadConnections()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh
        </button>
      </div>

      {toast ? (
        <div
          className={cn(
            'rounded-xl border p-3 text-sm font-semibold',
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Loading connections...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              data={connection}
              busyAction={busyAction}
              onConnect={(platform) => runAction(platform, 'connect', 'start')}
              onChooseAccounts={openAccountPicker}
              onTest={(platform) => runAction(platform, 'test', 'test')}
              onSync={(platform) => runAction(platform, 'sync', 'sync')}
              onDisconnect={(platform) => runAction(platform, 'disconnect', 'disconnect')}
            />
          ))}
        </div>
      )}

      <AccountPickerDialog
        open={dialogOpen}
        platformLabel={dialogPlatform ? dialogPlatform : 'Platform'}
        accounts={dialogAccounts}
        initiallySelected={dialogSelected}
        loading={dialogLoading}
        saving={dialogSaving}
        onRefresh={async () => {
          if (!dialogPlatform) return;
          await openAccountPicker(dialogPlatform);
        }}
        onClose={() => setDialogOpen(false)}
        onSave={saveSelectedAccounts}
      />
    </div>
  );
}

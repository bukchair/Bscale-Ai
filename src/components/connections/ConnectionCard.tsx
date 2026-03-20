"use client";

'use client';

import { useState } from 'react';
import { CheckCircle2, Link2, RefreshCcw, Settings2, ShieldX, TestTube2, Unplug } from 'lucide-react';
import { ConnectionStatusBadge } from '@/src/components/connections/ConnectionStatusBadge';
import { ErrorPanel } from '@/src/components/connections/ErrorPanel';
import { SyncHistoryTable } from '@/src/components/connections/SyncHistoryTable';
import { cn } from '@/src/lib/utils';

type HistoryRow = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  jobType: 'DISCOVER' | 'TEST' | 'MANUAL_SYNC' | 'REFRESH';
};

export type ConnectionCardData = {
  id: string;
  platform: 'GOOGLE_ADS' | 'GA4' | 'SEARCH_CONSOLE' | 'GMAIL' | 'META' | 'TIKTOK';
  status: 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'DISCONNECTED' | 'PENDING';
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAccountCount: number;
  selectedAccountCount: number;
  accounts: Array<{
    externalAccountId: string;
    name: string;
    isSelected: boolean;
    status: string;
    currency?: string | null;
    timezone?: string | null;
  }>;
  history: HistoryRow[];
};

type Props = {
  data: ConnectionCardData;
  busyAction: string | null;
  onConnect: (platform: ConnectionCardData['platform']) => Promise<void>;
  onChooseAccounts: (platform: ConnectionCardData['platform']) => Promise<void>;
  onTest: (platform: ConnectionCardData['platform']) => Promise<void>;
  onSync: (platform: ConnectionCardData['platform']) => Promise<void>;
  onDisconnect: (platform: ConnectionCardData['platform']) => Promise<void>;
};

const platformTitle: Record<ConnectionCardData['platform'], string> = {
  GOOGLE_ADS: 'Google Ads',
  GA4: 'Google Analytics 4',
  SEARCH_CONSOLE: 'Google Search Console',
  GMAIL: 'Gmail',
  META: 'Meta Marketing API',
  TIKTOK: 'TikTok for Business',
};

export function ConnectionCard({
  data,
  busyAction,
  onConnect,
  onChooseAccounts,
  onTest,
  onSync,
  onDisconnect,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const actionPrefix = `${data.platform}:`;
  const isBusy = (name: string) => busyAction === `${actionPrefix}${name}`;
  const canConnect = data.status === 'DISCONNECTED' || data.status === 'PENDING' || data.status === 'ERROR';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-gray-900">{platformTitle[data.platform]}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {data.connectedAccountCount} discovered accounts | {data.selectedAccountCount} selected
          </p>
        </div>
        <ConnectionStatusBadge status={data.status} />
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
          <p className="font-semibold text-gray-500">Last sync</p>
          <p className="mt-1 text-gray-900 font-bold">
            {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'Never'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
          <p className="font-semibold text-gray-500">Connected accounts</p>
          <p className="mt-1 text-gray-900 font-bold">{data.connectedAccountCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
          <p className="font-semibold text-gray-500">Selected accounts</p>
          <p className="mt-1 text-gray-900 font-bold">{data.selectedAccountCount}</p>
        </div>
      </div>

      {data.lastError ? (
        <div className="mt-3">
          <ErrorPanel title="Last provider error" message={data.lastError} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void onConnect(data.platform)}
          disabled={isBusy('connect')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60',
            canConnect ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'
          )}
        >
          {canConnect ? <Link2 className="h-3.5 w-3.5" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          {canConnect ? 'Connect' : 'Reconnect'}
        </button>
        <button
          onClick={() => void onChooseAccounts(data.platform)}
          disabled={isBusy('accounts')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Choose accounts
        </button>
        <button
          onClick={() => void onTest(data.platform)}
          disabled={isBusy('test')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
        >
          <TestTube2 className="h-3.5 w-3.5" />
          Test
        </button>
        <button
          onClick={() => void onSync(data.platform)}
          disabled={isBusy('sync')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sync now
        </button>
        <button
          onClick={() => void onDisconnect(data.platform)}
          disabled={isBusy('disconnect')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
        >
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </button>
      </div>

      <div className="mt-3">
        <button
          onClick={() => setShowHistory((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
        >
          <ShieldX className="h-3.5 w-3.5" />
          {showHistory ? 'Hide sync history' : 'Show sync history'}
        </button>
      </div>

      {showHistory ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-2">
          <SyncHistoryTable rows={data.history} />
        </div>
      ) : null}
    </div>
  );
}

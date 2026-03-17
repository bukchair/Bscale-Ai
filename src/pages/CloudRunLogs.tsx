import React, { useState, useCallback } from 'react';
import { RefreshCw, Search, AlertCircle, Info, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE } from '../lib/utils/client-api-base';
import { auth, onAuthStateChanged } from '../lib/firebase';

type Severity = '' | 'DEFAULT' | 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALERT' | 'EMERGENCY';

interface LogEntry {
  insertId?: string;
  timestamp?: string;
  severity?: string;
  textPayload?: string;
  jsonPayload?: Record<string, unknown>;
  httpRequest?: {
    requestMethod?: string;
    requestUrl?: string;
    status?: number;
    latency?: string;
  };
  resource?: {
    labels?: Record<string, string>;
  };
  labels?: Record<string, string>;
}

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'NOTICE', label: 'NOTICE' },
  { value: 'WARNING', label: 'WARNING' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'CRITICAL', label: 'CRITICAL' },
  { value: 'ALERT', label: 'ALERT' },
  { value: 'EMERGENCY', label: 'EMERGENCY' },
];

function severityColor(severity?: string) {
  switch (severity) {
    case 'DEBUG': return 'text-gray-400 dark:text-gray-500';
    case 'INFO': return 'text-blue-600 dark:text-blue-400';
    case 'NOTICE': return 'text-teal-600 dark:text-teal-400';
    case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
    case 'ERROR': return 'text-red-500 dark:text-red-400';
    case 'CRITICAL':
    case 'ALERT':
    case 'EMERGENCY': return 'text-red-700 dark:text-red-300 font-bold';
    default: return 'text-gray-500 dark:text-gray-400';
  }
}

function SeverityIcon({ severity }: { severity?: string }) {
  const cls = cn('w-4 h-4 shrink-0', severityColor(severity));
  switch (severity) {
    case 'ERROR':
    case 'CRITICAL':
    case 'ALERT':
    case 'EMERGENCY':
      return <XCircle className={cls} />;
    case 'WARNING':
      return <AlertTriangle className={cls} />;
    case 'INFO':
    case 'NOTICE':
      return <Info className={cls} />;
    default:
      return <AlertCircle className={cls} />;
  }
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('he-IL', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function logMessage(entry: LogEntry): string {
  if (entry.textPayload) return entry.textPayload;
  if (entry.jsonPayload) {
    const msg = entry.jsonPayload.message || entry.jsonPayload.msg || entry.jsonPayload.text;
    if (typeof msg === 'string') return msg;
    return JSON.stringify(entry.jsonPayload, null, 2);
  }
  if (entry.httpRequest) {
    const r = entry.httpRequest;
    return `${r.requestMethod} ${r.requestUrl} → ${r.status} (${r.latency || ''})`;
  }
  return '—';
}

async function ensureSession() {
  const user =
    auth.currentUser ||
    (await new Promise<typeof auth.currentUser>((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
    }));
  if (!user) return;
  const idToken = await user.getIdToken();
  await fetch(`${API_BASE}/api/auth/session/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

export function CloudRunLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<Severity>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);

  const fetchLogs = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      await ensureSession();
      const params = new URLSearchParams({ pageSize: '100' });
      if (severity) params.set('severity', severity);
      if (search) params.set('search', search);
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`${API_BASE}/api/cloud-run-logs?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }
      const data = await res.json();
      const entries: LogEntry[] = data.entries || [];
      setLogs(prev => pageToken ? [...prev, ...entries] : entries);
      setNextPageToken(data.nextPageToken || undefined);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  }, [severity, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setLogs([]);
    setNextPageToken(undefined);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">לוגים של Cloud Run</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            לוגים של שירות <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">bscale</code> ב-Cloud Run
          </p>
        </div>
        <button
          onClick={() => { setLogs([]); setNextPageToken(undefined); fetchLogs(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          רענן
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Severity filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">חומרה:</label>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as Severity)}
              className="text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white"
            >
              {SEVERITIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Text search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="חיפוש בטקסט הלוג..."
                className="w-full ps-9 pe-3 py-1.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
            >
              חפש
            </button>
          </form>
        </div>

        <button
          onClick={() => { setLogs([]); setNextPageToken(undefined); fetchLogs(); }}
          disabled={loading}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading && !logs.length ? 'טוען...' : 'טען לוגים'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">שגיאה בטעינת הלוגים</p>
            <p className="mt-1 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Logs table */}
      {fetched && (
        <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {logs.length === 0 && !loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>לא נמצאו לוגים</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {logs.map((entry, idx) => {
                const id = entry.insertId || `log-${idx}`;
                const expanded = expandedIds.has(id);
                const message = logMessage(entry);
                const hasDetails = !!(entry.jsonPayload || entry.httpRequest || entry.labels);
                return (
                  <div key={id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <div
                      className={cn('flex items-start gap-3 px-4 py-3', hasDetails && 'cursor-pointer')}
                      onClick={() => hasDetails && toggleExpand(id)}
                    >
                      <SeverityIcon severity={entry.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 mb-1">
                          <span className={cn('font-semibold uppercase', severityColor(entry.severity))}>
                            {entry.severity || 'DEFAULT'}
                          </span>
                          <span>{formatTimestamp(entry.timestamp)}</span>
                          {entry.resource?.labels?.revision_name && (
                            <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                              {entry.resource.labels.revision_name}
                            </span>
                          )}
                        </div>
                        <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all font-mono leading-relaxed">
                          {message.length > 400 && !expanded ? message.slice(0, 400) + '…' : message}
                        </pre>
                      </div>
                      {hasDetails && (
                        <div className="shrink-0 text-gray-400">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      )}
                    </div>
                    {expanded && hasDetails && (
                      <div className="px-4 pb-3 ps-11">
                        <pre className="text-xs bg-gray-50 dark:bg-black/30 rounded-lg p-3 overflow-x-auto text-gray-600 dark:text-gray-400 font-mono">
                          {JSON.stringify(
                            { jsonPayload: entry.jsonPayload, httpRequest: entry.httpRequest, labels: entry.labels },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {nextPageToken && (
            <div className="border-t border-gray-100 dark:border-white/5 p-3 text-center">
              <button
                onClick={() => fetchLogs(nextPageToken)}
                disabled={loading}
                className="px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium disabled:opacity-50"
              >
                {loading ? 'טוען...' : 'טען עוד'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

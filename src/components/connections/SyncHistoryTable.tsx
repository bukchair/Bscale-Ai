'use client';

import { cn } from '@/src/lib/utils';

type HistoryRow = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  jobType: 'DISCOVER' | 'TEST' | 'MANUAL_SYNC' | 'REFRESH';
};

type Props = {
  rows: HistoryRow[];
};

export function SyncHistoryTable({ rows }: Props) {
  if (!rows.length) {
    return <p className="text-xs text-gray-500">No sync runs yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="px-2 py-1.5 text-start font-semibold">Type</th>
            <th className="px-2 py-1.5 text-start font-semibold">Status</th>
            <th className="px-2 py-1.5 text-start font-semibold">Started</th>
            <th className="px-2 py-1.5 text-start font-semibold">Completed</th>
            <th className="px-2 py-1.5 text-start font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="px-2 py-1.5">{row.jobType}</td>
              <td className="px-2 py-1.5">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-bold',
                    row.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700'
                      : row.status === 'FAILED'
                      ? 'bg-red-50 text-red-700'
                      : row.status === 'RUNNING'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-slate-100 text-slate-700'
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-2 py-1.5">{new Date(row.startedAt).toLocaleString()}</td>
              <td className="px-2 py-1.5">{row.completedAt ? new Date(row.completedAt).toLocaleString() : '—'}</td>
              <td className="px-2 py-1.5 max-w-[280px] break-words text-red-600">{row.errorMessage || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

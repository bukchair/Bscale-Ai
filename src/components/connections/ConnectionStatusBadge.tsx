'use client';

import { cn } from '@/src/lib/utils';

type Props = {
  status: 'CONNECTED' | 'ERROR' | 'EXPIRED' | 'DISCONNECTED' | 'PENDING';
};

const STATUS_LABEL: Record<Props['status'], string> = {
  CONNECTED: 'Connected',
  ERROR: 'Error',
  EXPIRED: 'Expired',
  DISCONNECTED: 'Disconnected',
  PENDING: 'Pending',
};

const STATUS_STYLE: Record<Props['status'], string> = {
  CONNECTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-amber-50 text-amber-700 border-amber-200',
  DISCONNECTED: 'bg-slate-100 text-slate-700 border-slate-200',
  PENDING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function ConnectionStatusBadge({ status }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        STATUS_STYLE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

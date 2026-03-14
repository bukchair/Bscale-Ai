'use client';

import { AlertCircle } from 'lucide-react';

type Props = {
  title?: string;
  message: string;
};

export function ErrorPanel({ title = 'Connection error', message }: Props) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs break-words">{message}</p>
        </div>
      </div>
    </div>
  );
}

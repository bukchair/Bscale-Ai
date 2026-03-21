'use client';

import React from 'react';
import { Connection } from '../../contexts/ConnectionsContext';
import { RenderConnectionCard } from './types';

type TikTokTabProps = {
  tiktokConnections: Connection[];
  renderConnectionCard: RenderConnectionCard;
};

export function TikTokTab({ tiktokConnections, renderConnectionCard }: TikTokTabProps) {
  if (tiktokConnections.length === 0) return null;
  return (
    <section className="rounded-3xl border border-gray-200/80 bg-white/80 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.42a8.16 8.16 0 0 0 4.77 1.52V7.49a4.85 4.85 0 0 1-1-.8z"/>
          </svg>
        </div>
        <h2 className="text-lg font-black text-gray-900">TikTok</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
        {tiktokConnections.map(renderConnectionCard)}
      </div>
    </section>
  );
}

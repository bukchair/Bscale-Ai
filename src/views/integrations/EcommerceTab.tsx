'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Connection } from '../../contexts/ConnectionsContext';
import { RenderConnectionCard } from './types';

type EcommerceTabProps = {
  ecommerceConnections: Connection[];
  t: (key: string) => string;
  renderConnectionCard: RenderConnectionCard;
};

export function EcommerceTab({ ecommerceConnections, t, renderConnectionCard }: EcommerceTabProps) {
  if (ecommerceConnections.length === 0) return null;
  return (
    <section className="rounded-3xl border border-gray-200/80 bg-white/80 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-black text-gray-900">{t('integrations.ecommerce')}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
        {ecommerceConnections.map(renderConnectionCard)}
      </div>
    </section>
  );
}

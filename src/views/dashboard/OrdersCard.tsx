'use client';

import React from 'react';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CopyText, STATUS_LABELS } from './types';
import { DemoTag, SourceTag, orderStatusBadgeClass, formatDate } from './helpers';
import { type WooCommerceOrder } from '../../services/woocommerceService';

interface OrdersCardProps {
  text: CopyText;
  dir: string;
  statusLabels: typeof STATUS_LABELS[keyof typeof STATUS_LABELS];
  isOrdersUsingDemo: boolean;
  recentOrders: WooCommerceOrder[];
  formatCurrency: (v: number) => string;
  onGoOrders: () => void;
}

export function OrdersCard({
  text,
  dir,
  statusLabels,
  isOrdersUsingDemo,
  recentOrders,
  formatCurrency,
  onGoOrders,
}: OrdersCardProps) {
  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-gray-900 dark:text-white">{text.latestOrdersCard}</h2>
        </div>
        <DemoTag show={isOrdersUsingDemo} />
      </div>

      <div className="space-y-2">
        {recentOrders.length ? (
          recentOrders.slice(0, 5).map((order) => {
            const customerName =
              `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim() || text.customerFallback;
            return (
              <div key={order.id} className="rounded-xl border border-gray-200 p-2.5 bg-gray-50/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <p className="text-xs font-bold text-gray-900">#{order.number}</p>
                    <SourceTag live={!isOrdersUsingDemo} sourceLive={text.sourceLive} sourceMissing={text.sourceMissing} />
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold',
                        orderStatusBadgeClass(order.status)
                      )}
                    >
                      {statusLabels[(order.status || '').toLowerCase() as keyof typeof statusLabels] || order.status || '—'}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500">{formatDate(order.date_created)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-gray-700 truncate">{customerName}</p>
                  <p className="text-xs font-extrabold text-indigo-700">
                    {formatCurrency(order.total)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-gray-500">{text.noOrders}</p>
        )}
      </div>

      <button
        onClick={onGoOrders}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl py-2"
      >
        {text.goOrdersShort}
        <ArrowRight className={cn('w-4 h-4', dir === 'rtl' ? 'rotate-180' : '')} />
      </button>
    </div>
  );
}

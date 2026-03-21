"use client";

import React from 'react';
import { useConnections } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDateRangeBounds } from '../contexts/DateRangeContext';
import { cn } from '../lib/utils';
import {
  useOrders,
  ORDER_STATUSES,
  type OrderStatus,
  type StatusFilter,
} from './orders/useOrders';
import {
  Loader2,
  AlertCircle,
  Download,
  FileText,
  Filter,
  Search,
  Receipt,
  CreditCard,
  CalendarDays,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export function Orders() {
  const { connections, isWorkspaceReadOnly } = useConnections();
  const { language, dir } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { startDate, endDate } = useDateRangeBounds();
  const isHebrew = dir === 'rtl';

  const {
    isConnected,
    orders,
    statusFilter, setStatusFilter,
    searchTerm, setSearchTerm,
    isLoading,
    updatingOrderId,
    expandedOrderId, setExpandedOrderId,
    error,
    lastSyncLabel,
    filtered,
    totals,
    text,
    interpolate,
    loadOrders,
    handleOrderStatusChange,
    exportCsv,
  } = useOrders({ connections, isWorkspaceReadOnly, language, startDate, endDate });

  const interpolateText = (template: string, value: string | number) => template.replace('{{n}}', String(value));

  const buildAddressLines = (address: {
    first_name?: string; last_name?: string; company?: string;
    address_1?: string; address_2?: string; city?: string;
    state?: string; postcode?: string; country?: string;
    email?: string; phone?: string;
  }) => {
    const fullName = `${address.first_name || ''} ${address.last_name || ''}`.trim();
    const cityLine = [address.city, address.state, address.postcode].filter(Boolean).join(', ');
    return [
      fullName, address.company || '', address.address_1 || '', address.address_2 || '',
      cityLine, address.country || '', address.email || '', address.phone || '',
    ].filter((line) => line && line.trim().length > 0);
  };

  const formatOrderDate = (dateValue?: string | null) => {
    if (!dateValue) return '—';
    return new Date(dateValue).toLocaleString();
  };

  const getStatusBadgeClass = (status: string) =>
    cn(
      'inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold capitalize',
      status === 'completed' ? 'bg-emerald-100 text-emerald-700'
      : status === 'processing' ? 'bg-sky-100 text-sky-700'
      : status === 'pending' ? 'bg-amber-100 text-amber-700'
      : status === 'cancelled' || status === 'refunded' || status === 'failed' ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-700'
    );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <Receipt className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">{text.notConnectedTitle}</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          {text.notConnectedDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-indigo-600" />
              {text.pageTitle}
            </h1>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {text.pageSubtitle}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isLoading ? text.syncingNow : `${text.lastSyncPrefix}: ${lastSyncLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadOrders}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            {text.refresh}
          </button>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {text.exportCsv}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{text.totalOrders}</p>
            <p className="text-xl font-black text-gray-900">{totals.count}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{text.totalRevenue}</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totals.totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{text.dateRange}</p>
            <p className="text-xs font-bold text-gray-900">
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{text.totalShipping}</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totals.totalShipping)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{text.status}</span>
            {isWorkspaceReadOnly && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {text.viewOnly}
              </span>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...ORDER_STATUSES] as StatusFilter[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-bold border',
                      statusFilter === status
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {status === 'all' ? text.all : status}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className={cn(
                'absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400',
                dir === 'rtl' ? 'right-3' : 'left-3'
              )}
            />
            <input
              type="text"
              placeholder={text.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-200 rounded-xl py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all',
                dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'
              )}
            />
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {isLoading && !orders.length ? (
            <div className="px-3 py-8 text-center text-gray-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              {text.loadingOrders}
            </div>
          ) : !filtered.length ? (
            <div className="px-3 py-8 text-center text-gray-400 text-sm">
              {text.noOrdersFound}
            </div>
          ) : (
            filtered.map((o) => {
              const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim() || '—';
              const itemLines = o.line_items.map((li) => {
                const sku = li.sku ? ` | SKU: ${li.sku}` : '';
                const itemTotal = li.total ? ` | ${text.total}: ${li.total} ${o.currency}` : '';
                return `${li.name}${sku} | ${text.qty}: ${li.quantity}${itemTotal}`;
              });
              const customerNote = (o.customer_note || '').trim();
              const isUpdatingStatus = updatingOrderId === o.id;
              const statusValue = ORDER_STATUSES.includes(o.status as OrderStatus) ? (o.status as OrderStatus) : '';
              const isExpanded = expandedOrderId === o.id;
              const billingLines = buildAddressLines({
                ...o.billing,
                email: o.billing.email,
                phone: o.billing.phone,
              });
              const shippingLines = buildAddressLines(o.shipping);

              return (
                <div key={`mobile-${o.id}`} className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-gray-500">#{o.number}</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{customerName}</p>
                      <p className="text-[11px] text-gray-500">{formatOrderDate(o.date_created)}</p>
                    </div>
                    <button
                      onClick={() => setExpandedOrderId((prev) => (prev === o.id ? null : o.id))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? text.hide : text.details}
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-500">{text.total}</span>
                      <span className="font-extrabold text-gray-900">{formatCurrency(o.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-500">{text.payment}</span>
                      <span className="text-gray-800 text-end break-words">{o.payment_method_title || o.payment_method || '—'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-gray-500 mt-0.5">{text.email}</span>
                      <span className="text-gray-800 text-end break-all">{o.billing.email || '—'}</span>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <span className={getStatusBadgeClass(o.status)}>{o.status}</span>
                      <select
                        value={statusValue}
                        onChange={(e) => handleOrderStatusChange(o.id, e.target.value as OrderStatus)}
                        disabled={isUpdatingStatus || isWorkspaceReadOnly}
                        className="w-full border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs text-gray-700 font-semibold disabled:opacity-60"
                        aria-label={interpolateText(text.updateStatusAria, o.number)}
                      >
                        {!statusValue && (
                          <option value="" disabled>
                            {o.status || 'unknown'}
                          </option>
                        )}
                        {ORDER_STATUSES.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
                          </option>
                        ))}
                      </select>
                      {isUpdatingStatus && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {text.updating}
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{text.orderDetails}</p>
                        <p className="text-gray-700">{text.internalId}: {o.id}</p>
                        <p className="text-gray-700">{text.createdAt}: {formatOrderDate(o.date_created)}</p>
                        <p className="text-gray-700">{text.updatedAt}: {formatOrderDate(o.date_modified)}</p>
                        <p className="text-gray-700">{text.completedAt}: {formatOrderDate(o.date_completed)}</p>
                        <p className="text-gray-700">{text.currency}: {o.currency || '—'}</p>
                        <p className="text-gray-700">{text.shippingTotal}: {formatCurrency(o.shipping_total)}</p>
                        <p className="text-gray-700">{text.taxTotal}: {formatCurrency(o.total_tax)}</p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{text.billingAddress}</p>
                        {billingLines.length ? (
                          billingLines.map((line, idx) => (
                            <p key={`mobile-billing-${o.id}-${idx}`} className="text-gray-700 break-words">
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="text-gray-400">{text.noBillingAddress}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{text.shippingAddress}</p>
                        {shippingLines.length ? (
                          shippingLines.map((line, idx) => (
                            <p key={`mobile-shipping-${o.id}-${idx}`} className="text-gray-700 break-words">
                              {line}
                            </p>
                          ))
                        ) : (
                          <p className="text-gray-400">{text.noShippingAddress}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{text.products}</p>
                        {itemLines.length ? (
                          <div className="space-y-1">
                            {itemLines.map((itemLine, idx) => (
                              <p key={`mobile-item-${o.id}-${idx}`} className="text-gray-700 break-words">
                                {itemLine}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400">{text.noProducts}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{text.customerNote}</p>
                        <p className={customerNote ? 'text-gray-700 break-words' : 'text-gray-400'}>
                          {customerNote || '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2 text-start font-semibold">#</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableDate}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableCustomer}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableEmail}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableStatus}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableAmount}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tablePaymentMethod}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableProducts}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableNotes}</th>
                <th className="px-3 py-2 text-start font-semibold">{text.tableDetails}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !orders.length ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    {text.loadingOrders}
                  </td>
                </tr>
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                    {text.noOrdersFound}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim() || '—';
                  const itemLines = o.line_items.map((li) => {
                    const sku = li.sku ? ` | SKU: ${li.sku}` : '';
                    const itemTotal = li.total ? ` | ${text.total}: ${li.total} ${o.currency}` : '';
                    return `${li.name}${sku} | ${text.qty}: ${li.quantity}${itemTotal}`;
                  });
                  const customerNote = (o.customer_note || '').trim();
                  const isUpdatingStatus = updatingOrderId === o.id;
                  const statusValue = ORDER_STATUSES.includes(o.status as OrderStatus) ? (o.status as OrderStatus) : '';
                  const isExpanded = expandedOrderId === o.id;
                  const billingLines = buildAddressLines({
                    ...o.billing,
                    email: o.billing.email,
                    phone: o.billing.phone,
                  });
                  const shippingLines = buildAddressLines(o.shipping);
                  return (
                    <React.Fragment key={o.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-[11px] text-gray-600">#{o.number}</td>
                        <td className="px-3 py-2 text-gray-700">{formatOrderDate(o.date_created)}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium">{customerName}</td>
                        <td className="px-3 py-2 text-gray-600">{o.billing.email || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-1.5 min-w-[130px]">
                            <span className={getStatusBadgeClass(o.status)}>{o.status}</span>
                            <select
                              value={statusValue}
                              onChange={(e) => handleOrderStatusChange(o.id, e.target.value as OrderStatus)}
                              disabled={isUpdatingStatus || isWorkspaceReadOnly}
                              className="w-full border border-gray-200 bg-white rounded-lg px-2 py-1 text-[11px] text-gray-700 font-semibold disabled:opacity-60"
                              aria-label={interpolateText(text.updateStatusAria, o.number)}
                            >
                              {!statusValue && (
                                <option value="" disabled>
                                  {o.status || 'unknown'}
                                </option>
                              )}
                              {ORDER_STATUSES.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {statusOption}
                                </option>
                              ))}
                            </select>
                            {isUpdatingStatus && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {text.updating}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap">
                          {formatCurrency(o.total)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {o.payment_method_title || o.payment_method || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 min-w-[220px] max-w-[420px]">
                          {itemLines.length ? (
                            <div className="space-y-1 whitespace-normal break-words leading-relaxed">
                              {itemLines.map((itemLine, idx) => (
                                <div key={`${o.id}-item-${idx}`}>{itemLine}</div>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-xs whitespace-normal break-words">
                          {customerNote}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setExpandedOrderId((prev) => (prev === o.id ? null : o.id))}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {isExpanded ? text.close : text.open}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <td colSpan={10} className="px-3 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs sm:text-sm">
                              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1">
                                <p className="font-bold text-gray-900">{text.orderDetails}</p>
                                <p className="text-gray-700"># {o.number}</p>
                                <p className="text-gray-700">{text.internalId}: {o.id}</p>
                                <p className="text-gray-700">{text.createdAt}: {formatOrderDate(o.date_created)}</p>
                                <p className="text-gray-700">{text.updatedAt}: {formatOrderDate(o.date_modified)}</p>
                                <p className="text-gray-700">{text.completedAt}: {formatOrderDate(o.date_completed)}</p>
                                <p className="text-gray-700">{text.currency}: {o.currency || '—'}</p>
                                <p className="text-gray-700">{text.orderTotal}: {formatCurrency(o.total)}</p>
                                <p className="text-gray-700">{text.shippingTotal}: {formatCurrency(o.shipping_total)}</p>
                                <p className="text-gray-700">{text.taxTotal}: {formatCurrency(o.total_tax)}</p>
                                <p className="text-gray-700">{text.payment}: {o.payment_method_title || o.payment_method || '—'}</p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1">
                                <p className="font-bold text-gray-900">{text.billingAddress}</p>
                                {billingLines.length ? (
                                  billingLines.map((line, idx) => (
                                    <p key={`billing-${o.id}-${idx}`} className="text-gray-700 break-words">
                                      {line}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-gray-400">{text.noBillingAddress}</p>
                                )}
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1">
                                <p className="font-bold text-gray-900">{text.shippingAddress}</p>
                                {shippingLines.length ? (
                                  shippingLines.map((line, idx) => (
                                    <p key={`shipping-${o.id}-${idx}`} className="text-gray-700 break-words">
                                      {line}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-gray-400">{text.noShippingAddress}</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


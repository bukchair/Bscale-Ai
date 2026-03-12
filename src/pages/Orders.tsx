import React, { useEffect, useMemo, useState } from 'react';
import { useConnections } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDateRangeBounds } from '../contexts/DateRangeContext';
import { fetchWooCommerceOrdersByRange, type WooCommerceOrder } from '../services/woocommerceService';
import { cn } from '../lib/utils';
import {
  Loader2,
  AlertCircle,
  Download,
  FileText,
  Filter,
  Search,
  Receipt,
  CreditCard,
  CalendarDays
} from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded' | 'failed';

export function Orders() {
  const { connections } = useConnections();
  const { t, dir } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { startDate, endDate } = useDateRangeBounds();

  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wooConnection = connections.find((c) => c.id === 'woocommerce');
  const isConnected = wooConnection?.status === 'connected';
  const { storeUrl, wooKey, wooSecret } = wooConnection?.settings || {};

  const isoMin = useMemo(() => startDate.toISOString(), [startDate]);
  const isoMax = useMemo(() => endDate.toISOString(), [endDate]);

  const loadOrders = async () => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) {
      setOrders([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWooCommerceOrdersByRange(storeUrl, wooKey, wooSecret, isoMin, isoMax);
      setOrders(data);
    } catch (e) {
      console.error(e);
      setError('שגיאה בטעינת הזמנות מ‑WooCommerce. בדוק את החיבור או נסה שוב מאוחר יותר.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadOrders();
    }
  }, [isConnected, isoMin, isoMax]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const haystack = [
        o.number,
        o.billing.first_name,
        o.billing.last_name,
        o.billing.email,
        o.customer_note,
        o.line_items.map((li) => li.name).join(' ')
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, statusFilter, searchTerm]);

  const totals = useMemo(() => {
    const totalRevenue = filtered.reduce((sum, o) => sum + (isNaN(o.total) ? 0 : o.total), 0);
    const totalShipping = filtered.reduce((sum, o) => sum + (isNaN(o.shipping_total) ? 0 : o.shipping_total), 0);
    const count = filtered.length;
    return { totalRevenue, totalShipping, count };
  }, [filtered]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      'id',
      'number',
      'status',
      'date_created',
      'customer_name',
      'customer_email',
      'total',
      'currency',
      'payment_method',
      'shipping_city',
      'shipping_country',
      'items',
      'customer_note',
      'meta_notes'
    ];
    const rows = filtered.map((o) => {
      const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim();
      const items = o.line_items.map((li) => `${li.name} x${li.quantity} (${li.total})`).join(' | ');
      const metaNotes = (o.meta_data || [])
        .filter((m) => typeof m.value === 'string')
        .map((m) => `${m.key}: ${m.value}`)
        .join(' | ');
      return [
        o.id,
        o.number,
        o.status,
        o.date_created,
        customerName,
        o.billing.email || '',
        o.total,
        o.currency,
        o.payment_method_title || o.payment_method || '',
        o.shipping.city || '',
        o.shipping.country || '',
        items,
        (o.customer_note || '').replace(/\s+/g, ' '),
        metaNotes.replace(/\s+/g, ' ')
      ];
    });

    const csvContent =
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bscale-woocommerce-orders.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <Receipt className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">WooCommerce לא מחובר</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          חבר את חנות ה‑WooCommerce שלך במסך החיבורים כדי לראות רשימת הזמנות מלאה, סטטוסים וסיכומי הכנסות.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-indigo-600" />
              הזמנות WooCommerce
            </h1>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            טאב ייעודי לניהול הזמנות, סטטוסים, הערות ויצוא דוחות. הסכומים כאן מסונכרנים לטווח התאריכים של דוחות
            הרווחיות.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadOrders}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            רענון נתונים
          </button>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            יצוא CSV
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">סה"כ הזמנות</p>
            <p className="text-xl font-black text-gray-900">{totals.count}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">סה"כ הכנסות לפי הזמנות</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totals.totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">טווח תאריכים</p>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">סה"כ משלוח</p>
            <p className="text-xl font-black text-gray-900">{formatCurrency(totals.totalShipping)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">סטטוס</span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'processing', 'completed', 'cancelled', 'refunded', 'failed'] as StatusFilter[]).map(
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
                    {status === 'all' ? 'הכל' : status}
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
              placeholder="חיפוש לפי שם לקוח, אימייל או מוצר..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-full bg-white border border-gray-200 rounded-xl py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all',
                dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'
              )}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2 text-start font-semibold">#</th>
                <th className="px-3 py-2 text-start font-semibold">תאריך</th>
                <th className="px-3 py-2 text-start font-semibold">לקוח</th>
                <th className="px-3 py-2 text-start font-semibold">אימייל</th>
                <th className="px-3 py-2 text-start font-semibold">סטטוס</th>
                <th className="px-3 py-2 text-start font-semibold">סכום</th>
                <th className="px-3 py-2 text-start font-semibold">שיטת תשלום</th>
                <th className="px-3 py-2 text-start font-semibold">מוצרים</th>
                <th className="px-3 py-2 text-start font-semibold">הערות</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !orders.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    טוען הזמנות מ‑WooCommerce...
                  </td>
                </tr>
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    לא נמצאו הזמנות לטווח תאריכים זה או לפי הפילטרים הנוכחיים.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim() || '—';
                  const items = o.line_items.map((li) => `${li.name} x${li.quantity}`).join(' | ');
                  const metaNotes = (o.meta_data || [])
                    .filter((m) => typeof m.value === 'string')
                    .map((m) => `${m.key}: ${m.value}`)
                    .join(' | ');
                  return (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-600">#{o.number}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {o.date_created ? new Date(o.date_created).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{customerName}</td>
                      <td className="px-3 py-2 text-gray-600">{o.billing.email || '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-bold capitalize',
                            o.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : o.status === 'processing'
                              ? 'bg-sky-100 text-sky-700'
                              : o.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : o.status === 'cancelled' || o.status === 'refunded'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-gray-900 whitespace-nowrap">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {o.payment_method_title || o.payment_method || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs truncate" title={items}>
                        {items || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                        {o.customer_note || metaNotes || '—'}
                      </td>
                    </tr>
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


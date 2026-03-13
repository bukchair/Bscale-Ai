import React, { useEffect, useMemo, useState } from 'react';
import { useConnections } from '../contexts/ConnectionsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDateRangeBounds } from '../contexts/DateRangeContext';
import {
  fetchWooCommerceOrdersByRange,
  updateWooCommerceOrderStatus,
  type WooCommerceOrder
} from '../services/woocommerceService';
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
  CalendarDays,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const ORDER_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];
type StatusFilter = 'all' | OrderStatus;
const COPY = {
  he: {
    notSynced: 'טרם סונכרן',
    secondsAgo: 'לפני {{n}} שניות',
    minutesAgo: 'לפני {{n}} דקות',
    hoursAgo: 'לפני {{n}} שעות',
    missingWooConfig: 'חיבור WooCommerce קיים אך חסרים Store URL או מפתחות API.',
    unknownError: 'שגיאה לא ידועה',
    loadOrdersErrorPrefix: 'שגיאה בטעינת הזמנות מ‑WooCommerce',
    updateOrderStatusErrorPrefix: 'שגיאה בעדכון סטטוס הזמנה',
    notConnectedTitle: 'WooCommerce לא מחובר',
    notConnectedDesc: 'חבר את חנות ה‑WooCommerce שלך במסך החיבורים כדי לראות רשימת הזמנות מלאה, סטטוסים וסיכומי הכנסות.',
    pageTitle: 'הזמנות WooCommerce',
    pageSubtitle: 'טאב ייעודי לניהול הזמנות, סטטוסים, הערות ויצוא דוחות. הסכומים כאן מסונכרנים לטווח התאריכים של דוחות הרווחיות.',
    syncingNow: 'מסנכרן עכשיו...',
    lastSyncPrefix: 'סנכרון אחרון',
    refresh: 'רענון נתונים',
    exportCsv: 'יצוא CSV',
    totalOrders: 'סה"כ הזמנות',
    totalRevenue: 'סה"כ הכנסות לפי הזמנות',
    dateRange: 'טווח תאריכים',
    totalShipping: 'סה"כ משלוח',
    status: 'סטטוס',
    viewOnly: 'צפייה בלבד',
    all: 'הכל',
    searchPlaceholder: 'חיפוש לפי שם לקוח, אימייל או מוצר...',
    loadingOrders: 'טוען הזמנות מ‑WooCommerce...',
    noOrdersFound: 'לא נמצאו הזמנות לטווח תאריכים זה או לפי הפילטרים הנוכחיים.',
    details: 'פרטים',
    open: 'פתח',
    close: 'הסתר',
    hide: 'הסתר',
    payment: 'תשלום',
    email: 'אימייל',
    orderDetails: 'פרטי הזמנה',
    internalId: 'מזהה פנימי',
    createdAt: 'נוצר בתאריך',
    updatedAt: 'עודכן בתאריך',
    completedAt: 'הושלם בתאריך',
    currency: 'מטבע',
    orderTotal: 'סה"כ הזמנה',
    shippingTotal: 'סה"כ משלוח',
    taxTotal: 'סה"כ מס',
    billingAddress: 'כתובת חיוב',
    shippingAddress: 'כתובת משלוח',
    noBillingAddress: 'אין נתוני כתובת חיוב',
    noShippingAddress: 'אין נתוני כתובת משלוח',
    products: 'מוצרים',
    noProducts: 'אין מוצרים בהזמנה זו',
    customerNote: 'הערת לקוח',
    qty: 'כמות',
    total: 'סה"כ',
    updating: 'מעדכן...',
    tableDate: 'תאריך',
    tableCustomer: 'לקוח',
    tableEmail: 'אימייל',
    tableStatus: 'סטטוס',
    tableAmount: 'סכום',
    tablePaymentMethod: 'שיטת תשלום',
    tableProducts: 'מוצרים',
    tableNotes: 'הערות',
    tableDetails: 'פרטים',
    updateStatusAria: 'עדכון סטטוס הזמנה {{n}}',
  },
  en: {
    notSynced: 'Not synced yet',
    secondsAgo: '{{n}} seconds ago',
    minutesAgo: '{{n}} minutes ago',
    hoursAgo: '{{n}} hours ago',
    missingWooConfig: 'WooCommerce connection exists but Store URL or API keys are missing.',
    unknownError: 'Unknown error',
    loadOrdersErrorPrefix: 'Error loading orders from WooCommerce',
    updateOrderStatusErrorPrefix: 'Error updating order status',
    notConnectedTitle: 'WooCommerce not connected',
    notConnectedDesc: 'Connect your WooCommerce store in integrations to view the full orders list, statuses and revenue totals.',
    pageTitle: 'WooCommerce Orders',
    pageSubtitle: 'Dedicated tab for managing orders, statuses, notes and CSV export. Values are synced to the profitability date range.',
    syncingNow: 'Syncing now...',
    lastSyncPrefix: 'Last sync',
    refresh: 'Refresh data',
    exportCsv: 'Export CSV',
    totalOrders: 'Total orders',
    totalRevenue: 'Total revenue from orders',
    dateRange: 'Date range',
    totalShipping: 'Total shipping',
    status: 'Status',
    viewOnly: 'View only',
    all: 'All',
    searchPlaceholder: 'Search by customer name, email or product...',
    loadingOrders: 'Loading orders from WooCommerce...',
    noOrdersFound: 'No orders found for this date range or current filters.',
    details: 'Details',
    open: 'Open',
    close: 'Hide',
    hide: 'Hide',
    payment: 'Payment',
    email: 'Email',
    orderDetails: 'Order details',
    internalId: 'Internal ID',
    createdAt: 'Created at',
    updatedAt: 'Updated at',
    completedAt: 'Completed at',
    currency: 'Currency',
    orderTotal: 'Order total',
    shippingTotal: 'Shipping total',
    taxTotal: 'Tax total',
    billingAddress: 'Billing address',
    shippingAddress: 'Shipping address',
    noBillingAddress: 'No billing address data',
    noShippingAddress: 'No shipping address data',
    products: 'Products',
    noProducts: 'No products in this order',
    customerNote: 'Customer note',
    qty: 'Qty',
    total: 'Total',
    updating: 'Updating...',
    tableDate: 'Date',
    tableCustomer: 'Customer',
    tableEmail: 'Email',
    tableStatus: 'Status',
    tableAmount: 'Amount',
    tablePaymentMethod: 'Payment method',
    tableProducts: 'Products',
    tableNotes: 'Notes',
    tableDetails: 'Details',
    updateStatusAria: 'Update order status {{n}}',
  },
  ru: {} as Record<string, string>,
  pt: {} as Record<string, string>,
  fr: {} as Record<string, string>,
} as const;

export function Orders() {
  const { connections, isWorkspaceReadOnly } = useConnections();
  const { language, dir } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { startDate, endDate } = useDateRangeBounds();
  const baseText = COPY.en;
  const localizedText = COPY[language as keyof typeof COPY] as Record<string, string>;
  const text = { ...baseText, ...localizedText };
  const interpolate = (template: string, value: number) => template.replace('{{n}}', String(value));
  const interpolateText = (template: string, value: string | number) => template.replace('{{n}}', String(value));

  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncTick, setSyncTick] = useState(0);

  const wooConnection = connections.find((c) => c.id === 'woocommerce');
  const isConnected = wooConnection?.status === 'connected';
  const { storeUrl, wooKey, wooSecret } = wooConnection?.settings || {};

  const isoMin = useMemo(() => startDate.toISOString(), [startDate]);
  const isoMax = useMemo(() => endDate.toISOString(), [endDate]);
  const cleanError = (value: string) =>
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSyncTick((prev) => prev + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncedAt) return text.notSynced;
    const diffMs = Date.now() - lastSyncedAt.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return interpolate(text.secondsAgo, diffSeconds);
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return interpolate(text.minutesAgo, diffMinutes);
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return interpolate(text.hoursAgo, diffHours);
    return lastSyncedAt.toLocaleString();
  }, [lastSyncedAt, syncTick, text.notSynced, text.secondsAgo, text.minutesAgo, text.hoursAgo]);

  const loadOrders = async () => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) {
      setOrders([]);
      if (isConnected) {
        setError(text.missingWooConfig);
      } else {
        setError(null);
      }
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWooCommerceOrdersByRange(storeUrl, wooKey, wooSecret, isoMin, isoMax);
      setOrders(data);
      setLastSyncedAt(new Date());
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : text.unknownError;
      setError(`${text.loadOrdersErrorPrefix}: ${cleanError(message)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderStatusChange = async (orderId: number, nextStatus: OrderStatus) => {
    if (isWorkspaceReadOnly) return;
    if (!storeUrl || !wooKey || !wooSecret) return;
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!targetOrder || targetOrder.status === nextStatus) return;

    const prevStatus = targetOrder.status;
    setError(null);
    setUpdatingOrderId(orderId);
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
    );

    try {
      await updateWooCommerceOrderStatus(storeUrl, wooKey, wooSecret, orderId, nextStatus);
      setLastSyncedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : text.unknownError;
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: prevStatus } : order))
      );
      setError(`${text.updateOrderStatusErrorPrefix} #${targetOrder.number}: ${cleanError(message)}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadOrders();
    }
  }, [isConnected, storeUrl, wooKey, wooSecret, isoMin, isoMax]);

  useEffect(() => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) return;
    const interval = window.setInterval(() => {
      loadOrders();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [isConnected, storeUrl, wooKey, wooSecret, isoMin, isoMax]);

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
      'customer_note'
    ];
    const rows = filtered.map((o) => {
      const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim();
      const items = o.line_items.map((li) => `${li.name} x${li.quantity} (${li.total})`).join(' | ');
      const customerNote = (o.customer_note || '').trim();
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
        customerNote.replace(/\s+/g, ' ')
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

  const buildAddressLines = (address: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    email?: string;
    phone?: string;
  }) => {
    const fullName = `${address.first_name || ''} ${address.last_name || ''}`.trim();
    const cityLine = [address.city, address.state, address.postcode].filter(Boolean).join(', ');
    return [
      fullName,
      address.company || '',
      address.address_1 || '',
      address.address_2 || '',
      cityLine,
      address.country || '',
      address.email || '',
      address.phone || '',
    ].filter((line) => line && line.trim().length > 0);
  };

  const formatOrderDate = (dateValue?: string | null) => {
    if (!dateValue) return '—';
    return new Date(dateValue).toLocaleString();
  };

  const getStatusBadgeClass = (status: string) =>
    cn(
      'inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold capitalize',
      status === 'completed'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'processing'
        ? 'bg-sky-100 text-sky-700'
        : status === 'pending'
        ? 'bg-amber-100 text-amber-700'
        : status === 'cancelled' || status === 'refunded' || status === 'failed'
        ? 'bg-red-100 text-red-700'
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
          <div className="flex items-center gap-2">
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
                          <div className="space-y-1.5 min-w-[150px]">
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
                        <td className="px-3 py-2 text-gray-700 min-w-[280px] max-w-[420px]">
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


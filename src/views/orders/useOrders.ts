import { useEffect, useMemo, useState } from 'react';
import {
  fetchWooCommerceOrdersByRange,
  updateWooCommerceOrderStatus,
  type WooCommerceOrder,
} from '../../services/woocommerceService';
import type { Connection } from '../../contexts/ConnectionsContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type StatusFilter = 'all' | OrderStatus;

export const COPY = {
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseOrdersProps {
  connections: Connection[];
  isWorkspaceReadOnly: boolean;
  language: string;
  startDate: Date;
  endDate: Date;
}

export function useOrders({ connections, isWorkspaceReadOnly, language, startDate, endDate }: UseOrdersProps) {
  const baseText = COPY.en;
  const localizedText = COPY[language as keyof typeof COPY] as Record<string, string>;
  const text = { ...baseText, ...localizedText };

  const interpolate = (template: string, value: number) => template.replace('{{n}}', String(value));

  // ── WooCommerce connection ─────────────────────────────────────────────────
  const wooConnection = connections.find((c) => c.id === 'woocommerce');
  const isConnected = wooConnection?.status === 'connected';
  const { storeUrl, wooKey, wooSecret } = wooConnection?.settings || {};

  const isoMin = useMemo(() => startDate.toISOString(), [startDate]);
  const isoMax = useMemo(() => endDate.toISOString(), [endDate]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncTick, setSyncTick] = useState(0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const cleanError = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setSyncTick((prev) => prev + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Memos ──────────────────────────────────────────────────────────────────
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
  }, [lastSyncedAt, syncTick, text.notSynced, text.secondsAgo, text.minutesAgo, text.hoursAgo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const loadOrders = async () => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) {
      setOrders([]);
      setError(isConnected ? text.missingWooConfig : null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWooCommerceOrdersByRange(storeUrl, wooKey, wooSecret, isoMin, isoMax);
      setOrders(data);
      setLastSyncedAt(new Date());
    } catch (e) {
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

  // ── Effects: load on dependency changes ───────────────────────────────────
  useEffect(() => {
    if (isConnected) void loadOrders();
  }, [isConnected, storeUrl, wooKey, wooSecret, isoMin, isoMax]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isConnected || !storeUrl || !wooKey || !wooSecret) return;
    const interval = window.setInterval(() => void loadOrders(), 60000);
    return () => window.clearInterval(interval);
  }, [isConnected, storeUrl, wooKey, wooSecret, isoMin, isoMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memos: filtered + totals ───────────────────────────────────────────────
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
        o.line_items.map((li) => li.name).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, statusFilter, searchTerm]);

  const totals = useMemo(() => {
    const totalRevenue = filtered.reduce((sum, o) => sum + (isNaN(o.total) ? 0 : o.total), 0);
    const totalShipping = filtered.reduce((sum, o) => sum + (isNaN(o.shipping_total) ? 0 : o.shipping_total), 0);
    return { totalRevenue, totalShipping, count: filtered.length };
  }, [filtered]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      'id', 'number', 'status', 'date_created', 'customer_name', 'customer_email',
      'total', 'currency', 'payment_method', 'shipping_city', 'shipping_country',
      'items', 'customer_note',
    ];
    const rows = filtered.map((o) => {
      const customerName = `${o.billing.first_name || ''} ${o.billing.last_name || ''}`.trim();
      const items = o.line_items.map((li) => `${li.name} x${li.quantity} (${li.total})`).join(' | ');
      return [
        o.id, o.number, o.status, o.date_created, customerName, o.billing.email || '',
        o.total, o.currency, o.payment_method_title || o.payment_method || '',
        o.shipping.city || '', o.shipping.country || '', items,
        (o.customer_note || '').trim().replace(/\s+/g, ' '),
      ];
    });
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
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

  return {
    // connection
    isConnected,
    wooConnection,
    // state
    orders,
    statusFilter, setStatusFilter,
    searchTerm, setSearchTerm,
    isLoading,
    updatingOrderId,
    expandedOrderId, setExpandedOrderId,
    error,
    lastSyncLabel,
    // data
    filtered,
    totals,
    // text
    text,
    interpolate,
    // handlers
    loadOrders,
    handleOrderStatusChange,
    exportCsv,
  };
}

import { API_BASE } from '../lib/utils/client-api-base';

const sanitizeWooErrorText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function verifyWooCommerceConnection(url: string, key: string, secret: string) {
  if (!url || !key || !secret || key === 'mock' || secret === 'mock') {
    throw new Error('Missing or invalid credentials');
  }

  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, secret, endpoint: 'system_status' })
    });

    let data;
    const text = await response.text();
    
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Failed to parse server response: ${text.substring(0, 100)}`);
      }
    } else {
      throw new Error(`Empty response from server (Status: ${response.status})`);
    }
    
    if (!response.ok) {
      throw new Error(data.message || `WooCommerce API Error: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("WooCommerce Verification Error:", error);
    throw error;
  }
}

type FetchWooCommerceProductsOptions = {
  fallbackToMock?: boolean;
};

export async function fetchWooCommerceProducts(
  url: string,
  key: string,
  secret: string,
  options?: FetchWooCommerceProductsOptions
) {
  const fallbackToMock = options?.fallbackToMock ?? true;
  // Mock data for demo purposes
  const mockProducts = [
    {
      id: 1,
      name: "נעלי ריצה מקצועיות - דגם 2024",
      sku: "RUN-2024-BL",
      stock_quantity: 15,
      short_description: "נעלי ריצה קלות משקל עם טכנולוגיית שיכוך מתקדמת.",
      description: "נעלי הריצה החדשות שלנו מציעות נוחות מקסימלית וביצועים גבוהים לכל סוגי המשטחים. מתאימות לרצים מתחילים ומקצוענים כאחד.",
      price: "450",
      categories: [{ name: "נעליים" }]
    },
    {
      id: 2,
      name: "חולצת דריי-פיט מנדפת זיעה",
      sku: "TSH-DF-GR",
      stock_quantity: 42,
      short_description: "חולצת ספורט איכותית לביצועים מקסימליים.",
      description: "חולצה מנדפת זיעה השומרת על גוף יבש וקריר גם באימונים אינטנסיביים ביותר. בד גמיש ונעים למגע.",
      price: "120",
      categories: [{ name: "ביגוד" }]
    },
    {
      id: 3,
      name: "תיק גב למחשב נייד - חסין מים",
      sku: "BP-WP-15",
      stock_quantity: 8,
      short_description: "תיק גב מעוצב עם הגנה מלאה למחשב.",
      description: "תיק גב איכותי עם תא מרופד למחשב נייד עד 15.6 אינץ'. בד דוחה מים ורוכסנים עמידים.",
      price: "280",
      categories: [{ name: "אביזרים" }]
    },
    {
      id: 4,
      name: "שעון דופק חכם - סדרה 5",
      sku: "SW-S5-BLK",
      stock_quantity: 0,
      short_description: "שעון חכם למעקב אחר פעילות גופנית.",
      description: "שעון חכם מתקדם הכולל מד דופק, GPS מובנה, ומעקב אחר שינה. סוללה חזקה במיוחד עד 10 ימים.",
      price: "850",
      categories: [{ name: "טכנולוגיה" }]
    }
  ];

  // If credentials are "mock", return mock data immediately
  if (key === 'mock' || secret === 'mock' || !url) {
    return mockProducts;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, secret, endpoint: 'products' })
    });
    
    let data;
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!fallbackToMock) {
          throw new Error(`Failed to parse products response: ${text.substring(0, 160)}`);
        }
        console.warn("Failed to parse products response, falling back to mock data");
        return mockProducts;
      }
    } else {
      if (!fallbackToMock) {
        throw new Error(`Empty products response from WooCommerce proxy (status: ${response.status}).`);
      }
      console.warn("Empty products response, falling back to mock data");
      return mockProducts;
    }

    if (!response.ok) {
      if (!fallbackToMock) {
        const message = sanitizeWooErrorText(
          String(data?.message || data?.error || response.statusText || 'WooCommerce products request failed.')
        );
        throw new Error(message || `WooCommerce API Error: ${response.statusText}`);
      }
      console.warn(`WooCommerce API Error: ${response.statusText}. Falling back to mock data.`);
      return mockProducts;
    }

    return Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : [];
  } catch (error) {
    if (!fallbackToMock) {
      throw error;
    }
    console.error("WooCommerce Fetch Error, falling back to mock data:", error);
    return mockProducts;
  }
}

export async function updateWooCommerceProduct(url: string, key: string, secret: string, productId: number, data: Record<string, unknown>) {
  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, secret, endpoint: `products/${productId}`, method: 'PUT', data })
    });
    
    if (!response.ok) {
      throw new Error(`WooCommerce API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("WooCommerce Update Error:", error);
    throw error;
  }
}

export async function updateWooCommerceOrderStatus(
  url: string,
  key: string,
  secret: string,
  orderId: number,
  status: string
) {
  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key, secret, endpoint: `orders/${orderId}`, method: 'PUT', data: { status } })
    });

    const text = await response.text();
    let payload: { message?: string } | null = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (!response.ok) {
          throw new Error(`WooCommerce API Error (${response.status})`);
        }
      }
    }

    if (!response.ok) {
      const rawMessage =
        (payload && typeof payload.message === 'string' && payload.message) ||
        `WooCommerce API Error (${response.status})`;
      throw new Error(sanitizeWooErrorText(rawMessage));
    }

    return payload;
  } catch (error) {
    console.error('WooCommerce Order Status Update Error:', error);
    throw error;
  }
}

export async function fetchWooCommerceRevenue(url: string, key: string, secret: string): Promise<number> {
  if (!url || !key || !secret) {
    return 0;
  }

  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        key,
        secret,
        endpoint: 'reports/sales?period=month'
      })
    });

    const text = await response.text();
    if (!text) {
      return 0;
    }

    type SalesReport = { total_sales?: string | number };
    let data: SalesReport | SalesReport[];
    try {
      data = JSON.parse(text) as SalesReport | SalesReport[];
    } catch {
      console.warn('Failed to parse WooCommerce revenue response, returning 0');
      return 0;
    }

    // WooCommerce reports API can return array or single object
    const first = Array.isArray(data) ? data[0] : data;
    const total = typeof first?.total_sales === 'string'
      ? parseFloat(first.total_sales || '0')
      : Number(first?.total_sales || 0);

    return isNaN(total) ? 0 : total;
  } catch (error) {
    console.error('WooCommerce revenue fetch error:', error);
    return 0;
  }
}

export interface WooCommerceSalesPoint {
  date: string;
  totalSales: number;
  netSales: number;
  orders: number;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: number;
  total_tax: number;
  shipping_total: number;
  payment_method: string;
  payment_method_title: string;
  date_created: string;
  date_modified: string;
  date_completed: string | null;
  customer_note: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  line_items: {
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    total: string;
    total_tax: string;
    sku?: string;
  }[];
  meta_data?: { key: string; value: any }[];
}

export async function fetchWooCommerceSalesByRange(
  url: string,
  key: string,
  secret: string,
  dateMin: string,
  dateMax: string
): Promise<WooCommerceSalesPoint[]> {
  if (!url || !key || !secret) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        key,
        secret,
        endpoint: `reports/sales?date_min=${dateMin}&date_max=${dateMax}`
      })
    });

    const text = await response.text();
    if (!text) {
      return [];
    }

    type SalesRangeRow = { total_sales?: string | number; net_sales?: string | number; total_orders?: number; date?: string; start_date?: string };
    let data: SalesRangeRow | SalesRangeRow[];
    try {
      data = JSON.parse(text) as SalesRangeRow | SalesRangeRow[];
    } catch {
      console.warn('Failed to parse WooCommerce sales range response, returning empty list');
      return [];
    }

    const rows: SalesRangeRow[] = Array.isArray(data) ? data : [data];

    return rows.map((row) => {
      const total = typeof row.total_sales === 'string' ? parseFloat(row.total_sales || '0') : Number(row.total_sales || 0);
      const net = typeof row.net_sales === 'string' ? parseFloat(row.net_sales || '0') : Number(row.net_sales || 0);
      const orders = Number(row.total_orders || 0);
      const date =
        typeof row.date === 'string'
          ? row.date
          : typeof row.start_date === 'string'
          ? row.start_date
          : '';

      return {
        date,
        totalSales: isNaN(total) ? 0 : total,
        netSales: isNaN(net) ? 0 : net,
        orders: isNaN(orders) ? 0 : orders,
      };
    });
  } catch (error) {
    console.error('WooCommerce sales range fetch error:', error);
    return [];
  }
}

export async function fetchWooCommerceOrdersByRange(
  url: string,
  key: string,
  secret: string,
  dateMinISO: string,
  dateMaxISO: string
): Promise<WooCommerceOrder[]> {
  if (!url || !key || !secret) {
    return [];
  }

  // When working in demo/mock mode, return a small static set of orders
  if (key === 'mock' || secret === 'mock') {
    return [
      {
        id: 101,
        number: '101',
        status: 'completed',
        currency: 'ILS',
        total: 1349,
        total_tax: 0,
        shipping_total: 0,
        payment_method: 'bscale_gateway',
        payment_method_title: 'BScale Demo Gateway',
        date_created: dateMinISO,
        date_modified: dateMinISO,
        date_completed: dateMaxISO,
        customer_note: 'נא ליצור קשר לפני משלוח.',
        billing: {
          first_name: 'דנה',
          last_name: 'כהן',
          email: 'dana@example.com',
          phone: '+972501234567',
          company: 'Demo Ltd',
          address_1: 'רחוב הדגמה 1',
          address_2: '',
          city: 'תל אביב',
          state: '',
          postcode: '61000',
          country: 'IL'
        },
        shipping: {
          first_name: 'דנה',
          last_name: 'כהן',
          company: 'Demo Ltd',
          address_1: 'רחוב הדגמה 1',
          address_2: '',
          city: 'תל אביב',
          state: '',
          postcode: '61000',
          country: 'IL'
        },
        line_items: [
          {
            id: 1,
            name: 'נעלי ריצה מקצועיות - דגם 2024',
            product_id: 1,
            variation_id: 0,
            quantity: 1,
            total: '1349',
            total_tax: '0',
            sku: 'RUN-2024-BL'
          }
        ],
        meta_data: [
          { key: 'internal_note', value: 'הדגמה בלבד - לא נשלח ללקוח' }
        ]
      }
    ];
  }

  const sanitizeErrorText = (value: string): string =>
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const parseRows = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const asObj = payload as Record<string, unknown>;
      if (Array.isArray(asObj.orders)) return asObj.orders as any[];
      if (Array.isArray(asObj.data)) return asObj.data as any[];
    }
    return [];
  };

  const fetchPage = async (page: number, perPage: number): Promise<any[]> => {
    const endpoint =
      `orders?per_page=${perPage}&page=${page}&orderby=date&order=desc` +
      `&after=${encodeURIComponent(dateMinISO)}&before=${encodeURIComponent(dateMaxISO)}`;

    const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        key,
        secret,
        endpoint,
      }),
    });

    const text = await response.text();
    if (!text) {
      if (!response.ok) {
        throw new Error(`WooCommerce API returned empty response (${response.status})`);
      }
      return [];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('WooCommerce returned invalid JSON for orders request');
    }

    if (!response.ok) {
      const rawMessage =
        (parsed && typeof parsed.message === 'string' && parsed.message) ||
        `WooCommerce API error (${response.status})`;
      throw new Error(sanitizeErrorText(rawMessage));
    }

    return parseRows(parsed);
  };

  try {
    const perPage = 100;
    const maxPages = 10;
    const rawOrders: any[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const pageRows = await fetchPage(page, perPage);
      rawOrders.push(...pageRows);
      if (pageRows.length < perPage) break;
    }

    return rawOrders.map((row) => ({
      id: Number(row.id || 0),
      number: String(row.number ?? row.id ?? ''),
      status: typeof row.status === 'string' ? row.status : 'pending',
      currency: typeof row.currency === 'string' ? row.currency : 'ILS',
      total: toNumber(row.total),
      total_tax: toNumber(row.total_tax),
      shipping_total: toNumber(row.shipping_total),
      payment_method: typeof row.payment_method === 'string' ? row.payment_method : '',
      payment_method_title: typeof row.payment_method_title === 'string' ? row.payment_method_title : '',
      date_created: typeof row.date_created === 'string' ? row.date_created : '',
      date_modified: typeof row.date_modified === 'string' ? row.date_modified : '',
      date_completed: typeof row.date_completed === 'string' ? row.date_completed : null,
      customer_note: typeof row.customer_note === 'string' ? row.customer_note : '',
      billing: row.billing || {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      },
      shipping: row.shipping || {
        first_name: '',
        last_name: '',
      },
      line_items: Array.isArray(row.line_items) ? row.line_items : [],
      meta_data: Array.isArray(row.meta_data) ? row.meta_data : [],
    }));
  } catch (error) {
    console.error('WooCommerce orders fetch error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch WooCommerce orders');
  }
}

export async function fetchWooCommerceLatestOrders(
  url: string,
  key: string,
  secret: string,
  limit = 5
): Promise<WooCommerceOrder[]> {
  if (!url || !key || !secret) {
    return [];
  }

  if (key === 'mock' || secret === 'mock') {
    const now = new Date().toISOString();
    return [
      {
        id: 201,
        number: '201',
        status: 'completed',
        currency: 'ILS',
        total: 980,
        total_tax: 0,
        shipping_total: 0,
        payment_method: 'bscale_gateway',
        payment_method_title: 'BScale Demo Gateway',
        date_created: now,
        date_modified: now,
        date_completed: now,
        customer_note: '',
        billing: {
          first_name: 'דנה',
          last_name: 'כהן',
          email: 'dana@example.com',
          phone: '+972501234567',
        },
        shipping: {
          first_name: 'דנה',
          last_name: 'כהן',
        },
        line_items: [],
        meta_data: [],
      },
    ];
  }

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const parseRows = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const asObj = payload as Record<string, unknown>;
      if (Array.isArray(asObj.orders)) return asObj.orders as any[];
      if (Array.isArray(asObj.data)) return asObj.data as any[];
    }
    return [];
  };

  const endpoint = `orders?per_page=${Math.min(Math.max(limit, 1), 50)}&page=1&orderby=date&order=desc`;
  const response = await fetch(`${API_BASE}/api/proxy/woocommerce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      key,
      secret,
      endpoint,
    }),
  });

  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new Error(`WooCommerce API returned empty response (${response.status})`);
    }
    return [];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('WooCommerce returned invalid JSON for latest orders request');
  }

  if (!response.ok) {
    const rawMessage =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      `WooCommerce API error (${response.status})`;
    throw new Error(sanitizeWooErrorText(rawMessage));
  }

  return parseRows(parsed).map((row) => ({
    id: Number(row.id || 0),
    number: String(row.number ?? row.id ?? ''),
    status: typeof row.status === 'string' ? row.status : 'pending',
    currency: typeof row.currency === 'string' ? row.currency : 'ILS',
    total: toNumber(row.total),
    total_tax: toNumber(row.total_tax),
    shipping_total: toNumber(row.shipping_total),
    payment_method: typeof row.payment_method === 'string' ? row.payment_method : '',
    payment_method_title: typeof row.payment_method_title === 'string' ? row.payment_method_title : '',
    date_created: typeof row.date_created === 'string' ? row.date_created : '',
    date_modified: typeof row.date_modified === 'string' ? row.date_modified : '',
    date_completed: typeof row.date_completed === 'string' ? row.date_completed : null,
    customer_note: typeof row.customer_note === 'string' ? row.customer_note : '',
    billing: row.billing || {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
    },
    shipping: row.shipping || {
      first_name: '',
      last_name: '',
    },
    line_items: Array.isArray(row.line_items) ? row.line_items : [],
    meta_data: Array.isArray(row.meta_data) ? row.meta_data : [],
  }));
}


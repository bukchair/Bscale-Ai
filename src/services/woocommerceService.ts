const API_BASE =
  (typeof import.meta !== 'undefined' &&
    typeof import.meta.env.VITE_APP_URL === 'string' &&
    import.meta.env.VITE_APP_URL) ||
  '';

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

export async function fetchWooCommerceProducts(url: string, key: string, secret: string) {
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
        console.warn("Failed to parse products response, falling back to mock data");
        return mockProducts;
      }
    } else {
      console.warn("Empty products response, falling back to mock data");
      return mockProducts;
    }

    if (!response.ok) {
      console.warn(`WooCommerce API Error: ${response.statusText}. Falling back to mock data.`);
      return mockProducts;
    }
    
    return data;
  } catch (error) {
    console.error("WooCommerce Fetch Error, falling back to mock data:", error);
    return mockProducts;
  }
}

export async function updateWooCommerceProduct(url: string, key: string, secret: string, productId: number, data: any) {
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

    let data: any;
    try {
      data = JSON.parse(text);
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

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn('Failed to parse WooCommerce sales range response, returning empty list');
      return [];
    }

    const rows: any[] = Array.isArray(data) ? data : [data];

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

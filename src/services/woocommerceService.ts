export async function fetchWooCommerceProducts(url: string, key: string, secret: string) {
  // WooCommerce REST API uses Basic Auth or OAuth
  // For simplicity in a client-side demo, we'll use the URL format for Basic Auth
  // Note: This is NOT secure for production, but for a demo it shows "real" connection
  
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const apiUrl = `${baseUrl}/wp-json/wc/v3/products`;
  
  const auth = btoa(`${key}:${secret}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`WooCommerce API Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("WooCommerce Fetch Error:", error);
    throw error;
  }
}

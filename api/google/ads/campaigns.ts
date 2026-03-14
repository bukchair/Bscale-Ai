/**
 * Vercel Serverless: GET /api/google/ads/campaigns
 * Fetches Google Ads campaigns. Query: customer_id, login_customer_id (optional).
 * Header: Authorization: Bearer <token>
 * Env: GOOGLE_ADS_DEVELOPER_TOKEN
 */

export default async function handler(
  req: {
    method?: string;
    query?: { customer_id?: string; login_customer_id?: string };
    headers?: { authorization?: string };
  },
  res: { status: (n: number) => { json: (o: object) => void }; json: (o: object) => void }
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = req.headers?.authorization;
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const customerId = req.query?.customer_id;
  const loginCustomerId = req.query?.login_customer_id;

  if (!accessToken || !customerId) {
    return res.status(400).json({ message: 'Missing access token or customer ID' });
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    return res.status(500).json({ message: 'Google Ads developer token not configured' });
  }

  const formattedCustomerId = String(customerId).replace(/-/g, '');
  const loginId = loginCustomerId ? String(loginCustomerId).replace(/-/g, '') : formattedCustomerId;

  try {
    const response = await fetch(
      `https://googleads.googleapis.com/v17/customers/${formattedCustomerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'login-customer-id': loginId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            SELECT 
              campaign.id, 
              campaign.name, 
              campaign.status, 
              metrics.cost_micros, 
              metrics.conversions, 
              metrics.conversions_value,
              metrics.absolute_top_impression_percentage
            FROM campaign 
            WHERE campaign.status != 'REMOVED'
          `,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data.error?.message || 'Google Ads API error' });
    }
    return res.status(200).json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch Google Ads campaigns';
    return res.status(500).json({ message });
  }
}

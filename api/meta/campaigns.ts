/**
 * Vercel Serverless: GET /api/meta/campaigns
 * Fetches Meta ad campaigns. Query: ad_account_id. Header: Authorization: Bearer <token>
 * Env: none required (token from client).
 */

export default async function handler(
  req: { method?: string; query?: { ad_account_id?: string }; headers?: { authorization?: string } },
  res: { status: (n: number) => { json: (o: object) => void }; json: (o: object) => void }
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = req.headers?.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const adAccountId = req.query?.ad_account_id;

  if (!token || !adAccountId) {
    return res.status(400).json({ message: 'Missing access token or ad account ID' });
  }

  const adAccountIdStr = String(adAccountId);
  const formattedAdAccountId = adAccountIdStr.startsWith('act_') ? adAccountIdStr : `act_${adAccountIdStr}`;

  try {
    const url = `https://graph.facebook.com/v19.0/${formattedAdAccountId}/campaigns?fields=id,name,status,objective,start_time,stop_time,insights{spend,inline_link_click_ctr,purchase_roas,roas,actions,action_values}&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ message: data.error?.message || 'Meta API error' });
    }
    return res.status(200).json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch Meta campaigns';
    return res.status(500).json({ message });
  }
}

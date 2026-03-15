import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';

type Req = IncomingMessage;

type MetaAssetOption = { id: string; name: string };
type MetaAssetsData = {
  adAccounts: MetaAssetOption[];
  businesses: MetaAssetOption[];
  messageAccounts: MetaAssetOption[];
  pixels: Array<MetaAssetOption & { adAccountId?: string }>;
  defaultAdAccountId?: string;
  defaultBusinessId?: string;
  defaultMessageAccountId?: string;
  defaultPixelId?: string;
};

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
};

const toMetaErrorMessage = (error: unknown, fallback = 'Meta request failed') => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as any;
    return payload?.error?.message || payload?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export default async function handler(req: Req, res: ServerResponse) {
  if ((req.method || 'GET') !== 'GET') {
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  const accessToken = req.headers.authorization?.split(' ')[1] || '';
  if (!accessToken) {
    return sendJson(res, 400, { success: false, message: 'Missing Meta access token' });
  }

  const apiVersion = 'v21.0';
  const base = `https://graph.facebook.com/${apiVersion}`;
  const requestCommon = {
    params: { access_token: accessToken, limit: 200 },
  };

  try {
    const [pagesResponse, businessesResponse, adAccountsResponse] = await Promise.all([
      axios.get(`${base}/me/accounts`, {
        ...requestCommon,
        params: { ...requestCommon.params, fields: 'id,name' },
      }),
      axios.get(`${base}/me/businesses`, {
        ...requestCommon,
        params: { ...requestCommon.params, fields: 'id,name' },
      }),
      axios.get(`${base}/me/adaccounts`, {
        ...requestCommon,
        params: { ...requestCommon.params, fields: 'account_id,name' },
      }),
    ]);

    const adAccounts: MetaAssetOption[] = (adAccountsResponse.data?.data || [])
      .filter((item: any) => item?.account_id)
      .map((item: any) => ({
        id: String(item.account_id),
        name: String(item.name || item.account_id),
      }));

    const businesses: MetaAssetOption[] = (businessesResponse.data?.data || [])
      .filter((item: any) => item?.id)
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name || item.id),
      }));

    const pages: MetaAssetOption[] = (pagesResponse.data?.data || [])
      .filter((item: any) => item?.id)
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name || item.id),
      }));

    const pixels: Array<MetaAssetOption & { adAccountId?: string }> = [];
    const pixelRequests = adAccounts.slice(0, 50).map(async (account) => {
      try {
        const response = await axios.get(`${base}/act_${account.id}/adspixels`, {
          ...requestCommon,
          params: { ...requestCommon.params, fields: 'id,name' },
        });
        (response.data?.data || []).forEach((pixel: any) => {
          if (!pixel?.id) return;
          pixels.push({
            id: String(pixel.id),
            name: String(pixel.name || pixel.id),
            adAccountId: account.id,
          });
        });
      } catch {
        // Continue when one ad account has restricted pixel permissions.
      }
    });

    await Promise.all(pixelRequests);

    const payload: MetaAssetsData = {
      adAccounts,
      businesses,
      messageAccounts: pages,
      pixels,
      defaultAdAccountId: adAccounts[0]?.id || '',
      defaultBusinessId: businesses[0]?.id || '',
      defaultMessageAccountId: pages[0]?.id || '',
      defaultPixelId: pixels[0]?.id || '',
    };

    return sendJson(res, 200, { success: true, data: payload });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      message: toMetaErrorMessage(error, 'Failed to load Meta assets'),
    });
  }
}

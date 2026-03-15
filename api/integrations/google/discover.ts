import type { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import {
  getValidServiceAccessToken,
  resolveUserIdFromRequest,
} from '../_lib/google-store';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message =
      (error.response?.data as any)?.error?.message ||
      (error.response?.data as any)?.message ||
      error.message;
    return message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export default async function handler(
  req: IncomingMessage & { query?: any; headers?: any; body?: any },
  res: ServerResponse
) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Method not allowed' }));
    return;
  }

  const userId = resolveUserIdFromRequest(req);
  if (!userId) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Missing user_id' }));
    return;
  }

  const discovered: Record<string, string> = {};
  const warnings: string[] = [];

  try {
    const ga4Token = await getValidServiceAccessToken({ userId, service: 'ga4' });
    const ga4Response = await axios.get('https://analyticsadmin.googleapis.com/v1alpha/accountSummaries', {
      params: { pageSize: 200 },
      headers: { Authorization: `Bearer ${ga4Token}` },
    });
    const firstProperty = (ga4Response.data.accountSummaries || [])
      .flatMap((summary: any) => summary.propertySummaries || [])
      .find((property: any) => property?.property);

    if (firstProperty?.property) {
      discovered.ga4PropertyId = String(firstProperty.property).replace('properties/', '');
      if (firstProperty.displayName) {
        discovered.ga4PropertyName = firstProperty.displayName;
      }
    }
  } catch (error) {
    warnings.push(`GA4 discovery failed: ${getErrorMessage(error, 'Unknown GA4 error')}`);
  }

  try {
    const gscToken = await getValidServiceAccessToken({ userId, service: 'search_console' });
    const gscResponse = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${gscToken}` },
    });
    const site = (gscResponse.data.siteEntry || []).find(
      (entry: any) => entry.permissionLevel && entry.permissionLevel !== 'siteUnverified'
    );
    if (site?.siteUrl) discovered.gscSiteUrl = site.siteUrl;
  } catch (error) {
    warnings.push(`Search Console discovery failed: ${getErrorMessage(error, 'Unknown Search Console error')}`);
  }

  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    try {
      const adsToken = await getValidServiceAccessToken({ userId, service: 'google_ads' });
      const adsResponse = await axios.get(
        'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
        {
          headers: {
            Authorization: `Bearer ${adsToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          },
        }
      );
      const firstCustomer = adsResponse.data.resourceNames?.[0];
      if (firstCustomer) {
        discovered.googleAdsId = String(firstCustomer).replace('customers/', '');
      }
    } catch (error) {
      warnings.push(`Google Ads discovery failed: ${getErrorMessage(error, 'Unknown Google Ads error')}`);
    }
  } else {
    warnings.push('Google Ads discovery skipped: GOOGLE_ADS_DEVELOPER_TOKEN is not configured.');
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ discovered, warnings }));
}

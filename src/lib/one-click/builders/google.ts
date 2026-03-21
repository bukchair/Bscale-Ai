import { integrationsEnv } from '@/src/lib/env/integrations-env';
import { googleLegacyBridge } from '@/src/lib/integrations/services/google-legacy-bridge';
import { GOOGLE_ADS_API_BASE } from '@/src/lib/constants/api-urls';
import { sanitize, extractError } from '../shared';
import type {
  OneClickInput,
  OneClickObjective,
  OneClickStrategy,
  PlatformResult,
} from '../types';

// Country code → Google Geo Target Constant ID
const GOOGLE_GEO: Record<string, number> = {
  IL: 2376, US: 2840, GB: 2826, DE: 2276, FR: 2250,
  CA: 2124, AU: 2036, NL: 2528, ES: 2510, IT: 2380,
};

// ─── RSA helpers ──────────────────────────────────────────────────────────────

const hl = (text: string) => ({ text: text.trim().slice(0, 30) });
const desc = (text: string) => ({ text: text.trim().slice(0, 90) });
const normalizeCustomerId = (value: string) => value.replace(/\D/g, '');
const normalizeFinalUrl = (value: string | undefined): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
};

const buildRsaHeadlines = (
  strategy: OneClickStrategy,
  productName: string,
  price?: string
): Array<{ text: string }> => {
  const objective = strategy.objective;
  const aiTitle = strategy.platformCopy?.Google?.title?.trim() || '';
  const objectivePhrases: Record<string, string[]> = {
    sales:   ['Shop Now & Save', 'Order Today', 'Best Deals Online'],
    leads:   ['Get a Free Quote', 'Contact Us Today', 'Request Info Now'],
    traffic: ['Visit Our Website', 'Discover More Today', 'Learn More Here'],
  };

  const candidates = [
    aiTitle,
    productName,
    strategy.campaignName,
    price ? `From ${price}` : '',
    ...(objectivePhrases[objective] || []),
  ]
    .map((t) => t.trim().slice(0, 30))
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); unique.push(c); }
  }
  return unique.slice(0, 15).map(hl);
};

const buildRsaDescriptions = (
  strategy: OneClickStrategy,
  productDescription?: string
): Array<{ text: string }> => {
  const aiDesc = strategy.platformCopy?.Google?.description?.trim() || '';
  const candidates = [
    aiDesc,
    productDescription?.trim() || '',
    `${strategy.campaignName} — click to learn more`.slice(0, 90),
  ].map((t) => t.slice(0, 90)).filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) { seen.add(c); unique.push(c); }
  }
  return unique.slice(0, 4).map(desc);
};

const buildKeywords = (productName: string, audiences: string[]): string[] => {
  const kws: string[] = [];
  if (productName) kws.push(productName.slice(0, 80));
  for (const w of productName.split(/\s+/).filter((w) => w.length > 2).slice(0, 3)) {
    kws.push(w);
  }
  for (const a of audiences.slice(0, 3)) kws.push(a.slice(0, 80));
  return [...new Set(kws)].slice(0, 10);
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export const createGoogleDraft = async (
  userId: string,
  name: string,
  objective: OneClickObjective,
  dailyBudget: number,
  strategy: OneClickStrategy,
  activateImmediately = false,
  country = 'US',
  product?: OneClickInput['product']
): Promise<PlatformResult> => {
  try {
    if (!integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN) {
      return { ok: false, message: 'GOOGLE_ADS_DEVELOPER_TOKEN is not configured.', campaignStatus: 'Error' };
    }

    const { connection, accessToken } = await googleLegacyBridge.getConnectionWithAccessToken(
      userId, 'GOOGLE_ADS'
    );
    const customerIdRaw = googleLegacyBridge.pickSelectedAccountId(connection);
    const customerId = normalizeCustomerId(customerIdRaw);
    if (!customerId) {
      return { ok: false, message: 'No selected Google Ads account found.', campaignStatus: 'Error' };
    }

    const loginCustomerId = googleLegacyBridge.getLoginCustomerId(connection.metadata) || undefined;
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'developer-token': integrationsEnv.GOOGLE_ADS_DEVELOPER_TOKEN,
      'content-type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

    // 1. Create shared campaign budget
    const budgetRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              name: `${sanitize(name)} Budget ${Date.now()}`,
              amountMicros: Math.round(Math.max(dailyBudget, 1) * 1_000_000),
              deliveryMethod: 'STANDARD',
              explicitlyShared: false,
            },
          }],
        }),
      }
    );
    if (!budgetRes.ok) {
      return { ok: false, message: await extractError(budgetRes), campaignStatus: 'Error' };
    }
    const budgetPayload = (await budgetRes.json()) as Record<string, unknown>;
    const budgetResourceName = String(
      (budgetPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    if (!budgetResourceName) {
      return { ok: false, message: 'Google budget created without resource name.', campaignStatus: 'Error' };
    }

    // 2. Create campaign — always SEARCH (no pixel/display complexity)
    const campaignRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              name: sanitize(name),
              status: activateImmediately ? 'ENABLED' : 'PAUSED',
              advertisingChannelType: 'SEARCH',
              campaignBudget: budgetResourceName,
              maximizeClicks: {},
              networkSettings: {
                targetGoogleSearch: true,
                targetSearchNetwork: false,
                targetContentNetwork: false,
              },
              startDate: new Date().toISOString().slice(0, 10),
            },
          }],
        }),
      }
    );
    if (!campaignRes.ok) {
      return { ok: false, message: await extractError(campaignRes), campaignStatus: 'Error' };
    }
    const campaignPayload = (await campaignRes.json()) as Record<string, unknown>;
    const resourceName = String(
      (campaignPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    const campaignId = resourceName.split('/').pop() || resourceName;

    // 3. Add geo-targeting (non-fatal)
    const geoCriteriaId = GOOGLE_GEO[country.toUpperCase()];
    if (geoCriteriaId && resourceName) {
      await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignCriteria:mutate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              campaign: resourceName,
              location: { geoTargetConstant: `geoTargetConstants/${geoCriteriaId}` },
            },
          }],
        }),
      }).catch((err) => {
        // Non-fatal: geo-targeting is best-effort; campaign continues without it.
        console.warn('[one-click/google] geo-targeting failed (non-fatal):', err);
      });
    }

    // 4. Create Ad Group
    const adGroupStatus = activateImmediately ? 'ENABLED' : 'PAUSED';
    const adGroupRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroups:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              name: `${sanitize(name)} – Ad Group`,
              campaign: resourceName,
              status: adGroupStatus,
              type: 'SEARCH_STANDARD',
            },
          }],
        }),
      }
    );

    if (!adGroupRes.ok) {
      const adGroupErr = await extractError(adGroupRes);
      console.error('[one-click] Google ad group failed:', adGroupErr);
      return {
        ok: true,
        campaignId,
        message: `Google Ads campaign created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). Ad group failed: ${adGroupErr}`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    const adGroupPayload = (await adGroupRes.json()) as Record<string, unknown>;
    const adGroupResourceName = String(
      (adGroupPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || ''
    );
    const adGroupId = adGroupResourceName.split('/').pop() || '';

    // 5. Create Keywords (non-fatal)
    const keywords = buildKeywords(product?.name || name, strategy.audiences);
    if (keywords.length > 0 && adGroupResourceName) {
      await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroupCriteria:mutate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: keywords.map((kw) => ({
            create: {
              adGroup: adGroupResourceName,
              status: 'ENABLED',
              keyword: { text: kw, matchType: 'BROAD' },
            },
          })),
        }),
      }).catch((e) => console.error('[one-click] Google keywords failed:', e));
    }

    // 6. Create Responsive Search Ad (requires finalUrl)
    const finalUrl = normalizeFinalUrl(product?.url);
    if (!finalUrl) {
      return {
        ok: true,
        campaignId,
        adId: adGroupId,
        message: `Google Ads campaign + ad group created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). No URL provided — RSA skipped.`,
        campaignStatus: activateImmediately ? 'Active' : 'Draft',
      };
    }

    const headlines = buildRsaHeadlines(strategy, product?.name || name, product?.price);
    const descriptions = buildRsaDescriptions(strategy, product?.description);

    if (headlines.length < 3) {
      headlines.push(hl('Learn More'), hl('Get Started Today'), hl('Contact Us Now'));
    }
    if (descriptions.length < 2) {
      descriptions.push(desc('Click to learn more about our products and services.'));
    }

    const rsaRes = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operations: [{
            create: {
              adGroup: adGroupResourceName,
              status: adGroupStatus,
              ad: {
                responsiveSearchAd: {
                  headlines: headlines.slice(0, 15),
                  descriptions: descriptions.slice(0, 4),
                },
                finalUrls: [finalUrl],
              },
            },
          }],
        }),
      }
    );

    const rsaPayload = (await rsaRes.json()) as Record<string, unknown>;
    const adId = rsaRes.ok
      ? String((rsaPayload?.results as Array<Record<string, unknown>>)?.[0]?.resourceName || '').split('/').pop()
      : undefined;

    if (!rsaRes.ok) {
      console.error('[one-click] Google RSA failed:', await extractError(rsaRes).catch(() => rsaPayload));
    }

    return {
      ok: true,
      campaignId,
      adId,
      message: `Google Ads campaign + ad group${adId ? ' + RSA' : ''} created (${activateImmediately ? 'ENABLED' : 'PAUSED'}). Budget: ${dailyBudget}/day.`,
      campaignStatus: activateImmediately ? 'Active' : 'Draft',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Google campaign creation failed.',
      campaignStatus: 'Error',
    };
  }
};

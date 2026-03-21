import { useEffect, useState } from 'react';
import {
  getOptimizationRecommendations,
  getAIKeysFromConnections,
  hasAnyAIKey,
} from '../../lib/gemini';
import { fetchTikTokCampaigns } from '../../services/tiktokService';
import { fetchMetaCampaigns, fetchMetaAdsets, isMetaRateLimitMessage, type MetaAdset } from '../../services/metaService';
import { fetchGoogleCampaigns, sendGmailNotification } from '../../services/googleService';
import {
  mapGoogleCampaignRowsToUnifiedLayer,
  mapMetaCampaignRowsToUnifiedLayer,
  mapTikTokCampaignRowsToUnifiedLayer,
  replaceUnifiedPlatformSlice,
  unifiedLayerToCampaignRows,
} from '../../lib/unified-data/mappers';
import { createEmptyUnifiedDataLayer } from '../../lib/unified-data/types';
import { auth } from '../../lib/firebase';
import type { Connection } from '../../contexts/ConnectionsContext';
import type { CampaignRow, PlatformName } from './types';

const CAMPAIGNS_CACHE_KEY = 'bscale:campaigns:realCampaigns:v1';

const mockCampaignData = [
  { id: 1, name: 'Summer Sale - Shoes', platform: 'Google', status: 'Active', spend: 1200, roas: 2.5, cpa: 45 },
  { id: 2, name: 'Retargeting - Abandoned Cart', platform: 'Meta', status: 'Active', spend: 800, roas: 4.2, cpa: 22 },
  { id: 3, name: 'New Collection - Video', platform: 'TikTok', status: 'Paused', spend: 400, roas: 1.1, cpa: 85 },
  { id: 4, name: 'Brand Search', platform: 'Google', status: 'Active', spend: 300, roas: 8.5, cpa: 12 },
];

export interface UseCampaignDataProps {
  connections: Connection[];
  startDateIso: string;
  endDateIso: string;
  language: string;
  isHebrew: boolean;
}

export function useCampaignData({
  connections,
  startDateIso,
  endDateIso,
  language,
  isHebrew,
}: UseCampaignDataProps) {
  const [realCampaigns, setRealCampaigns] = useState<CampaignRow[]>([]);
  const [createdCampaigns, setCreatedCampaigns] = useState<CampaignRow[]>([]);
  const [unifiedDataLayer, setUnifiedDataLayer] = useState(createEmptyUnifiedDataLayer);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [adsetsByCampaignId, setAdsetsByCampaignId] = useState<Record<string, MetaAdset[]>>({});
  const [loadingAdsetsCampaignId, setLoadingAdsetsCampaignId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [metaSyncNotice, setMetaSyncNotice] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<number[]>([]);
  const [expandedRecs, setExpandedRecs] = useState<number[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Load from cache on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAMPAIGNS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { items?: CampaignRow[] };
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setRealCampaigns(parsed.items);
      }
    } catch {
      // ignore cache parse errors
    }
  }, []);

  // Persist to cache when campaigns change
  useEffect(() => {
    try {
      if (realCampaigns.length > 0) {
        window.localStorage.setItem(
          CAMPAIGNS_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), items: realCampaigns })
        );
      }
    } catch {
      // ignore storage quota errors
    }
  }, [realCampaigns]);

  const applyUnifiedPlatformLayer = (
    platform: PlatformName,
    incomingLayer: ReturnType<typeof createEmptyUnifiedDataLayer>
  ) => {
    setUnifiedDataLayer((prev) => {
      const next = replaceUnifiedPlatformSlice(prev, platform, incomingLayer);
      const rows = unifiedLayerToCampaignRows(next);
      if (rows.length > 0) setRealCampaigns(rows);
      return next;
    });
  };

  const toggleCampaignExpand = async (campaign: CampaignRow) => {
    const campaignId = String(campaign?.campaignId || campaign?.id || '');
    if (!campaignId) return;

    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });

    if (String(campaign?.platform || '') === 'Meta' && !adsetsByCampaignId[campaignId]) {
      const metaConn = connections.find((c) => c.id === 'meta');
      const token = metaConn?.settings?.metaToken || 'server-managed';
      const adAccountId = metaConn?.settings?.metaAdsId || metaConn?.settings?.adAccountId || '';
      setLoadingAdsetsCampaignId(campaignId);
      try {
        const adsets = await fetchMetaAdsets(token, adAccountId || undefined, [campaignId], startDateIso, endDateIso);
        setAdsetsByCampaignId((prev) => ({ ...prev, [campaignId]: adsets }));
      } catch (err) {
        console.warn('Failed to fetch adsets for campaign', campaignId, err);
        setAdsetsByCampaignId((prev) => ({ ...prev, [campaignId]: [] }));
      } finally {
        setLoadingAdsetsCampaignId(null);
      }
    }
  };

  const syncTikTokData = async () => {
    const tiktokConn = connections.find((c) => c.id === 'tiktok');
    const token = tiktokConn?.settings?.tiktokToken || tiktokConn?.settings?.tiktokAccessToken;
    const advertiserId = tiktokConn?.settings?.tiktokAdvertiserId || tiktokConn?.settings?.advertiserId;
    if (tiktokConn?.status === 'connected' && token && advertiserId) {
      try {
        const campaigns = await fetchTikTokCampaigns(token, advertiserId, startDateIso, endDateIso);
        const unifiedLayer = mapTikTokCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(advertiserId),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        applyUnifiedPlatformLayer('TikTok', unifiedLayer);
      } catch (err) {
        console.error('Failed to sync TikTok data:', err);
      }
    }
  };

  const syncMetaData = async () => {
    const metaConn = connections.find((c) => c.id === 'meta');
    const token = metaConn?.status === 'connected' ? metaConn?.settings?.metaToken || 'server-managed' : '';
    const adAccountId =
      metaConn?.settings?.metaAdsId ||
      metaConn?.settings?.adAccountId ||
      metaConn?.settings?.metaAdAccountId;
    if (metaConn?.status === 'connected' && token) {
      try {
        const campaigns = await fetchMetaCampaigns(token, adAccountId || undefined, startDateIso, endDateIso);
        const unifiedLayer = mapMetaCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(adAccountId || ''),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        const mappedRows = unifiedLayerToCampaignRows(unifiedLayer);
        const hasAnyMetaRow = mappedRows.some((row) => String(row?.platform || '') === 'Meta');
        if (hasAnyMetaRow || campaigns.length === 0) {
          applyUnifiedPlatformLayer('Meta', unifiedLayer);
        }
        setMetaSyncNotice(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMetaRateLimitMessage(message)) {
          setMetaSyncNotice(
            isHebrew
              ? 'מטא מגביל כרגע קריאות API. מוצגים נתונים אחרונים זמינים.'
              : 'Meta is currently rate-limiting API calls. Showing the latest available data.'
          );
        } else {
          console.error('Failed to sync Meta data:', err);
        }
      }
    }
  };

  const syncGoogleData = async () => {
    const googleConn = connections.find((c) => c.id === 'google');
    const token = googleConn?.status === 'connected' ? googleConn?.settings?.googleAccessToken || 'server-managed' : '';
    const customerId =
      googleConn?.settings?.googleAdsId ||
      googleConn?.settings?.customerId ||
      googleConn?.settings?.googleCustomerId;
    const loginCustomerId = googleConn?.settings?.loginCustomerId;
    if (googleConn?.status === 'connected' && token) {
      try {
        const campaigns = await fetchGoogleCampaigns(token, customerId || undefined, loginCustomerId, startDateIso, endDateIso);
        const unifiedLayer = mapGoogleCampaignRowsToUnifiedLayer(campaigns, {
          accountExternalId: String(customerId || ''),
          dateRange: { startDate: startDateIso, endDate: endDateIso },
        });
        applyUnifiedPlatformLayer('Google', unifiedLayer);
      } catch (err) {
        console.error('Failed to sync Google data:', err);
      }
    }
  };

  // Auto-sync on mount, interval, and window focus
  useEffect(() => {
    let cancelled = false;
    let lastSyncAt = 0;
    const syncAll = async () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastSyncAt < 60_000) return;
      lastSyncAt = now;
      setIsSyncing(true);
      try {
        await Promise.all([syncTikTokData(), syncMetaData(), syncGoogleData()]);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    void syncAll();
    const intervalId = window.setInterval(() => void syncAll(), 120_000);
    const handleFocus = () => void syncAll();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [connections, startDateIso, endDateIso]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const aiKeys = getAIKeysFromConnections(connections);
      if (!hasAnyAIKey(aiKeys)) {
        setRecommendations([]);
        setExpandedRecs([]);
      } else {
        const dataToAnalyze = realCampaigns.length > 0 ? realCampaigns : mockCampaignData;
        const dataStr = JSON.stringify(dataToAnalyze);
        const recommendationLanguage =
          language === 'he' ? 'Hebrew'
          : language === 'ru' ? 'Russian'
          : language === 'pt' ? 'Portuguese'
          : language === 'fr' ? 'French'
          : 'English';
        const res = await getOptimizationRecommendations(dataStr, aiKeys, recommendationLanguage);
        const normalized = Array.isArray(res?.recommendations)
          ? res.recommendations.filter(Boolean)
          : [];
        setRecommendations(normalized);
        setExpandedRecs([]);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (index: number) => {
    setAppliedRecs((prev) => [...prev, index]);
  };

  const toggleRecExpanded = (index: number) => {
    setExpandedRecs((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const handleSendEmail = async () => {
    const googleConn = connections.find((c) => c.id === 'google');
    if (!googleConn?.settings?.googleAccessToken) {
      alert('Please connect Google Workspace first to send emails.');
      return;
    }
    setSendingEmail(true);
    try {
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;">
          <h2 style="color: #4f46e5;">BScale AI: Optimization Recommendations</h2>
          <p>Here are the latest AI-generated recommendations for your advertising campaigns:</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          ${recommendations
            .map(
              (rec) => `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; background-color: ${rec.impact === 'High' ? '#fee2e2' : rec.impact === 'Medium' ? '#fef3c7' : '#dcfce7'}; color: ${rec.impact === 'High' ? '#991b1b' : rec.impact === 'Medium' ? '#92400e' : '#166534'}; margin-right: 8px;">
                  IMPACT: ${rec.impact}
                </span>
                <span style="font-size: 12px; color: #6b7280;">${rec.platform}</span>
              </div>
              <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">${rec.title}</h3>
              <p style="margin: 0; font-size: 14px; color: #4b5563;">${rec.description}</p>
            </div>
          `
            )
            .join('')}
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">Sent from BScale AI Dashboard.</p>
        </div>
      `;
      await sendGmailNotification(
        googleConn.settings.googleAccessToken,
        auth.currentUser?.email || '',
        'BScale AI: Your Campaign Recommendations',
        emailBody
      );
      alert('Recommendations sent to your email!');
    } catch (err) {
      console.error('Failed to send email:', err);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  return {
    // campaign lists
    realCampaigns,
    setRealCampaigns,
    createdCampaigns,
    setCreatedCampaigns,
    // sync
    isSyncing,
    metaSyncNotice,
    // expanded / adsets
    expandedCampaigns,
    adsetsByCampaignId,
    loadingAdsetsCampaignId,
    toggleCampaignExpand,
    // recommendations
    recommendations,
    loading,
    appliedRecs,
    expandedRecs,
    fetchRecommendations,
    handleApply,
    toggleRecExpanded,
    // email
    sendingEmail,
    handleSendEmail,
  };
}

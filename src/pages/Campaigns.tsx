import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOptimizationRecommendations } from '../lib/gemini';
import { CheckCircle2, AlertCircle, Loader2, Zap, Video, Mail } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { fetchTikTokCampaigns } from '../services/tiktokService';
import { fetchMetaCampaigns } from '../services/metaService';
import { fetchGoogleCampaigns, sendGmailNotification } from '../services/googleService';
import { auth } from '../lib/firebase';

type LiveCampaign = {
  id: string | number;
  name: string;
  platform: 'Google' | 'Meta' | 'TikTok';
  status: string;
  spend: string;
  roas: string;
  cpa: string;
};

export function Campaigns() {
  const { t, dir } = useLanguage();
  const isHebrew = dir === 'rtl';
  const { connections } = useConnections();
  const { resolvedRange } = useDateRange();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<number[]>([]);
  const [realCampaigns, setRealCampaigns] = useState<LiveCampaign[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<{ google: string | null; meta: string | null; tiktok: string | null }>({
    google: null,
    meta: null,
    tiktok: null,
  });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const syncInFlightRef = useRef(false);

  // Filtering and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const normalizeCampaign = (campaign: any, platform: LiveCampaign['platform']): LiveCampaign => {
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.-]/g, '');
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const spend = toNumber(campaign?.spend);
    const roas = toNumber(campaign?.roas);
    const cpa = toNumber(campaign?.cpa);

    return {
      id: campaign?.id ?? `${platform}-${String(campaign?.name || 'campaign')}`,
      name: String(campaign?.name || `${platform} Campaign`),
      platform,
      status: String(campaign?.status || 'Paused'),
      spend: `₪${spend.toFixed(0)}`,
      roas: roas.toFixed(1),
      cpa: `₪${cpa.toFixed(0)}`,
    };
  };

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      if (realCampaigns.length === 0) {
        setRecommendations([]);
        return;
      }
      const dataToAnalyze = realCampaigns;
      const dataStr = JSON.stringify(dataToAnalyze);
      const res = await getOptimizationRecommendations(dataStr);
      if (res.recommendations) {
        setRecommendations(res.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [realCampaigns]);

  const syncAllCampaigns = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncing(true);

    const nextErrors: { google: string | null; meta: string | null; tiktok: string | null } = {
      google: null,
      meta: null,
      tiktok: null,
    };
    const collected: LiveCampaign[] = [];

    try {
      const googleConn = connections.find(c => c.id === 'google');
      if (googleConn?.status === 'connected') {
        const googleToken = googleConn.settings?.googleAccessToken || '';
        const googleAdsId = googleConn.settings?.googleAdsId || '';
        if (!googleToken || !googleAdsId) {
          nextErrors.google = isHebrew
            ? 'Google מחובר אבל חסר Access Token או Google Ads ID.'
            : 'Google connected but missing Access Token or Google Ads ID.';
        } else {
          try {
            const googleCampaigns = await fetchGoogleCampaigns(googleToken, googleAdsId, undefined, resolvedRange);
            collected.push(...googleCampaigns.map((campaign: any) => normalizeCampaign(campaign, 'Google')));
          } catch (error) {
            nextErrors.google = error instanceof Error ? error.message : (isHebrew ? 'סנכרון Google נכשל.' : 'Google sync failed.');
          }
        }
      }

      const metaConn = connections.find(c => c.id === 'meta');
      if (metaConn?.status === 'connected') {
        const metaToken = metaConn.settings?.metaToken || '';
        const metaAdsId =
          metaConn.settings?.metaAdsId ||
          metaConn.settings?.adAccountId ||
          metaConn.settings?.metaAdAccountId ||
          '';
        if (!metaToken || !metaAdsId) {
          nextErrors.meta = isHebrew
            ? 'Meta מחובר אבל חסר Access Token או Ads Account ID.'
            : 'Meta connected but missing Access Token or Ads Account ID.';
        } else {
          try {
            const metaCampaigns = await fetchMetaCampaigns(metaToken, metaAdsId, resolvedRange);
            collected.push(...metaCampaigns.map((campaign: any) => normalizeCampaign(campaign, 'Meta')));
          } catch (error) {
            nextErrors.meta = error instanceof Error ? error.message : (isHebrew ? 'סנכרון Meta נכשל.' : 'Meta sync failed.');
          }
        }
      }

      const tiktokConn = connections.find(c => c.id === 'tiktok');
      if (tiktokConn?.status === 'connected') {
        const tiktokToken = tiktokConn.settings?.tiktokToken || '';
        const tiktokAdvertiserId = tiktokConn.settings?.tiktokAdvertiserId || '';
        if (!tiktokToken || !tiktokAdvertiserId) {
          nextErrors.tiktok = isHebrew
            ? 'TikTok מחובר אבל חסר Access Token או Advertiser ID.'
            : 'TikTok connected but missing Access Token or Advertiser ID.';
        } else {
          try {
            const tiktokCampaigns = await fetchTikTokCampaigns(tiktokToken, tiktokAdvertiserId, resolvedRange);
            collected.push(...tiktokCampaigns.map((campaign: any) => normalizeCampaign(campaign, 'TikTok')));
          } catch (error) {
            nextErrors.tiktok = error instanceof Error ? error.message : (isHebrew ? 'סנכרון TikTok נכשל.' : 'TikTok sync failed.');
          }
        }
      }

      setRealCampaigns(collected);
      setSyncErrors(nextErrors);
      setLastSyncAt(new Date().toISOString());
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [connections, isHebrew, resolvedRange.endDate, resolvedRange.startDate]);

  useEffect(() => {
    void syncAllCampaigns();

    const intervalId = window.setInterval(() => {
      void syncAllCampaigns();
    }, 45_000);

    const handleFocus = () => {
      void syncAllCampaigns();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncAllCampaigns]);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  const handleApply = (index: number) => {
    setAppliedRecs([...appliedRecs, index]);
  };

  const handleSendEmail = async () => {
    const googleConn = connections.find(c => c.id === 'google');
    if (!googleConn?.settings?.googleAccessToken) {
      alert("Please connect Google Workspace first to send emails.");
      return;
    }

    setSendingEmail(true);
    try {
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;">
          <h2 style="color: #4f46e5;">BScale AI: Optimization Recommendations</h2>
          <p>Here are the latest AI-generated recommendations for your advertising campaigns:</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          ${recommendations.map(rec => `
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
          `).join('')}
          <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
            Sent from BScale AI Dashboard.
          </p>
        </div>
      `;
      
      await sendGmailNotification(
        googleConn.settings.googleAccessToken,
        auth.currentUser?.email || '',
        'BScale AI: Your Campaign Recommendations',
        emailBody
      );
      alert("Recommendations sent to your email!");
    } catch (err) {
      console.error("Failed to send email:", err);
      alert("Failed to send email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  const hasConnectedAdPlatform = useMemo(
    () =>
      connections.some(
        (conn) => (conn.id === 'google' || conn.id === 'meta' || conn.id === 'tiktok') && conn.status === 'connected'
      ),
    [connections]
  );

  const syncIssues = useMemo(
    () => Object.entries(syncErrors).filter(([, value]) => Boolean(value)) as Array<[string, string]>,
    [syncErrors]
  );

  const allCampaigns = realCampaigns;

  const filteredAndSortedCampaigns = allCampaigns
    .filter(campaign => {
      const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlatform = platformFilter === 'All' || campaign.platform === platformFilter;
      const matchesStatus = statusFilter === 'All' || campaign.status === statusFilter;
      return matchesSearch && matchesPlatform && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      // Handle numeric values (spend, cpa)
      if (typeof valA === 'string' && String(valA).startsWith('₪')) {
        valA = parseFloat(valA.replace('₪', '').replace(',', ''));
        valB = parseFloat((valB as string).replace('₪', '').replace(',', ''));
      } else if (sortField === 'roas') {
        valA = parseFloat(String(valA || '0'));
        valB = parseFloat(String(valB || '0'));
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const platforms = ['All', ...new Set(allCampaigns.map(c => c.platform))];
  const statuses = ['All', ...new Set(allCampaigns.map(c => c.status))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('campaigns.title')}</h1>
        <button 
          onClick={fetchRecommendations}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Zap className="w-4 h-4 ml-2" />}
          {t('campaigns.refreshAi')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{t('campaigns.activeCampaigns')}</h3>
              <div className="flex flex-col items-end">
                {isSyncing && (
                  <span className="flex items-center text-xs text-indigo-600 font-bold animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin ml-1" />
                    {isHebrew ? 'מסנכרן נתונים חיים...' : 'Syncing live data...'}
                  </span>
                )}
                {lastSyncAt && (
                  <span className="text-[11px] text-gray-500">
                    {isHebrew ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                    {new Date(lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {syncIssues.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-bold text-amber-800">
                  {isHebrew ? 'התראות סנכרון (בדוק חיבורים):' : 'Sync alerts (check connections):'}
                </p>
                <ul className="mt-1 space-y-1 text-xs text-amber-800">
                  {syncIssues.map(([platform, message]) => (
                    <li key={platform}>
                      <span className="font-bold uppercase">{platform}</span>: {message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Filters and Search */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('campaigns.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {platforms.map(p => (
                  <option key={p} value={p}>{p === 'All' ? t('campaigns.allPlatforms') : p}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{s === 'All' ? t('campaigns.allStatuses') : s}</option>
                ))}
              </select>

              <div className="flex space-x-2 rtl:space-x-reverse">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="name">{t('campaigns.campaignName')}</option>
                  <option value="platform">{t('campaigns.platform')}</option>
                  <option value="status">{t('campaigns.status')}</option>
                  <option value="spend">{t('campaigns.spend')}</option>
                  <option value="roas">{t('campaigns.roas')}</option>
                  <option value="cpa">{t('campaigns.cpa')}</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  title={sortOrder === 'asc' ? t('campaigns.ascending') : t('campaigns.descending')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.campaignName')}</th>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.platform')}</th>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.status')}</th>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.spend')}</th>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.roas')}</th>
                  <th scope="col" className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('campaigns.cpa')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedCampaigns.length > 0 ? (
                  filteredAndSortedCampaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          campaign.platform === 'Google' ? "bg-blue-100 text-blue-800" :
                          campaign.platform === 'Meta' ? "bg-indigo-100 text-indigo-800" :
                          campaign.platform === 'TikTok' ? "bg-gray-900 text-white" :
                          "bg-gray-100 text-gray-800"
                        )}>
                          {campaign.platform === 'TikTok' && <Video className="w-3 h-3 ml-1" />}
                          {campaign.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          campaign.status === 'Active' ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        )}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{campaign.spend}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{campaign.roas}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{campaign.cpa}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      {hasConnectedAdPlatform
                        ? (isHebrew ? 'אין כרגע קמפיינים חיים לטווח הזמן שנבחר.' : 'No live campaigns for the selected date range yet.')
                        : t('campaigns.noCampaigns')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-indigo-50 flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-indigo-900 flex items-center">
              <Zap className="w-5 h-5 ml-2 text-indigo-600" />
              {t('campaigns.aiRecommendations')}
            </h3>
            {recommendations.length > 0 && (
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="inline-flex items-center p-1.5 border border-indigo-200 rounded-md text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                title="Send to Email"
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : recommendations.length > 0 ? (
              <ul className="space-y-4">
                {recommendations.map((rec, index) => (
                  <li key={index} className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2",
                            rec.impact === 'High' ? "bg-red-100 text-red-800" :
                            rec.impact === 'Medium' ? "bg-yellow-100 text-yellow-800" :
                            "bg-green-100 text-green-800"
                          )}>
                            {t('campaigns.impact')}: {
                              rec.impact === 'High' ? t('campaigns.impactHigh') :
                              rec.impact === 'Medium' ? t('campaigns.impactMedium') :
                              t('campaigns.impactLow')
                            }
                          </span>
                          <span className="text-xs text-gray-500">{rec.platform}</span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mt-2">{rec.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleApply(index)}
                        disabled={appliedRecs.includes(index)}
                        className={cn(
                          "w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
                          appliedRecs.includes(index)
                            ? "bg-green-50 text-green-700 border-green-200 cursor-not-allowed"
                            : "text-white bg-indigo-600 hover:bg-indigo-700"
                        )}
                      >
                        {appliedRecs.includes(index) ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-2" />
                            {t('campaigns.appliedSuccess')}
                          </>
                        ) : (
                          t('campaigns.applyAuto')
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p>{t('campaigns.noRecommendations')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

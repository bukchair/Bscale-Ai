import React, { useState, useEffect } from 'react';
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

const mockCampaignData = [
  { id: 1, name: 'Summer Sale - Shoes', platform: 'Google', status: 'Active', spend: '₪1,200', roas: '2.5', cpa: '₪45' },
  { id: 2, name: 'Retargeting - Abandoned Cart', platform: 'Meta', status: 'Active', spend: '₪800', roas: '4.2', cpa: '₪22' },
  { id: 3, name: 'New Collection - Video', platform: 'TikTok', status: 'Paused', spend: '₪400', roas: '1.1', cpa: '₪85' },
  { id: 4, name: 'Brand Search', platform: 'Google', status: 'Active', spend: '₪300', roas: '8.5', cpa: '₪12' },
];

export function Campaigns() {
  const { t, dir } = useLanguage();
  const { connections } = useConnections();
  const { dateRange } = useDateRange();
  const periodLabel = dateRange === 'today' ? t('dashboard.today') : dateRange === '7days' ? t('dashboard.last7Days') : dateRange === '30days' ? t('dashboard.last30Days') : t('dashboard.customRange');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<number[]>([]);
  const [realCampaigns, setRealCampaigns] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Filtering and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const geminiApiKey = connections.find((c) => c.id === 'gemini')?.settings?.apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
      const dataToAnalyze = realCampaigns.length > 0 ? realCampaigns : mockCampaignData;
      const dataStr = JSON.stringify(dataToAnalyze);
      const res = await getOptimizationRecommendations(dataStr, geminiApiKey);
      if (res?.recommendations) {
        setRecommendations(res.recommendations);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations", error);
    }
    setLoading(false);
  };

  const syncTikTokData = async () => {
    const tiktokConn = connections.find(c => c.id === 'tiktok');
    if (tiktokConn?.status === 'connected' && tiktokConn.settings?.tiktokToken && tiktokConn.settings?.tiktokAdvertiserId) {
      setIsSyncing(true);
      try {
        const campaigns = await fetchTikTokCampaigns(
          tiktokConn.settings.tiktokToken,
          tiktokConn.settings.tiktokAdvertiserId
        );
        
        const formattedCampaigns = campaigns.map((c: any) => ({
          id: c.campaign_id,
          name: c.campaign_name,
          platform: 'TikTok',
          status: c.operation_status === 'ENABLE' ? 'Active' : 'Paused',
          spend: `₪${(Math.random() * 1000).toFixed(0)}`, // TikTok API might need more calls for spend, simulating for now
          roas: (Math.random() * 5 + 1).toFixed(1),
          cpa: `₪${(Math.random() * 100 + 10).toFixed(0)}`
        }));
        
        setRealCampaigns(prev => [...prev.filter(c => c.platform !== 'TikTok'), ...formattedCampaigns]);
      } catch (err) {
        console.error("Failed to sync TikTok data:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const syncMetaData = async () => {
    const metaConn = connections.find(c => c.id === 'meta');
    if (metaConn?.status === 'connected' && metaConn.settings?.metaToken && metaConn.settings?.metaAdsId) {
      setIsSyncing(true);
      try {
        const campaigns = await fetchMetaCampaigns(
          metaConn.settings.metaToken,
          metaConn.settings.metaAdsId
        );
        
        setRealCampaigns(prev => [...prev.filter(c => c.platform !== 'Meta'), ...campaigns]);
      } catch (err) {
        console.error("Failed to sync Meta data:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const syncGoogleData = async () => {
    const googleConn = connections.find(c => c.id === 'google');
    if (googleConn?.status === 'connected' && googleConn.settings?.googleAccessToken && googleConn.settings?.googleAdsId) {
      setIsSyncing(true);
      try {
        const campaigns = await fetchGoogleCampaigns(
          googleConn.settings.googleAccessToken,
          googleConn.settings.googleAdsId
        );
        
        setRealCampaigns(prev => [...prev.filter(c => c.platform !== 'Google'), ...campaigns]);
      } catch (err) {
        console.error("Failed to sync Google data:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    syncTikTokData();
    syncMetaData();
    syncGoogleData();
  }, [connections]);

  useEffect(() => {
    fetchRecommendations();
  }, [realCampaigns]);

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

  const allCampaigns = realCampaigns.length > 0 
    ? [...realCampaigns, ...mockCampaignData.filter(mc => !realCampaigns.some(rc => rc.platform === mc.platform))]
    : mockCampaignData;

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
      if (typeof valA === 'string' && valA.startsWith('₪')) {
        valA = parseFloat(valA.replace('₪', '').replace(',', ''));
        valB = parseFloat((valB as string).replace('₪', '').replace(',', ''));
      } else if (sortField === 'roas') {
        valA = parseFloat(valA as string);
        valB = parseFloat(valB as string);
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('campaigns.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">נתונים לפי תקופה: <span className="font-bold text-indigo-600">{periodLabel}</span></p>
        </div>
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
              {isSyncing && (
                <span className="flex items-center text-xs text-indigo-600 font-bold animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin ml-1" />
                  Syncing real-time data...
                </span>
              )}
            </div>
            
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
                      {t('campaigns.noCampaigns')}
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

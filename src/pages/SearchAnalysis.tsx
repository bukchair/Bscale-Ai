import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, AlertTriangle, TrendingUp, TrendingDown, Filter, Download, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const searchTerms = [
  { term: 'נעלי ריצה זולות', clicks: 145, cost: 320, conversions: 0, roas: 0, source: 'Google Ads', status: 'review' },
  { term: 'נעלי הריצה הטובות ביותר 2024', clicks: 320, cost: 850, conversions: 12, roas: 4.2, source: 'Google Ads', status: 'optimal' },
  { type: 'organic', term: 'איך להתחיל לרוץ', impressions: 4500, clicks: 320, position: 4.2, source: 'GSC', status: 'opportunity' },
  { term: 'אפליקציית ריצה חינם', clicks: 85, cost: 120, conversions: 0, roas: 0, source: 'Google Ads', status: 'negative_candidate' },
  { type: 'organic', term: 'נעלי ריצה קרובות אלי', impressions: 1200, clicks: 45, position: 8.5, source: 'GSC', status: 'improve' },
];

export function SearchAnalysis() {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'ads' | 'organic' | 'negative'>('all');

  const negativeKeywords = [
    { id: 1, term: 'חינם', matchType: 'רחב', campaign: 'כל הקמפיינים', addedDate: '2024-03-01' },
    { id: 2, term: 'דרושים', matchType: 'ביטוי', campaign: 'נעלי גברים', addedDate: '2024-03-05' },
    { id: 3, term: 'יד שניה', matchType: 'מדויק', campaign: 'נעלי נשים', addedDate: '2024-03-10' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.searchAnalysis')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('search.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-bold shadow-sm">
            <Filter className="w-4 h-4" />
            {t('search.filters')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-bold shadow-sm">
            <Download className="w-4 h-4" />
            {t('search.export')}
          </button>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-2xl shadow-lg p-1 relative overflow-hidden">
        <div className={cn("absolute top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2", dir === 'rtl' ? "-left-1/4" : "-right-1/4")} />
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center text-amber-300">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('search.aiInsightsTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-indigo-100 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: t('search.aiInsightsDesc') }} />
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-white block mb-1">{t('search.negativeCandidates')}</span>
                    <span className="text-xs text-indigo-200">{t('search.negativeCandidatesDesc')}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                  <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-white block mb-1">{t('search.seoOpportunity')}</span>
                    <span className="text-xs text-indigo-200">{t('search.seoOpportunityDesc')}</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-black/20 rounded-xl p-6 border border-white/10 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-indigo-200 mb-2">{t('search.monthlySavings')}</p>
              <p className="text-4xl font-black text-emerald-400" dir="ltr">₪1,760</p>
              <button className="mt-6 px-6 py-2.5 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-sm w-full shadow-lg">
                {t('search.reviewAndApply')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Terms Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">{t('search.performanceTitle')}</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('all')}
              className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-colors", activeTab === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {t('search.allTerms')}
            </button>
            <button 
              onClick={() => setActiveTab('ads')}
              className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-colors", activeTab === 'ads' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              Google Ads
            </button>
            <button 
              onClick={() => setActiveTab('organic')}
              className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-colors", activeTab === 'organic' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {t('search.organicGsc')}
            </button>
            <button 
              onClick={() => setActiveTab('negative')}
              className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-colors", activeTab === 'negative' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {t('search.negativeKeywords')}
            </button>
          </div>
        </div>
        
        {activeTab === 'negative' ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{t('search.manageNegatives')}</h3>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                {t('search.addNegative')}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className={cn("w-full text-sm", dir === 'rtl' ? "text-right" : "text-left")}>
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-bold">{t('search.negativeKeyword')}</th>
                    <th className="px-6 py-4 font-bold">{t('search.matchType')}</th>
                    <th className="px-6 py-4 font-bold">{t('search.campaignGroup')}</th>
                    <th className="px-6 py-4 font-bold">{t('search.addedDate')}</th>
                    <th className={cn("px-6 py-4 font-bold", dir === 'rtl' ? "text-left" : "text-right")}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {negativeKeywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{kw.term}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold">
                          {kw.matchType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{kw.campaign}</td>
                      <td className="px-6 py-4 text-gray-500">{kw.addedDate}</td>
                      <td className={cn("px-6 py-4", dir === 'rtl' ? "text-left" : "text-right")}>
                        <button className="text-red-600 hover:text-red-800 font-bold text-sm">
                          {t('search.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn("w-full text-sm", dir === 'rtl' ? "text-right" : "text-left")}>
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('search.searchTerm')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.source')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.metrics')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.performance')}</th>
                  <th className="px-6 py-4 font-bold">{t('search.aiStatus')}</th>
                  <th className={cn("px-6 py-4 font-bold", dir === 'rtl' ? "text-left" : "text-right")}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {searchTerms.filter(t => activeTab === 'all' || (activeTab === 'ads' && t.source === 'Google Ads') || (activeTab === 'organic' && t.source === 'GSC')).map((term, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        {term.term}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold",
                        term.source === 'Google Ads' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      )}>
                        {term.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {term.source === 'Google Ads' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">{term.clicks} {t('search.clicks')}</span>
                          <span className="text-gray-500 text-xs" dir="ltr">₪{term.cost} {t('search.spend')}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">{term.impressions?.toLocaleString()} {t('search.impressions')}</span>
                          <span className="text-gray-500 text-xs">{term.clicks} {t('search.clicks')}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {term.source === 'Google Ads' ? (
                        <div className="flex flex-col gap-1">
                          <span className={cn("font-bold", term.roas > 0 ? "text-emerald-600" : "text-red-600")} dir="ltr">
                            {term.roas > 0 ? `${term.roas}x ROAS` : `0 ${t('search.conversions')}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-bold">{t('search.position')}: {term.position}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "flex items-center gap-1.5 text-xs font-bold",
                        term.status === 'optimal' ? "text-emerald-600" :
                        term.status === 'negative_candidate' ? "text-red-600" :
                        term.status === 'opportunity' ? "text-indigo-600" :
                        "text-amber-600"
                      )}>
                        {term.status === 'optimal' && <CheckCircle2 className="w-4 h-4" />}
                        {term.status === 'negative_candidate' && <XCircle className="w-4 h-4" />}
                        {term.status === 'opportunity' && <TrendingUp className="w-4 h-4" />}
                        {(term.status === 'review' || term.status === 'improve') && <AlertTriangle className="w-4 h-4" />}
                        {term.status === 'optimal' ? t('search.statusOptimal') :
                         term.status === 'negative_candidate' ? t('search.statusNegativeCandidate') :
                         term.status === 'opportunity' ? t('search.statusOpportunity') :
                         term.status === 'review' ? t('search.statusReview') :
                         term.status === 'improve' ? t('search.statusImprove') : term.status}
                      </span>
                    </td>
                    <td className={cn("px-6 py-4", dir === 'rtl' ? "text-left" : "text-right")}>
                      {term.status === 'negative_candidate' ? (
                        <button className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                          {t('search.addAsNegative')}
                        </button>
                      ) : (
                        <button className="text-indigo-600 hover:text-indigo-900 font-bold text-sm">
                          {t('search.viewDetails')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

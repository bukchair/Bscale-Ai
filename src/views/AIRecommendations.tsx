"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { generateAIRecommendations, getAIKeysFromConnections, hasAnyAIKey } from '../lib/gemini';
import { Lightbulb, TrendingUp, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, BarChart2, Facebook, Video, Megaphone, Zap, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface Recommendation {
  id: string;
  platform: 'google' | 'meta' | 'tiktok' | 'cross';
  type: 'budget' | 'creative' | 'targeting' | 'bid';
  title: string;
  description: string;
  impact: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'pending' | 'applied' | 'dismissed';
}

const mockRecommendations: Recommendation[] = [
  {
    id: '1',
    platform: 'cross',
    type: 'budget',
    title: 'ai.recs.budgetReallocation.title',
    description: 'ai.recs.budgetReallocation.desc',
    impact: '+18% ROAS',
    difficulty: 'easy',
    status: 'pending'
  },
  {
    id: '2',
    platform: 'google',
    type: 'bid',
    title: 'ai.recs.brandBid.title',
    description: 'ai.recs.brandBid.desc',
    impact: '+25% Conv. Vol',
    difficulty: 'easy',
    status: 'pending'
  },
  {
    id: '3',
    platform: 'meta',
    type: 'creative',
    title: 'ai.recs.creativeRefresh.title',
    description: 'ai.recs.creativeRefresh.desc',
    impact: '-20% CPA',
    difficulty: 'medium',
    status: 'pending'
  },
  {
    id: '4',
    platform: 'tiktok',
    type: 'targeting',
    title: 'ai.recs.leadGen.title',
    description: 'ai.recs.leadGen.desc',
    impact: '-40% CPL',
    difficulty: 'medium',
    status: 'pending'
  }
];

const platformIcons = {
  google: Megaphone,
  meta: Facebook,
  tiktok: Video,
  cross: BarChart2
};

const platformColors = {
  google: 'text-blue-600 bg-blue-50',
  meta: 'text-indigo-600 bg-indigo-50',
  tiktok: 'text-pink-600 bg-pink-50',
  cross: 'text-purple-600 bg-purple-50'
};

export function AIRecommendations() {
  const { t, dir, language } = useLanguage();
  const { format: formatCurrency } = useCurrency();
  const { connections } = useConnections();
  const [recs, setRecs] = useState<Recommendation[]>(mockRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiKeys = getAIKeysFromConnections(connections);
  const hasAI = hasAnyAIKey(aiKeys);

  const fetchRealRecommendations = async () => {
    if (!hasAI) {
      setError(
        t('ai.errorLoading') ||
          (language === 'he'
            ? 'נכשלה טעינת המלצות AI. חבר את Gemini, OpenAI או Claude בהתחברויות.'
            : 'Failed to load AI recommendations. Connect Gemini, OpenAI, or Claude in Integrations.')
      );
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const context = `
        Current connected platforms: ${connections.filter(c => c.status === 'connected').map(c => c.name).join(', ')}.
        Overall quality score: ${connections.length ? (connections.reduce((acc, c) => acc + (c.score || 0), 0) / connections.length) : 0}.
        The user is looking for ways to optimize their marketing spend and increase ROAS.
      `;
      const newRecs = await generateAIRecommendations(aiKeys, context);
      setRecs(Array.isArray(newRecs) ? newRecs.map((r) => ({ ...r, status: 'pending' as const })) : mockRecommendations);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        (t('ai.errorLoading') ||
          (language === 'he' ? 'נכשלה טעינת המלצות AI. נסה שוב.' : 'Failed to load AI recommendations. Please try again.')) +
          (message ? ` (${message.slice(0, 80)})` : '')
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasAI) {
      fetchRealRecommendations();
    }
  }, [hasAI]);

  const handleApply = (id: string) => {
    setRecs(recs.map(r => r.id === id ? { ...r, status: 'applied' } : r));
  };

  const handleApplyAll = () => {
    if (!pendingRecs.length) return;
    setRecs(recs.map(r => r.status === 'pending' ? { ...r, status: 'applied' } : r));
    alert(
      language === 'he'
        ? 'כל ההמלצות סומנו כמייושמות (דמו). בחיבור מלא ניתן יהיה להחיל שינויים אמיתיים בקמפיינים.'
        : 'All recommendations were marked as applied (demo). With full integrations, real campaign changes can be applied.'
    );
  };

  const pendingRecs = recs.filter(r => r.status === 'pending');
  const appliedRecs = recs.filter(r => r.status === 'applied');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.aiRecommendations')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('ai.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAI ? (
            <button 
              onClick={fetchRealRecommendations}
              disabled={isLoading}
              className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('ai.refresh')}
            </button>
          ) : (
            <span className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              {language === 'he'
                ? 'חבר את Gemini בהתחברויות והזן API Key לקבלת המלצות'
                : 'Connect Gemini in Integrations and add an API key to receive recommendations'}
            </span>
          )}
          <button
            onClick={handleApplyAll}
            disabled={!pendingRecs.length}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {t('ai.applyAll')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {!hasAI && !error && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">
              {language === 'he' ? 'מנוע ה-AI (Gemini) לא מחובר' : 'AI engine (Gemini) is not connected'}
            </p>
            <p>
              {language === 'he'
                ? 'עבור להתחברויות, בחר Gemini, OpenAI או Claude והזן API Key. לאחר החיבור ייטענו כאן המלצות אוטומטית.'
                : 'Go to Integrations, choose Gemini, OpenAI, or Claude, and provide an API key. Recommendations will load automatically after connection.'}
            </p>
          </div>
        </div>
      )}

      {/* Cross-Platform Analysis Summary */}
      <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className={cn("absolute top-0 -mt-4 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl", dir === 'rtl' ? "-left-4" : "-right-4")}></div>
        <div className={cn("absolute bottom-0 -mb-4 w-24 h-24 bg-indigo-500 opacity-20 rounded-full blur-xl", dir === 'rtl' ? "-right-4" : "-left-4")}></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-6 h-6 text-amber-300" />
            <h2 className="text-xl font-bold">{t('ai.analysisTitle')}</h2>
          </div>
          <p className="text-indigo-100 leading-relaxed mb-6 max-w-3xl">
            {t('ai.analysisSummary')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-4 h-4 text-blue-300" />
                <span className="font-medium text-sm">Google Ads</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-indigo-200">{t('profitability.avgRoas')}</p>
                  <p className="text-xl font-bold text-emerald-400" dir="ltr">3.2x</p>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="text-xs text-indigo-200">CPA</p>
                  <p className="text-lg font-semibold" dir="ltr">{formatCurrency(45)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Facebook className="w-4 h-4 text-indigo-300" />
                <span className="font-medium text-sm">Meta Ads</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-indigo-200">{t('profitability.avgRoas')}</p>
                  <p className="text-xl font-bold text-emerald-400" dir="ltr">2.1x</p>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="text-xs text-indigo-200">CPA</p>
                  <p className="text-lg font-semibold" dir="ltr">{formatCurrency(62)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-pink-300" />
                <span className="font-medium text-sm">TikTok Ads</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-indigo-200">{t('profitability.avgRoas')}</p>
                  <p className="text-xl font-bold text-amber-400" dir="ltr">1.2x</p>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  <p className="text-xs text-indigo-200">CPA</p>
                  <p className="text-lg font-semibold" dir="ltr">{formatCurrency(85)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          {t('ai.proposedImprovements')}
          <span className="bg-indigo-100 text-indigo-700 text-xs py-0.5 px-2 rounded-full font-bold">
            {pendingRecs.length}
          </span>
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {pendingRecs.map((rec) => {
            const Icon = platformIcons[rec.platform];
            const colorClass = platformColors[rec.platform];
            
            return (
              <div key={rec.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", colorClass)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-gray-900">{t(rec.title)}</h4>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                          rec.difficulty === 'easy' ? "bg-emerald-100 text-emerald-700" :
                          rec.difficulty === 'medium' ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {rec.difficulty === 'easy' ? t('common.easy') : rec.difficulty === 'medium' ? t('common.medium') : t('common.hard')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 max-w-3xl leading-relaxed">
                        {t(rec.description)}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 w-fit px-2.5 py-1 rounded-md">
                        <TrendingUp className="w-4 h-4" />
                        {t('ai.expectedImpact')}: <span dir="ltr">{rec.impact}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0 md:self-center mt-4 md:mt-0">
                    <button className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                      {t('common.dismiss')}
                    </button>
                    <button 
                      onClick={() => handleApply(rec.id)}
                      className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2"
                    >
                      {t('common.applyNow')}
                      {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Applied History */}
      {appliedRecs.length > 0 && (
        <div className="pt-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('ai.recentlyApplied')}</h3>
          <div className="space-y-3">
            {appliedRecs.map((rec) => (
              <div key={rec.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center justify-between opacity-75">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-900 line-through decoration-gray-400">{t(rec.title)}</p>
                    <p className="text-xs text-gray-500">{t('ai.appliedSuccessfully')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded" dir="ltr">
                  {rec.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

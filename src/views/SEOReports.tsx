"use client";

import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConnections } from '../contexts/ConnectionsContext';
import { Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Globe, Zap, ArrowUpRight, BarChart2, FileText, Loader2, Check } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { cn } from '../lib/utils';
import { optimizeProductSEO, getAIKeysFromConnections } from '../lib/gemini';

const seoTrafficData = [
  { date: '01/03', clicks: 120, impressions: 4500, position: 12.4 },
  { date: '05/03', clicks: 145, impressions: 4800, position: 11.2 },
  { date: '10/03', clicks: 130, impressions: 4200, position: 12.8 },
  { date: '15/03', clicks: 180, impressions: 5600, position: 9.5 },
  { date: '20/03', clicks: 210, impressions: 6100, position: 8.2 },
  { date: '25/03', clicks: 195, impressions: 5900, position: 8.7 },
  { date: '30/03', clicks: 240, impressions: 6800, position: 7.4 },
];

const topKeywords = [
  { keyword: 'נעלי ריצה', clicks: 450, impressions: 12500, ctr: 3.6, position: 4.2, change: 1.5 },
  { keyword: 'סניקרס למרתון', clicks: 320, impressions: 8400, ctr: 3.8, position: 2.1, change: 0.5 },
  { keyword: 'ציוד ריצה זול', clicks: 180, impressions: 9200, ctr: 1.9, position: 11.4, change: -2.1 },
  { keyword: 'איך להתחיל לרוץ', clicks: 145, impressions: 15000, ctr: 0.9, position: 15.8, change: 4.2 },
  { keyword: 'נעלי ריצת שטח גברים', clicks: 95, impressions: 3200, ctr: 2.9, position: 6.5, change: -0.8 },
];

export function SEOReports() {
  const { t, dir, language } = useLanguage();
  const isHebrew = language === 'he';
  const { connections } = useConnections();
  const aiKeys = getAIKeysFromConnections(connections);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'pages' | 'products'>('overview');
  const [optimizingId, setOptimizingId] = useState<number | null>(null);
  const [optimizedProducts, setOptimizedProducts] = useState<Record<number, any>>({});

  const products = [
    { id: 1, name: 'נעלי ריצה Nike Air Zoom', shortDesc: 'נעלי ריצה נוחות.', longDesc: 'נעלי ריצה מקצועיות עם סוליה בולמת זעזועים. מתאימות לריצות ארוכות.', image: 'https://picsum.photos/seed/nike/100/100', seoScore: 65, issues: ['תיאור קצר מדי', 'חסר Alt-Text לתמונה', 'כותרת לא מכילה מילות מפתח'] },
    { id: 2, name: 'מכנסי אימון Adidas', shortDesc: 'מכנסי אימון.', longDesc: 'מכנסי אימון קלים ונושמים.', image: 'https://picsum.photos/seed/adidas/100/100', seoScore: 82, issues: ['תיאור מטא לא אופטימלי'] },
    { id: 3, name: 'שעון Garmin Forerunner', shortDesc: 'שעון חכם למעקב.', longDesc: 'שעון חכם עם מד דופק, GPS ומעקב שינה. עמיד במים.', image: 'https://picsum.photos/seed/garmin/100/100', seoScore: 45, issues: ['אין תיאור מוצר', 'תמונה באיכות נמוכה', 'כותרת לא ברורה'] },
  ];

  const handleOptimizeProduct = async (product: { id: number; name: string; longDesc: string }) => {
    setOptimizingId(product.id);
    try {
      const res = await optimizeProductSEO(product.name, product.longDesc, aiKeys);
      setOptimizedProducts(prev => ({ ...prev, [product.id]: res }));
    } catch (error) {
      console.error("Failed to optimize", error);
    }
    setOptimizingId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.seoCenter')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isHebrew
              ? 'ביצועים אורגניים, דירוג מילות מפתח ואופטימיזציית מוצרים מבוססת AI.'
              : 'Organic performance, keyword rankings, and AI-powered product optimization.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            <Globe className="w-4 h-4" />
            {isHebrew ? 'חבר GSC' : 'Connect GSC'}
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{isHebrew ? 'סה"כ קליקים' : 'Total clicks'}</h3>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Search className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">1,220</p>
          <p className="text-sm text-emerald-600 flex items-center mt-2 font-medium">
            <TrendingUp className={cn("w-4 h-4", dir === 'rtl' ? "ml-1" : "mr-1")} /> +15.2%
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{isHebrew ? 'סה"כ חשיפות' : 'Total impressions'}</h3>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">37.5K</p>
          <p className="text-sm text-emerald-600 flex items-center mt-2 font-medium">
            <TrendingUp className={cn("w-4 h-4", dir === 'rtl' ? "ml-1" : "mr-1")} /> +8.4%
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{isHebrew ? 'CTR ממוצע' : 'Average CTR'}</h3>
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">3.2%</p>
          <p className="text-sm text-emerald-600 flex items-center mt-2 font-medium">
            <TrendingUp className={cn("w-4 h-4", dir === 'rtl' ? "ml-1" : "mr-1")} /> +0.5%
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{isHebrew ? 'מיקום ממוצע' : 'Average position'}</h3>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">10.4</p>
          <p className="text-sm text-emerald-600 flex items-center mt-2 font-medium">
            <TrendingUp className={cn("w-4 h-4", dir === 'rtl' ? "ml-1" : "mr-1")} /> -1.2
          </p>
        </div>
      </div>

      {/* AI SEO Recommendations */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-2xl shadow-lg p-1 relative overflow-hidden">
        <div className={cn("absolute top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2", dir === 'rtl' ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3")} />
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-400/20 rounded-lg flex items-center justify-center text-amber-300">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">{isHebrew ? 'הזדמנויות SEO מבוססות AI' : 'AI-powered SEO opportunities'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-indigo-100 text-sm leading-relaxed">
                {isHebrew
                  ? 'ניתחנו את נתוני ה-Search Console שלך וזיהינו 3 הזדמנויות בעלות השפעה גבוהה להגדלת התנועה האורגנית.'
                  : 'We analyzed your Search Console data and identified 3 high-impact opportunities to increase organic traffic.'}
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                  <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-white block mb-1">{isHebrew ? 'מילות מפתח בטווח פגיעה' : 'Near-win keywords'}</span>
                    <span className="text-xs text-indigo-200">
                      {isHebrew
                        ? '"ציוד ריצה זול" מדורג במיקום 11.4. הוספת 2 קישורים פנימיים ועדכון ה-H1 יכולים לדחוף אותו לעמוד 1, ולהכפיל את הקליקים.'
                        : '"Affordable running gear" ranks at 11.4. Adding 2 internal links and improving the H1 can push it to page 1 and double clicks.'}
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/10">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-bold text-white block mb-1">{isHebrew ? 'CTR נמוך בדפים עם חשיפות גבוהות' : 'Low CTR on high-impression pages'}</span>
                    <span className="text-xs text-indigo-200">
                      {isHebrew
                        ? 'למדריך "איך להתחיל לרוץ" יש 15k חשיפות אבל רק 0.9% CTR. שכתוב תיאור המטא יכול לשפר את שיעור ההקלקה.'
                        : 'The guide "How to start running" has 15k impressions but only 0.9% CTR. Rewriting the meta description can improve click-through rate.'}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-black/20 rounded-xl p-6 border border-white/10 flex flex-col justify-center items-center text-center">
              <p className="text-sm text-indigo-200 mb-2">{isHebrew ? 'עלייה משוערת בתנועה' : 'Estimated traffic lift'}</p>
              <p className="text-4xl font-black text-emerald-400">{isHebrew ? '+450 קליקים/חודש' : '+450 clicks/month'}</p>
              <button className="mt-6 px-6 py-2.5 bg-white text-indigo-900 font-bold rounded-lg hover:bg-indigo-50 transition-colors text-sm w-full shadow-lg">
                {isHebrew ? 'צור תיאורי מטא' : 'Generate meta descriptions'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">{isHebrew ? 'ביצועים אורגניים' : 'Organic performance'}</h2>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('overview')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'overview' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {isHebrew ? 'סקירה כללית' : 'Overview'}
            </button>
            <button 
              onClick={() => setActiveTab('keywords')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'keywords' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {isHebrew ? 'מילות מפתח' : 'Keywords'}
            </button>
            <button 
              onClick={() => setActiveTab('pages')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'pages' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {isHebrew ? 'דפים' : 'Pages'}
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'products' ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              {isHebrew ? 'מוצרים' : 'Products'}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={seoTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }} />
                  <YAxis yAxisId="right" orientation="right" reversed axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 500 }} />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" name={isHebrew ? 'קליקים' : 'Clicks'} stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="position" name={isHebrew ? 'מיקום ממוצע' : 'Average position'} stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {activeTab === 'keywords' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">{isHebrew ? 'מילת מפתח' : 'Keyword'}</th>
                    <th className="px-6 py-4 font-semibold">{isHebrew ? 'קליקים' : 'Clicks'}</th>
                    <th className="px-6 py-4 font-semibold">{isHebrew ? 'חשיפות' : 'Impressions'}</th>
                    <th className="px-6 py-4 font-semibold">CTR</th>
                    <th className="px-6 py-4 font-semibold">{isHebrew ? 'מיקום' : 'Position'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topKeywords.map((kw, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{kw.keyword}</td>
                      <td className="px-6 py-4">{kw.clicks}</td>
                      <td className="px-6 py-4">{kw.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4">{kw.ctr}%</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{kw.position}</span>
                          <span className={cn("text-xs flex items-center", kw.change > 0 ? "text-emerald-600" : "text-red-600")}>
                            {kw.change > 0 ? <TrendingUp className={cn("w-3 h-3", dir === 'rtl' ? "ml-0.5" : "mr-0.5")} /> : <TrendingDown className={cn("w-3 h-3", dir === 'rtl' ? "ml-0.5" : "mr-0.5")} />}
                            {Math.abs(kw.change)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">אופטימיזציית מוצרים (AI)</h3>
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  נתח את כל המוצרים
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col md:flex-row gap-6">
                    <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-gray-900">{product.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500">ציון SEO:</span>
                          <span className={cn(
                            "text-sm font-black",
                            product.seoScore >= 80 ? "text-emerald-600" :
                            product.seoScore >= 60 ? "text-amber-600" :
                            "text-red-600"
                          )}>{product.seoScore}/100</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {product.issues.map((issue, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                            <AlertTriangle className="w-3 h-3 ml-1" />
                            {issue}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          שפר תיאור
                        </button>
                        <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          אופטימיזציית תמונה
                        </button>
                        <button 
                          onClick={() => handleOptimizeProduct(product)}
                          disabled={optimizingId === product.id || !!optimizedProducts[product.id]}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {optimizingId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : optimizedProducts[product.id] ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          {optimizedProducts[product.id] ? 'בוצע' : 'תיקון מהיר (AI)'}
                        </button>
                      </div>
                      
                      {optimizedProducts[product.id] && (
                        <div className="mt-4 p-4 bg-white border border-indigo-100 rounded-lg space-y-3">
                          <h5 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            המלצות AI
                          </h5>
                          <div>
                            <span className="text-xs font-bold text-gray-500 block mb-1">תיאור קצר מומלץ:</span>
                            <p className="text-sm text-gray-800">{optimizedProducts[product.id].shortDescription}</p>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-500 block mb-1">תיאור ארוך מומלץ:</span>
                            <p className="text-sm text-gray-800">{optimizedProducts[product.id].longDescription}</p>
                          </div>
                          {optimizedProducts[product.id].imageAltTexts && (
                            <div>
                              <span className="text-xs font-bold text-gray-500 block mb-1">טקסט חלופי לתמונות (Alt):</span>
                              <ul className="list-disc list-inside text-sm text-gray-800">
                                {optimizedProducts[product.id].imageAltTexts.map((alt: string, i: number) => (
                                  <li key={i}>{alt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="pt-2">
                            <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                              החל שינויים בווקומרס
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

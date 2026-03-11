import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BrainCircuit, BarChart3, Globe, Target, Zap, Mail, Layers, LineChart, Sparkles, ArrowRight, BookOpen, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  BarChart as ReBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface LandingProps {
  onEnter: () => void;
  onOpenPrivacy: () => void;
}

const unifiedTrendData = [
  { name: 'Mon', revenue: 12400, spend: 4300 },
  { name: 'Tue', revenue: 13250, spend: 4600 },
  { name: 'Wed', revenue: 14100, spend: 4700 },
  { name: 'Thu', revenue: 15220, spend: 4900 },
  { name: 'Fri', revenue: 16850, spend: 5200 },
  { name: 'Sat', revenue: 17420, spend: 5400 },
  { name: 'Sun', revenue: 18760, spend: 5650 },
];

const platformPerformanceData = [
  { platform: 'Google', revenue: 46200, spend: 15700 },
  { platform: 'Meta', revenue: 33800, spend: 12300 },
  { platform: 'TikTok', revenue: 19100, spend: 8800 },
  { platform: 'Woo', revenue: 54200, spend: 0 },
];

const sourceMixData = [
  { name: 'Paid', value: 46, color: '#6366F1' },
  { name: 'Organic', value: 28, color: '#10B981' },
  { name: 'Social', value: 17, color: '#F59E0B' },
  { name: 'Direct', value: 9, color: '#EC4899' },
];

export function Landing({ onEnter, onOpenPrivacy }: LandingProps) {
  const { t, dir } = useLanguage();
  const totalRevenue = unifiedTrendData.reduce((sum, row) => sum + row.revenue, 0);
  const totalSpend = unifiedTrendData.reduce((sum, row) => sum + row.spend, 0);
  const blendedRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';

  const features = [
    { icon: Target, title: t('landing.f1_title'), desc: t('landing.f1_desc') },
    { icon: BrainCircuit, title: t('landing.f2_title'), desc: t('landing.f2_desc') },
    { icon: Globe, title: t('landing.f3_title'), desc: t('landing.f3_desc') },
    { icon: Layers, title: t('landing.f4_title'), desc: t('landing.f4_desc') },
    { icon: LineChart, title: t('landing.f5_title'), desc: t('landing.f5_desc') },
    { icon: Zap, title: t('landing.f6_title'), desc: t('landing.f6_desc') },
    { icon: BarChart3, title: t('landing.f7_title'), desc: t('landing.f7_desc') },
    { icon: Mail, title: t('landing.f8_title'), desc: t('landing.f8_desc') },
  ];

  const steps = [
    { num: '01', title: t('landing.s1_title'), desc: t('landing.s1_desc') },
    { num: '02', title: t('landing.s2_title'), desc: t('landing.s2_desc') },
    { num: '03', title: t('landing.s3_title'), desc: t('landing.s3_desc') },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#050505] dark:text-white font-sans selection:bg-indigo-500/30 transition-colors duration-300" dir={dir}>
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 dark:bg-purple-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-8 h-8 text-indigo-600 dark:text-indigo-500" />
            <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              {t('app.name')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button
              onClick={onOpenPrivacy}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-white/80 dark:hover:text-white transition-colors"
            >
              {t('landing.privacy')}
            </button>
            <button
              onClick={onEnter}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-white/80 dark:hover:text-white transition-colors"
            >
              {t('landing.login')}
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-6 pt-12 pb-24 text-center lg:text-start lg:flex lg:items-center lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex-1"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-white/5 border border-indigo-200 dark:border-white/10 text-sm text-indigo-700 dark:text-indigo-300 mb-8">
              <Sparkles className="w-4 h-4" />
              <span>{t('app.slogan')}</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-tight">
              {t('landing.heroTitle1')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500">
                {t('landing.heroTitle2')}
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                onClick={onEnter}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-indigo-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-700 hover:scale-105 w-full sm:w-auto"
              >
                {t('landing.cta')}
                {dir === 'rtl' ? (
                  <ArrowLeft className="w-5 h-5 ms-2 group-hover:-translate-x-1 transition-transform" />
                ) : (
                  <ArrowRight className="w-5 h-5 ms-2 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
              <a
                href="#article"
                className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-all w-full sm:w-auto"
              >
                <BookOpen className="w-5 h-5 me-2" />
                {t('landing.readMore')}
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 mt-16 lg:mt-0 relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111]">
              <div className="h-10 bg-gray-100 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-white/10 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400 ms-2">{t('landing.unifiedPanelTitle')}</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {['Google Ads', 'Meta Ads', 'TikTok Ads', 'GA4', 'Search Console', 'WooCommerce'].map((platform) => (
                    <span
                      key={platform}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10"
                    >
                      {platform}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-3">
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">{t('landing.unifiedKpiRevenue')}</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">₪{totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-3">
                    <p className="text-[11px] text-red-700 dark:text-red-300">{t('landing.unifiedKpiSpend')}</p>
                    <p className="text-lg font-black text-red-700 dark:text-red-300">₪{totalSpend.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-3">
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">{t('landing.unifiedKpiRoas')}</p>
                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{blendedRoas}x</p>
                  </div>
                </div>

                <div className="h-44 w-full rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-2">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ReLineChart data={unifiedTrendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="spend" stroke="#EF4444" strokeWidth={2.5} dot={false} />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="h-44 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-2">
                    <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 px-2">{t('landing.performanceByPlatform')}</p>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <ReBarChart data={platformPerformanceData}>
                        <XAxis dataKey="platform" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="spend" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-44 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-2">
                    <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1 px-2">{t('landing.sourceMix')}</p>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie data={sourceMixData} dataKey="value" innerRadius={28} outerRadius={44} paddingAngle={2}>
                          {sourceMixData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </main>

        {/* Article/Description Section */}
        <section id="article" className="py-24 bg-white dark:bg-white/5 border-y border-gray-200 dark:border-white/10">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-900 dark:text-white">{t('landing.articleTitle')}</h2>
            <div className="prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300 leading-relaxed text-start">
              <p className="mb-6">
                {t('landing.articleP1')}
              </p>
              <p className="mb-6">
                <strong>{t('landing.articleP2')}</strong>
              </p>
              <ul className="list-disc list-inside mb-6 space-y-2">
                <li>{t('landing.articleL1')}</li>
                <li>{t('landing.articleL2')}</li>
                <li>{t('landing.articleL3')}</li>
                <li>{t('landing.articleL4')}</li>
              </ul>
              <p>
                {t('landing.articleP3')}
              </p>
            </div>
            <div className="mt-10">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-6">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-5">{t('landing.platformBridgeTitle')}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="space-y-3">
                    {['Google Ads', 'Meta Ads', 'TikTok Ads', 'GA4', 'Search Console', 'WooCommerce'].map((item) => (
                      <div
                        key={item}
                        className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-indigo-600 text-white p-6 text-center shadow-lg">
                    <BrainCircuit className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-lg font-black">{t('app.name')}</p>
                    <p className="text-xs text-indigo-100 mt-1">{t('landing.platformBridgeDesc')}</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      t('landing.bridgeOut1'),
                      t('landing.bridgeOut2'),
                      t('landing.bridgeOut3'),
                      t('landing.bridgeOut4'),
                    ].map((item) => (
                      <div
                        key={item}
                        className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-700 dark:text-gray-300"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{t('landing.featuresTitle')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('landing.featuresSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:shadow-lg dark:hover:bg-white/10 transition-all"
                >
                  <feature.icon className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mb-4" />
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="py-24 bg-gray-50 dark:bg-[#0a0a0a] border-y border-gray-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{t('landing.howItWorks')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('landing.howItWorksSub')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-1/2 start-0 w-full h-0.5 bg-gradient-to-r from-transparent via-gray-300 dark:via-white/10 to-transparent -translate-y-1/2 z-0" />
              
              {steps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 }}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-white dark:bg-indigo-600/20 border-2 border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-6 shadow-md dark:backdrop-blur-sm">
                    {step.num}
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-24 text-center">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">{t('landing.ready')}</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onEnter}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-gradient-to-r from-indigo-600 to-purple-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:scale-105 shadow-[0_0_40px_rgba(79,70,229,0.3)] dark:shadow-[0_0_40px_rgba(79,70,229,0.4)]"
              >
                {t('landing.cta')}
                {dir === 'rtl' ? (
                  <ArrowLeft className="w-5 h-5 ms-2 group-hover:-translate-x-1 transition-transform" />
                ) : (
                  <ArrowRight className="w-5 h-5 ms-2 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
              <button
                onClick={onOpenPrivacy}
                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                <ShieldCheck className="w-5 h-5 me-2" />
                {t('landing.privacy')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

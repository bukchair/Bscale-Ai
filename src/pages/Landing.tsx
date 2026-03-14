import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BrainCircuit, BarChart3, Globe, Target, Zap, Mail, Layers, LineChart, Sparkles, ArrowRight, BookOpen, ShoppingBag, Headphones, Building2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createPayPalCheckoutUrl, PAYPAL_BUSINESS_EMAIL } from '../lib/paypal';
import { SiteLegalNotice } from '../components/SiteLegalNotice';
import { trackEvent } from '../lib/tracking';

interface LandingProps {
  onEnter: () => void;
  scrollToPricing?: boolean;
}

const mockChartData = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 4500 },
  { name: 'May', value: 6000 },
  { name: 'Jun', value: 5500 },
  { name: 'Jul', value: 7000 },
];

export function Landing({ onEnter, scrollToPricing }: LandingProps) {
  const { t, dir, language } = useLanguage();
  const guideLabel =
    language === 'he'
      ? 'מדריך הפעלה למערכת'
      : language === 'ru'
        ? 'Руководство по системе'
        : language === 'pt'
          ? 'Guia de uso do sistema'
          : language === 'fr'
            ? 'Guide du système'
            : 'System guide';
  const privacyLabel =
    language === 'he'
      ? 'מדיניות פרטיות'
      : language === 'ru'
        ? 'Политика конфиденциальности'
        : language === 'pt'
          ? 'Política de privacidade'
          : language === 'fr'
            ? 'Politique de confidentialité'
            : 'Privacy policy';
  const articlesLabel =
    language === 'he'
      ? 'מאמרים מקצועיים'
      : language === 'ru'
        ? 'Профессиональные статьи'
        : language === 'pt'
          ? 'Artigos profissionais'
          : language === 'fr'
            ? 'Articles professionnels'
            : 'Professional articles';
  const paypalButtonText =
    language === 'he'
      ? 'תשלום ב‑PayPal'
      : language === 'ru'
        ? 'Оплатить через PayPal'
        : language === 'pt'
          ? 'Pagar com PayPal'
          : language === 'fr'
            ? 'Payer avec PayPal'
            : 'Pay with PayPal';
  const paypalHintText =
    language === 'he'
      ? `אפשרות תשלום ב‑PayPal פעילה (חשבון: ${PAYPAL_BUSINESS_EMAIL})`
      : language === 'ru'
        ? `Оплата через PayPal активна (аккаунт: ${PAYPAL_BUSINESS_EMAIL})`
        : language === 'pt'
          ? `Pagamento via PayPal ativo (conta: ${PAYPAL_BUSINESS_EMAIL})`
          : language === 'fr'
            ? `Paiement PayPal actif (compte : ${PAYPAL_BUSINESS_EMAIL})`
            : `PayPal checkout is active (account: ${PAYPAL_BUSINESS_EMAIL})`;
  const plan1PayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Independent Plan (Monthly)',
    amount: 499,
    currency: 'ILS',
    customId: 'landing_plan1_monthly_ils',
  });
  const plan2PayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Managed Support Plan (Monthly)',
    amount: 999,
    currency: 'ILS',
    customId: 'landing_plan2_monthly_ils',
  });
  const plan3PayPalUrl = createPayPalCheckoutUrl({
    itemName: 'BScale AI - Agencies Plan',
    currency: 'ILS',
    customId: 'landing_plan3_custom_ils',
  });

  React.useEffect(() => {
    if (scrollToPricing) {
      const el = document.getElementById('pricing');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToPricing]);

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
            <h1 className="ui-display text-5xl md:text-6xl lg:text-7xl mb-6">
              {t('landing.heroTitle1')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500">
                {t('landing.heroTitle2')}
              </span>
            </h1>
            <p className="ui-subtitle text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto lg:mx-0">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                  onClick={() => {
                    trackEvent('bscale_enter_app_click', {
                      source: 'landing_hero',
                      page_path: window.location.pathname,
                    });
                    onEnter();
                  }}
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
              </div>
              <div className="p-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={mockChartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -bottom-6 -start-6 bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-xl border border-gray-200 dark:border-white/10 flex items-center gap-4 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <LineChart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('landing.revenueGrowth')}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">+124%</p>
              </div>
            </div>
          </motion.div>
        </main>

        {/* Article/Description Section */}
        <section id="article" className="py-24 bg-white dark:bg-white/5 border-y border-gray-200 dark:border-white/10">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="ui-section-title text-3xl md:text-4xl mb-8 text-gray-900 dark:text-white">{t('landing.articleTitle')}</h2>
            <div className="prose prose-lg ui-body-copy dark:prose-invert mx-auto text-gray-600 dark:text-gray-300 text-start">
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
              <div className="mt-8 p-4 sm:p-5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/40 rounded-2xl">
                <h3 className="ui-section-title text-lg text-indigo-900 dark:text-indigo-200 mb-3">
                  דרישות מערכת וחיבורים מומלצים
                </h3>
                <p className="text-sm mb-3">
                  כדי ליהנות מכל היכולות של BScale AI, מומלץ לחבר את חשבונות הפרסום והאנליטיקה המרכזיים שלך:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Google Ads — ניהול קמפיינים, תקציבים והמרות.</li>
                  <li>Google Search Console — נתוני SEO, מיקומים אורגניים ומונחי חיפוש.</li>
                  <li>Google Analytics 4 — תנועת גולשים והתנהגות באתר.</li>
                  <li>Meta Ads (Facebook / Instagram) — קמפיינים ברשתות חברתיות וקהלים.</li>
                  <li>TikTok Ads — קמפיינים בווידאו וניתוח ביצועים.</li>
                  <li>WooCommerce — חיבור חנות וורדפרס, מוצרים והזמנות.</li>
                  <li>Shopify — חיבור חנות Shopify, קטלוג ומכירות.</li>
                </ul>
              </div>
              <p>
                {t('landing.articleP3')}
              </p>
            </div>
            <div className="mt-10">
               <img 
                 src="https://picsum.photos/seed/dashboard/1200/600" 
                 alt="Dashboard Preview" 
                 className="rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full object-cover"
                 referrerPolicy="no-referrer"
               />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 bg-white dark:bg-white/5 border-y border-gray-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="ui-section-title text-3xl md:text-4xl mb-4 text-gray-900 dark:text-white">{t('landing.pricingTitle')}</h2>
              <p className="ui-subtitle text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.pricingSubtitle')}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-3">{paypalHintText}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative p-8 rounded-2xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.plan1Name')}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t('landing.plan1Desc')}</p>
                <div className="mb-6">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">₪499</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">/חודש</span>
                </div>
                <button
                  onClick={() => {
                    trackEvent('bscale_enter_app_click', {
                      source: 'landing_plan_1',
                      plan: 'independent',
                      page_path: window.location.pathname,
                    });
                    onEnter();
                  }}
                  className="w-full py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('landing.planCtaStart')}
                </button>
                <a
                  href={plan1PayPalUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    trackEvent('bscale_payment_click', {
                      provider: 'paypal',
                      source: 'landing_pricing',
                      plan: 'independent',
                      amount_ils: 499,
                      page_path: window.location.pathname,
                    });
                  }}
                  className="mt-2 block w-full py-3 rounded-xl font-bold text-center border border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba]/10 transition-colors"
                >
                  {paypalButtonText}
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="relative p-8 rounded-2xl border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/10"
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">{t('landing.recommended')}</span>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-200 dark:bg-indigo-500/30 flex items-center justify-center">
                    <Headphones className="w-6 h-6 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.plan2Name')}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t('landing.plan2Desc')}</p>
                <div className="mb-6">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">₪999</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">/חודש</span>
                </div>
                <button
                  onClick={() => {
                    trackEvent('bscale_enter_app_click', {
                      source: 'landing_plan_2',
                      plan: 'managed_support',
                      page_path: window.location.pathname,
                    });
                    onEnter();
                  }}
                  className="w-full py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {t('landing.planCtaStart')}
                </button>
                <a
                  href={plan2PayPalUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    trackEvent('bscale_payment_click', {
                      provider: 'paypal',
                      source: 'landing_pricing',
                      plan: 'managed_support',
                      amount_ils: 999,
                      page_path: window.location.pathname,
                    });
                  }}
                  className="mt-2 block w-full py-3 rounded-xl font-bold text-center border border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba]/10 transition-colors"
                >
                  {paypalButtonText}
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative p-8 rounded-2xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] hover:border-purple-300 dark:hover:border-purple-500/50 transition-all"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.plan3Name')}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t('landing.plan3Desc')}</p>
                <div className="mb-6">
                  <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">{t('landing.plan3Price')}</span>
                </div>
                <a
                  href="mailto:contact@bscale.ai?subject=סוכנות - BScale AI"
                  onClick={() => {
                    trackEvent('bscale_contact_click', {
                      source: 'landing_pricing',
                      plan: 'agency',
                      channel: 'email',
                      page_path: window.location.pathname,
                    });
                  }}
                  className="block w-full py-3 rounded-xl font-bold text-center border-2 border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                >
                  {t('landing.planCtaContact')}
                </a>
                <a
                  href={plan3PayPalUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    trackEvent('bscale_payment_click', {
                      provider: 'paypal',
                      source: 'landing_pricing',
                      plan: 'agency',
                      page_path: window.location.pathname,
                    });
                  }}
                  className="mt-2 block w-full py-3 rounded-xl font-bold text-center border border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba]/10 transition-colors"
                >
                  {paypalButtonText}
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="ui-section-title text-3xl md:text-4xl mb-4 text-gray-900 dark:text-white">{t('landing.featuresTitle')}</h2>
              <p className="ui-subtitle text-gray-600 dark:text-gray-400">{t('landing.featuresSubtitle')}</p>
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
                  <h3 className="ui-section-title text-xl mb-2 text-gray-900 dark:text-white">{feature.title}</h3>
                  <p className="ui-body-copy text-gray-600 dark:text-gray-400 text-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="py-24 bg-gray-50 dark:bg-[#0a0a0a] border-y border-gray-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="ui-section-title text-3xl md:text-4xl mb-4 text-gray-900 dark:text-white">{t('landing.howItWorks')}</h2>
              <p className="ui-subtitle text-gray-600 dark:text-gray-400">{t('landing.howItWorksSub')}</p>
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
                  <h3 className="ui-section-title text-2xl mb-3 text-gray-900 dark:text-white">{step.title}</h3>
                  <p className="ui-body-copy text-gray-600 dark:text-gray-400">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA + Links */}
        <section className="py-24 text-center">
          <div className="max-w-3xl mx-auto px-6 space-y-6">
            <div>
              <h2 className="ui-section-title text-4xl mb-8 text-gray-900 dark:text-white">{t('landing.ready')}</h2>
              <button
                onClick={() => {
                  trackEvent('bscale_enter_app_click', {
                    source: 'landing_footer',
                    page_path: window.location.pathname,
                  });
                  onEnter();
                }}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-gradient-to-r from-indigo-600 to-purple-600 font-pj rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:scale-105 shadow-[0_0_40px_rgba(79,70,229,0.3)] dark:shadow-[0_0_40px_rgba(79,70,229,0.4)]"
              >
                {t('landing.cta')}
                {dir === 'rtl' ? (
                  <ArrowLeft className="w-5 h-5 ms-2 group-hover:-translate-x-1 transition-transform" />
                ) : (
                  <ArrowRight className="w-5 h-5 ms-2 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <a href="/guide" className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                {guideLabel}
              </a>
              <span className="hidden sm:inline">•</span>
              <a href="/articles" className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                {articlesLabel}
              </a>
              <span className="hidden sm:inline">•</span>
              <a href="/privacy-policy" className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                {privacyLabel}
              </a>
            </div>
            <SiteLegalNotice centered compact className="pt-2 text-gray-500 dark:text-gray-400" />
          </div>
        </section>
      </div>
    </div>
  );
}

import React from 'react';
import { Lock, Mail, ArrowRight, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { auth, signOut } from '../lib/firebase';

interface SubscriptionRequiredProps {
  onGoToPricing: () => void;
}

export function SubscriptionRequired({ onGoToPricing }: SubscriptionRequiredProps) {
  const { t, dir } = useLanguage();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6" dir={dir}>
      <div className="fixed top-4 right-4 flex items-center gap-3">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>

      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900 dark:text-white">
          {t('subscription.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {t('subscription.subtitle')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onGoToPricing}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          >
            {t('subscription.ctaPlans')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href="mailto:contact@bscale.ai?subject=בקשת מנוי - BScale AI"
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold border-2 border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <Mail className="w-5 h-5" />
            {t('subscription.ctaContact')}
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('subscription.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

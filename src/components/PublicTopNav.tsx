"use client";

import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import { cn } from '../lib/utils';

const labelsByLang: Record<string, Record<string, string>> = {
  he: {
    home: 'דף הבית',
    articles: 'מאמרים',
    guide: 'מדריך',
    privacy: 'פרטיות',
    login: 'כניסה',
    register: 'הרשמה',
  },
  en: {
    home: 'Home',
    articles: 'Articles',
    guide: 'Guide',
    privacy: 'Privacy',
    login: 'Login',
    register: 'Register',
  },
  ru: {
    home: 'Главная',
    articles: 'Статьи',
    guide: 'Гид',
    privacy: 'Конфиденциальность',
    login: 'Вход',
    register: 'Регистрация',
  },
  pt: {
    home: 'Inicio',
    articles: 'Artigos',
    guide: 'Guia',
    privacy: 'Privacidade',
    login: 'Entrar',
    register: 'Registrar',
  },
  fr: {
    home: 'Accueil',
    articles: 'Articles',
    guide: 'Guide',
    privacy: 'Confidentialite',
    login: 'Connexion',
    register: 'Inscription',
  },
};

export function PublicTopNav() {
  const { language, dir, t } = useLanguage();
  const labels = labelsByLang[language] ?? labelsByLang.he;
  const currentPath =
    (typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '') || '/';

  const links = [
    { href: '/', label: labels.home },
    { href: '/articles', label: labels.articles },
    { href: '/guide', label: labels.guide },
    { href: '/privacy-policy', label: labels.privacy },
  ];

  return (
    <header
      className="sticky top-0 z-[140] border-b border-gray-200/80 dark:border-white/10 bg-white/90 dark:bg-[#050505]/90 backdrop-blur"
      dir={dir}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-2 shrink-0">
            <BrainCircuit className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
            <span className="text-base sm:text-lg font-black tracking-tight text-gray-900 dark:text-white">
              {t('app.name')}
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-2">
            {links.map((link) => {
              const isActive = currentPath === (link.href === '/' ? '/' : link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10'
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0 ms-auto md:ms-0">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <a
              href="/auth"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white border border-gray-200 dark:border-white/15"
            >
              {labels.login}
            </a>
            <a
              href="/auth?mode=register"
              className="inline-flex px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {labels.register}
            </a>
          </div>
        </div>
        <nav className="md:hidden mt-2 flex items-center gap-2 overflow-x-auto pb-1">
          {links.map((link) => {
            const isActive = currentPath === (link.href === '/' ? '/' : link.href);
            return (
              <a
                key={`mobile-${link.href}`}
                href={link.href}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10'
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

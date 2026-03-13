import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

export type Language = 'en' | 'he' | 'ru' | 'pt' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const STORAGE_KEY = 'bscale_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('he');

  useEffect(() => {
    const supportedLanguages: Language[] = ['en', 'he', 'ru', 'pt', 'fr'];
    try {
      const savedLanguage = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
        setLanguage(savedLanguage);
        return;
      }
    } catch {
      // ignore
    }
    const browserLang = navigator.language.split('-')[0];
    if (supportedLanguages.includes(browserLang as Language)) {
      setLanguage(browserLang as Language);
    } else {
      setLanguage('en');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const t = (key: string) => {
    const keys = key.split('.');
    const resolveFromLanguage = (lang: Language): string | null => {
      const langTranslations = translations[lang as keyof typeof translations];
      if (!langTranslations) return null;
      let value: any = langTranslations;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return null;
        }
      }
      return typeof value === 'string' ? value : null;
    };

    const direct = resolveFromLanguage(language);
    if (direct) return direct;
    const fallbackEn = resolveFromLanguage('en');
    if (fallbackEn) return fallbackEn;
    const fallbackHe = resolveFromLanguage('he');
    if (fallbackHe) return fallbackHe;
    return key;
  };

  const dir = language === 'he' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  console.log('LanguageProvider is rendering');
  const [language, setLanguage] = useState<Language>('he');

  useEffect(() => {
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages: Language[] = ['en', 'he', 'ru', 'pt', 'fr'];
    if (supportedLanguages.includes(browserLang as Language)) {
      setLanguage(browserLang as Language);
    } else {
      setLanguage('en');
    }
  }, []);

  const t = (key: string) => {
    const keys = key.split('.');
    const currentTranslations = translations[language as keyof typeof translations];
    if (!currentTranslations) return key;
    
    let value: any = currentTranslations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // fallback
      }
    }
    return typeof value === 'string' ? value : key;
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

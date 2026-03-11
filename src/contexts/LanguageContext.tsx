import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

export type Language = 'en' | 'he' | 'ru' | 'pt' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
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

  const resolveKey = (lang: Language, key: string): string | undefined => {
    const keys = key.split('.');
    const currentTranslations = translations[lang as keyof typeof translations];
    if (!currentTranslations) return undefined;
    
    let value: any = currentTranslations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    return typeof value === 'string' ? value : undefined;
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const template = resolveKey(language, key) ?? resolveKey('en', key) ?? key;
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (_, token: string) => {
      const value = params[token];
      return value === undefined || value === null ? `{${token}}` : String(value);
    });
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

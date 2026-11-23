import React, { createContext, useContext, useState, useEffect } from 'react';
import hi from './hi.json';
import en from './en.json';
import chh from './chh.json';

export type Language = 'hi' | 'en' | 'chh';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string) => string;
  isHindi: boolean;
  isChh: boolean;
  isIndic: boolean;
  pick: (hiText: string, enText: string, chhText?: string) => string;
}

const translations: Record<Language, any> = {
  hi,
  en,
  chh,
};

const I18nContext = createContext<I18nContextType>({
  language: 'hi',
  setLanguage: () => { },
  t: (key: string) => key,
  isHindi: true,
  isChh: false,
  isIndic: true,
  pick: (hiText: string) => hiText,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('agri_lang');
    return (saved === 'en' || saved === 'hi' || saved === 'chh') ? saved : 'hi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('agri_lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'hi';
  };

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'hi';
  }, [language]);

  const t = (keyPath: string): string => {
    const keys = keyPath.split('.');
    let current = translations[language] || translations.hi;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to Hindi
        let fallback = translations.hi;
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return keyPath;
          }
        }
        return typeof fallback === 'string' ? fallback : keyPath;
      }
    }
    return typeof current === 'string' ? current : keyPath;
  };

  const isHindi = language === 'hi';
  const isChh = language === 'chh';
  const isIndic = language !== 'en';

  const pick = (hiText: string, enText: string, chhText?: string): string => {
    if (language === 'chh') {
      return chhText || hiText;
    }
    if (language === 'hi') {
      return hiText;
    }
    return enText;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isHindi, isChh, isIndic, pick }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);


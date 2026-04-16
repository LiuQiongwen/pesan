import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type Lang, translate } from '@/i18n';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem('pesta_lang') ?? localStorage.getItem('pesan_lang');
      return (stored === 'en' || stored === 'zh') ? stored : 'zh';
    } catch {
      return 'zh';
    }
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('pesta_lang', l);
      localStorage.removeItem('pesan_lang');
    } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

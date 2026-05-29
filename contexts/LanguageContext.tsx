"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "he" | "ar";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (obj: { he: string; ar: string }) => string;
}

const LangContext = createContext<LangCtx>({
  lang: "he",
  setLang: () => {},
  t: (obj) => obj.he,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("he");

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t: (obj) => obj[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

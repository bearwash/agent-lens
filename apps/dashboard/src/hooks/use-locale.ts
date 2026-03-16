"use client";

import { useState, useCallback, useEffect } from "react";
import { type Locale, type TranslationKey, t, detectLocale } from "@/lib/i18n";

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("agent-lens-locale") as Locale | null;
    setLocaleState(saved ?? detectLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("agent-lens-locale", l);
  }, []);

  const tt = useCallback(
    (key: TranslationKey) => t(key, locale),
    [locale],
  );

  return { locale, setLocale, t: tt };
}

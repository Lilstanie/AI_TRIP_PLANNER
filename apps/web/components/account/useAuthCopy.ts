"use client";

import { useEffect, useState } from "react";
import { browserLocale, intlLocale, type AppLocale } from "@/lib/i18n/locale";
import { enAuth } from "@/lib/i18n/messages/en-auth";
import { zhAuth } from "@/lib/i18n/messages/zh-auth";
import { readLocalSettings } from "./SettingsProvider";

const AUTH_COPY: Record<AppLocale, typeof enAuth> = { en: enAuth, zh: zhAuth };

export function useAuthCopy(): typeof enAuth {
  const [locale, setLocale] = useState<AppLocale>("en");
  useEffect(() => {
    const chosen =
      readLocalSettings().language ?? browserLocale(navigator.languages ?? [navigator.language]);
    setLocale(chosen);
    document.documentElement.lang = intlLocale(chosen);
  }, []);
  return AUTH_COPY[locale];
}

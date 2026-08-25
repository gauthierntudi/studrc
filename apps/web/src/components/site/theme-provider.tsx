"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isSiteTheme,
  persistSiteTheme,
  SITE_THEME_KEY,
  type SiteTheme,
} from "@/lib/site-theme";

type ThemeContextValue = {
  theme: SiteTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function themeFromDom(): SiteTheme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialTheme?: SiteTheme;
}) {
  const [theme, setTheme] = useState<SiteTheme>(initialTheme);

  useEffect(() => {
    const stored = window.localStorage.getItem(SITE_THEME_KEY);
    const initial: SiteTheme = isSiteTheme(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : themeFromDom();
    persistSiteTheme(initial);
    setTheme(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (isSiteTheme(window.localStorage.getItem(SITE_THEME_KEY))) return;
      const next: SiteTheme = mq.matches ? "dark" : "light";
      persistSiteTheme(next);
      setTheme(next);
    };
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: SiteTheme = themeFromDom() === "dark" ? "light" : "dark";
    persistSiteTheme(next);
    setTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useSiteTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useSiteTheme must be used within ThemeProvider");
  }
  return ctx;
}

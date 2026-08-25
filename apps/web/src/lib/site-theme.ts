export type SiteTheme = "light" | "dark";

export const SITE_THEME_KEY = "studrc-site-theme";

export function isSiteTheme(value: string | null | undefined): value is SiteTheme {
  return value === "light" || value === "dark";
}

export function applySiteTheme(theme: SiteTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function persistSiteTheme(theme: SiteTheme) {
  applySiteTheme(theme);
  try {
    window.localStorage.setItem(SITE_THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  document.cookie = `${SITE_THEME_KEY}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

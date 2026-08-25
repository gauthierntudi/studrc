import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import { preconnect } from "react-dom";
import { Providers } from "@/components/providers";
import { BRAND, BRAND_META_DESCRIPTION } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { isSiteTheme, SITE_THEME_KEY } from "@/lib/site-theme";
import "./globals.css";

/** Corps / UI — sans moderne, lisible presse digitale */
const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-opt-sans",
  display: "swap",
});

/** Titres / display — sans éditoriale un peu plus marquée */
const fontDisplay = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-opt-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND_META_DESCRIPTION,
  icons: {
    icon: [
      { url: BRAND.icon, type: "image/png", sizes: "512x512" },
    ],
    apple: BRAND.icon,
    shortcut: BRAND.icon,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND_META_DESCRIPTION,
    images: [
      {
        url: BRAND.icon,
        width: 512,
        height: 512,
        alt: BRAND.name,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: BRAND.name,
    description: BRAND_META_DESCRIPTION,
    images: [BRAND.icon],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preconnect("https://cdn.studrc.com", { crossOrigin: "anonymous" });
  const raw = (await cookies()).get(SITE_THEME_KEY)?.value;
  const theme = isSiteTheme(raw) ? raw : "light";

  return (
    <html
      lang="fr"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body className={fontSans.className} suppressHydrationWarning>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}

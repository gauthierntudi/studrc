import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND, BRAND_META_DESCRIPTION } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className={fontSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

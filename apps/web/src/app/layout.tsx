import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
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
    default: "Opt1mum",
    template: "%s · Opt1mum",
  },
  description: "Magazine Opt1mum — kiosque et abonnements",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/legacy/img/icon-flat.jpg", type: "image/jpeg", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Opt1mum",
    title: "Opt1mum",
    description: "Magazine Opt1mum — kiosque et abonnements",
    images: [
      {
        url: "/legacy/img/icon-flat.jpg",
        width: 512,
        height: 512,
        alt: "Opt1mum",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Opt1mum",
    description: "Magazine Opt1mum — kiosque et abonnements",
    images: ["/legacy/img/icon-flat.jpg"],
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

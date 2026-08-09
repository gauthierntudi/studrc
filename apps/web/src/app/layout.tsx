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
  icons: { icon: "/legacy/img/logo-hd.png" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Opt1mum",
    title: "Opt1mum",
    description: "Magazine Opt1mum — kiosque et abonnements",
  },
  twitter: {
    card: "summary_large_image",
    title: "Opt1mum",
    description: "Magazine Opt1mum — kiosque et abonnements",
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

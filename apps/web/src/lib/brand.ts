/** Identité publique STUDRC — source unique pour le site, l’admin et les e-mails. */

export const BRAND = {
  name: "STUDRC",
  legalName: "STUDRC",
  tagline:
    "La plateforme média et observatoire qui éclaire le système éducatif de la République Démocratique du Congo.",
  taglineShort:
    "Information, données, histoires et voix de ceux qui transforment l’école chaque jour.",
  description:
    "STUDRC éclaire le système éducatif de la RDC à travers l’information, les données, les histoires et les voix de ceux qui transforment l’école chaque jour.",
  domain: "studrc.com",
  siteUrl: "https://studrc.com",
  email: "contact@studrc.com",
  infoEmail: "info@studrc.com",
  phone: "+243 813 212 772",
  address: "8 Avenue Kalemie, Kinshasa-Gombe",
  logo: "/brand/studrc-logo.png",
  icon: "/brand/flaticon.png",
  colors: {
    blue: "#0565ab",
    red: "#d63026",
    gold: "#fdbd01",
    navy: "#00132b",
  },
} as const;

export const BRAND_META_DESCRIPTION = BRAND.description;

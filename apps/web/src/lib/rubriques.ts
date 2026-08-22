export type RubriqueTone = "red" | "blue" | "gold" | "teal" | "dark";

export type Rubrique = {
  slug: string;
  href: string;
  label: string;
  blurb: string;
  tone: RubriqueTone;
};

/** Cinq rubriques STUDRC — navigation, admin et filtres. */
export const RUBRIQUES: readonly Rubrique[] = [
  {
    slug: "stu-news",
    href: "/rubrique/stu-news",
    label: "STU NEWS",
    blurb:
      "L’actualité éducative en continu : réformes, politiques, initiatives, événements.",
    tone: "red",
  },
  {
    slug: "stu-data",
    href: "/rubrique/stu-data",
    label: "STU DATA",
    blurb:
      "Données, statistiques, cartographies et analyses pour comprendre et décider.",
    tone: "blue",
  },
  {
    slug: "stu-stories",
    href: "/rubrique/stu-stories",
    label: "STU STORIES",
    blurb:
      "Des visages, des parcours, des écoles et des initiatives qui inspirent.",
    tone: "gold",
  },
  {
    slug: "stu-talk",
    href: "/rubrique/stu-talk",
    label: "STU TALK",
    blurb:
      "Podcasts, interviews, débats et paroles d’experts sur les enjeux éducatifs.",
    tone: "teal",
  },
  {
    slug: "stu-mag",
    href: "/kiosque",
    label: "STU MAG",
    blurb:
      "Le magazine numérique bimestriel pour des analyses approfondies.",
    tone: "dark",
  },
] as const;

export const RUBRIQUE_BY_SLUG = Object.fromEntries(
  RUBRIQUES.map((r) => [r.slug, r]),
) as Record<string, Rubrique>;

export const ARTICLE_CATEGORY_OPTIONS = [
  ...RUBRIQUES.map((r) => ({ value: r.slug, label: r.label })),
] as const;

export const CATEGORY_BLURB: Record<string, string> = Object.fromEntries(
  RUBRIQUES.map((r) => [r.slug, r.blurb]),
);

export const SEARCH_FILTERS = [
  { slug: "", label: "Toutes" },
  ...RUBRIQUES.map((r) => ({ slug: r.slug, label: r.label })),
] as const;

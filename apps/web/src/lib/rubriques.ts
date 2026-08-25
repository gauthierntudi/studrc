export type RubriqueTone = "red" | "blue" | "gold" | "teal" | "dark";

export type Rubrique = {
  slug: string;
  href: string;
  label: string;
  blurb: string;
  tone: RubriqueTone;
  /** Miniatures + page rubrique au format vidéo. */
  format?: "article" | "video";
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
    format: "video",
  },
  {
    slug: "stu-talk",
    href: "/rubrique/stu-talk",
    label: "STU TALK",
    blurb:
      "Interviews, débats et paroles d’experts en vidéo — les voix qui font l’école.",
    tone: "teal",
    format: "video",
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

const VIDEO_KEYS = new Set(
  RUBRIQUES.filter((r) => r.format === "video").flatMap((r) => [
    r.slug,
    r.label.toLowerCase(),
  ]),
);

/** Anciennes rubriques Opt1mum encore présentes en base / démo. */
const VIDEO_ALIASES = new Set([
  "inspirationnel",
  "game-changers",
  "game-changer",
  "grandes-entrevues",
  "grande-entrevue",
  "entrevue-croisee",
]);

const STORIES_KEYS = new Set([
  "stu-stories",
  "stu stories",
  "inspirationnel",
]);

/** STU TALK / STU STORIES (et leurs alias) — miniatures au format vidéo. */
export function isVideoRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    const key = value.trim().toLowerCase();
    return VIDEO_KEYS.has(key) || VIDEO_ALIASES.has(key);
  });
}

/** STU STORIES — pastille or, lecteur 16:9. */
export function isStoriesRubrique(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => {
    if (!value) return false;
    return STORIES_KEYS.has(value.trim().toLowerCase());
  });
}

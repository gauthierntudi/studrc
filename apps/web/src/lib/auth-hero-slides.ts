/** Pool d’images / copy — login abonné + admin (fenêtre de 3, rotation à chaque cycle). */
export const AUTH_HERO_POOL = [
  {
    cover: "/legacy/img/slide01.jpg",
    title: "Éclairer l’école congolaise",
    lead: "Information, données, histoires et voix de ceux qui transforment l’école chaque jour.",
  },
  {
    cover: "/legacy/img/slide02.jpg",
    title: "STU MAG, partout",
    lead: "Le magazine numérique bimestriel, à lire sur tous vos écrans.",
  },
  {
    cover: "/legacy/img/slide03.jpg",
    title: "L’actualité éducative en continu",
    lead: "Réformes, politiques, initiatives et événements — STU NEWS.",
  },
  {
    cover: "/legacy/img/slide04.jpg",
    title: "Des voix qui comptent",
    lead: "Podcasts, interviews et débats d’experts — STU TALK.",
  },
  {
    cover: "/legacy/img/slide05.jpg",
    title: "Comprendre pour décider",
    lead: "Données, statistiques et cartographies — STU DATA.",
  },
  {
    cover: "/legacy/img/slide06.jpg",
    title: "Des écoles qui inspirent",
    lead: "Visages, parcours et initiatives — STU STORIES.",
  },
  {
    cover: "/legacy/img/slide07.jpg",
    title: "L’observatoire de l’éducation",
    lead: "Un regard lucide sur le système éducatif de la RDC.",
  },
  {
    cover: "/legacy/img/slide08.jpg",
    title: "Analyses approfondies",
    lead: "STU MAG : le magazine bimestriel pour aller plus loin.",
  },
  {
    cover: "/legacy/img/slide09.jpg",
    title: "Rejoindre STUDRC",
    lead: "Accédez aux numéros, aux articles et aux contenus exclusifs.",
  },
  {
    cover: "/legacy/img/slide010.jpg",
    title: "Au plus près du terrain",
    lead: "Les acteurs qui transforment l’école, chaque jour.",
  },
  {
    cover: "/legacy/img/slide011.jpg",
    title: "Restez connectés",
    lead: "Actualités, données et récits — où que vous soyez.",
  },
] as const;

export type AuthHeroSlide = (typeof AUTH_HERO_POOL)[number];

/** Nombre de slides visibles dans le diaporama. */
export const AUTH_HERO_VISIBLE = 3;

/** Fenêtre de `count` slides à partir de `offset` (boucle sur le pool). */
export function heroWindow(
  offset: number,
  count = AUTH_HERO_VISIBLE,
): AuthHeroSlide[] {
  const n = AUTH_HERO_POOL.length as number;
  const start = ((offset % n) + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => {
    return AUTH_HERO_POOL[(start + i) % n]!;
  });
}

/** Prochain offset après un cycle complet des 3 slides. */
export function nextHeroOffset(offset: number): number {
  const n = AUTH_HERO_POOL.length as number;
  return (offset + AUTH_HERO_VISIBLE) % n;
}

/** Offset précédent (navigation manuelle). */
export function prevHeroOffset(offset: number): number {
  const n = AUTH_HERO_POOL.length as number;
  return (offset - AUTH_HERO_VISIBLE + n * 10) % n;
}

/** @deprecated utiliser AUTH_HERO_POOL + heroWindow */
export const AUTH_HERO_SLIDES = AUTH_HERO_POOL;

/** Pool d’images / copy — login abonné + admin (fenêtre de 3, rotation à chaque cycle). */
export const AUTH_HERO_POOL = [
  {
    cover: "/legacy/img/slide01.jpg",
    title: "Le regard des décideurs",
    lead: "Analyses, entrevues et dossiers pour rester en avance.",
  },
  {
    cover: "/legacy/img/slide02.jpg",
    title: "Votre kiosque, partout",
    lead: "Lisez Opt1mum en temps réel, sur tous vos écrans.",
  },
  {
    cover: "/legacy/img/slide03.jpg",
    title: "L’essentiel du marché",
    lead: "Start-up, zoom et game changers — chaque semaine.",
  },
  {
    cover: "/legacy/img/slide04.jpg",
    title: "Des voix qui comptent",
    lead: "Grandes entrevues et portraits exclusifs.",
  },
  {
    cover: "/legacy/img/slide05.jpg",
    title: "Décrypter l’actualité",
    lead: "Clarté et profondeur sur les enjeux qui façonnent demain.",
  },
  {
    cover: "/legacy/img/slide06.jpg",
    title: "Inspiration & leadership",
    lead: "Parcours, stratégies et idées pour agir.",
  },
  {
    cover: "/legacy/img/slide07.jpg",
    title: "L’Afrique en mouvement",
    lead: "Business, innovation et société au plus près du terrain.",
  },
  {
    cover: "/legacy/img/slide08.jpg",
    title: "Un magazine premium",
    lead: "Une expérience de lecture soignée, du papier au digital.",
  },
  {
    cover: "/legacy/img/slide09.jpg",
    title: "Abonnez-vous à Opt1mum",
    lead: "Accédez à tous les numéros et aux contenus exclusifs.",
  },
  {
    cover: "/legacy/img/slide010.jpg",
    title: "Au cœur des décisions",
    lead: "Ce que les leaders lisent pour anticiper.",
  },
  {
    cover: "/legacy/img/slide011.jpg",
    title: "Restez connectés",
    lead: "Actualités, dossiers et analyses — où que vous soyez.",
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
  const n = AUTH_HERO_POOL.length;
  if (n === 0) return [];
  const start = ((offset % n) + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => {
    return AUTH_HERO_POOL[(start + i) % n]!;
  });
}

/** Prochain offset après un cycle complet des 3 slides. */
export function nextHeroOffset(offset: number): number {
  const n = AUTH_HERO_POOL.length;
  if (n === 0) return 0;
  return (offset + AUTH_HERO_VISIBLE) % n;
}

/** Offset précédent (navigation manuelle). */
export function prevHeroOffset(offset: number): number {
  const n = AUTH_HERO_POOL.length;
  if (n === 0) return 0;
  return (offset - AUTH_HERO_VISIBLE + n * 10) % n;
}

/** @deprecated utiliser AUTH_HERO_POOL + heroWindow */
export const AUTH_HERO_SLIDES = AUTH_HERO_POOL;

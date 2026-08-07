/** Contenu démo — articles homepage (en attendant l’API). */

export type TopStory = {
  id: string | number;
  slug?: string;
  titre: string;
  excerpt?: string;
  cover: string;
  category: string;
  categoryTone: "red" | "blue" | "teal" | "dark" | "gold";
  author: string;
  dateLabel: string;
  featured?: boolean;
};

export type DemoMagazine = {
  id: number;
  titre: string;
  numero: string;
  cover: string;
  price: string;
  bgColor: string;
  themeColor: string;
  dateLabel: string;
  sommaire: { label: string; puce: string; text: string }[];
};

export const DEMO_FEATURED: TopStory[] = [
  {
    id: 1,
    titre:
      "Leadership et transformation digitale : les nouvelles routes du pouvoir en Afrique centrale",
    excerpt:
      "Face aux mutations économiques et technologiques, les décideurs redessinent leurs stratégies. Enquête sur les acteurs qui imposent le tempo.",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Grandes entrevues",
    categoryTone: "blue",
    author: "Opt1mum",
    dateLabel: "24 juil. 2026",
    featured: true,
  },
  {
    id: 10,
    titre:
      "Start-up : comment scaler un produit fintech au Congo sans perdre le cap",
    excerpt:
      "Levées de fonds, régulation et talent : le parcours d’une génération d’entrepreneurs qui mise sur le mobile money et les API ouvertes.",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Start-up",
    categoryTone: "teal",
    author: "Opt1mum",
    dateLabel: "23 juil. 2026",
    featured: true,
  },
  {
    id: 11,
    titre:
      "Zoom : l’écosystème entrepreneurial de Kinshasa entre ambition et friction",
    excerpt:
      "Incubateurs, banques et opérateurs se disputent le terrain. Ce que révèlent les derniers mois de mutations du marché.",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Zoom",
    categoryTone: "dark",
    author: "Opt1mum",
    dateLabel: "22 juil. 2026",
    featured: true,
  },
];

export const DEMO_TOP_GRID: TopStory[] = [
  {
    id: 2,
    titre: "Décryptage : les nouvelles routes du commerce régional",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Décryptage",
    categoryTone: "teal",
    author: "Opt1mum",
    dateLabel: "24 juil. 2026",
  },
  {
    id: 3,
    titre: "Entrevue croisée : finance et innovation à Kinshasa",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Entrevue croisée",
    categoryTone: "gold",
    author: "Opt1mum",
    dateLabel: "23 juil. 2026",
  },
  {
    id: 4,
    titre: "Zoom sur l’écosystème startup congolais",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Zoom",
    categoryTone: "dark",
    author: "Opt1mum",
    dateLabel: "22 juil. 2026",
  },
  {
    id: 5,
    titre: "Inspirationnel : parcours d’un top manager",
    cover: "/legacy/articles/1591545644.png",
    category: "Inspirationnel",
    categoryTone: "red",
    author: "Opt1mum",
    dateLabel: "21 juil. 2026",
  },
];

export const DEMO_BREAKING = [...DEMO_FEATURED, ...DEMO_TOP_GRID.slice(0, 2)];

export const DEMO_MAGAZINES: DemoMagazine[] = [
  {
    id: 1,
    titre: "Opt1mum #42",
    numero: "42",
    cover: "/legacy/covers/1591457791.jpg",
    price: "5",
    bgColor: "#0d203d",
    themeColor: "#02d0d1",
    dateLabel: "juil. 2024",
    sommaire: [
      {
        label: "GRANDES ENTREVUES",
        puce: "/legacy/img/puce1.png",
        text: "Portrait exclusif",
      },
      {
        label: "DECRYPTAGE",
        puce: "/legacy/img/puce2.png",
        text: "Économie & marchés",
      },
      {
        label: "ENTREVUE CROISÉE",
        puce: "/legacy/img/puce3.png",
        text: "Deux visions, un débat",
      },
      {
        label: "ZOOM",
        puce: "/legacy/img/puce4.png",
        text: "Focus secteur",
      },
    ],
  },
  {
    id: 2,
    titre: "Opt1mum #41",
    numero: "41",
    cover: "/legacy/covers/1592973573.jpg",
    price: "5",
    bgColor: "#021762",
    themeColor: "#ffffff",
    dateLabel: "juin 2024",
    sommaire: [],
  },
  {
    id: 3,
    titre: "Opt1mum #40",
    numero: "40",
    cover: "/legacy/covers/1592973638.jpg",
    price: "5",
    bgColor: "#037d95",
    themeColor: "#fcbf04",
    dateLabel: "mai 2024",
    sommaire: [],
  },
  {
    id: 4,
    titre: "Opt1mum #39",
    numero: "39",
    cover: "/legacy/covers/1592975124.jpg",
    price: "5",
    bgColor: "#050a23",
    themeColor: "#02d0d1",
    dateLabel: "avr. 2024",
    sommaire: [],
  },
  {
    id: 5,
    titre: "Opt1mum #38",
    numero: "38",
    cover: "/legacy/covers/1592975318.jpg",
    price: "5",
    bgColor: "#0d203d",
    themeColor: "#fcbf04",
    dateLabel: "mars 2024",
    sommaire: [],
  },
  {
    id: 6,
    titre: "Opt1mum #37",
    numero: "37",
    cover: "/legacy/covers/1592975407.jpg",
    price: "5",
    bgColor: "#021762",
    themeColor: "#02d0d1",
    dateLabel: "févr. 2024",
    sommaire: [],
  },
];

export const DEMO_PLAN = {
  price: "120",
  description:
    "Accès illimité à tous les numéros digitaux pendant 12 mois.",
  name: "Annuel",
};

/** Décryptages (après kiosque — une seule catégorie, cat. 3 legacy) */
export type DossierCard = {
  id: string | number;
  slug?: string;
  titre: string;
  cover: string;
};

export const DEMO_DOSSIERS: DossierCard[] = [
  {
    id: 21,
    titre: "Leadership et transformation digitale en Afrique centrale",
    cover: "/legacy/articles/1591543587.jpg",
  },
  {
    id: 22,
    titre: "Les nouvelles routes du commerce régional",
    cover: "/legacy/articles/1591543622.jpg",
  },
  {
    id: 23,
    titre: "L’écosystème startup de Kinshasa sous tension",
    cover: "/legacy/articles/1591545854.jpg",
  },
  {
    id: 24,
    titre: "Finance et innovation : ce que change le mobile money",
    cover: "/legacy/articles/1591543645.jpg",
  },
  {
    id: 25,
    titre: "Capital privé : les mouvements qui redessinent le marché",
    cover: "/legacy/articles/1591545644.png",
  },
];

/** Fil info (actualités rapides) */
export const DEMO_FIL_INFO = [
  {
    id: 31,
    titre:
      "Start-up : scaler un produit fintech au Congo sans perdre le cap stratégique",
  },
  {
    id: 32,
    titre:
      "Entrevue croisée : finance et innovation, deux visions pour Kinshasa",
  },
  {
    id: 33,
    titre: "Inspirationnel : le parcours d’un top manager qui change la donne",
  },
  {
    id: 34,
    titre: "Game changers : les acteurs qui redessinent le marché régional",
  },
  {
    id: 35,
    titre:
      "Décryptage : ce que révèlent les derniers mouvements du capital privé",
  },
];

/** Start-up (après fil info — cat. 6 legacy) */
export type RubriqueStory = {
  id: string | number;
  slug?: string;
  titre: string;
  cover: string;
  category: string;
  author: string;
  dateLabel: string;
  tagTone?: "red" | "blue" | "teal" | "dark" | "gold" | "orange" | "yellow";
};

export const DEMO_STARTUP_FEATURED: RubriqueStory = {
  id: 41,
  titre:
    "Start-up : comment scaler un produit fintech au Congo sans perdre le cap",
  cover: "/legacy/articles/1591543622.jpg",
  category: "Start-up",
  author: "Opt1mum",
  dateLabel: "18 juil. 2026",
  tagTone: "teal",
};

export const DEMO_STARTUP_GRID: RubriqueStory[] = [
  {
    id: 42,
    titre: "Incubateurs à Kinshasa : qui tire vraiment le marché ?",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Start-up",
    author: "Opt1mum",
    dateLabel: "16 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 43,
    titre: "API ouvertes et mobile money : la nouvelle bataille des opérateurs",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Start-up",
    author: "Opt1mum",
    dateLabel: "14 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 44,
    titre: "Levées de fonds : ce que révèlent les derniers tours régionaux",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Start-up",
    author: "Opt1mum",
    dateLabel: "12 juil. 2026",
    tagTone: "teal",
  },
  {
    id: 45,
    titre: "Talents tech : comment retenir les profils qui partent",
    cover: "/legacy/articles/1591545644.png",
    category: "Start-up",
    author: "Opt1mum",
    dateLabel: "10 juil. 2026",
    tagTone: "teal",
  },
];

/** Les plus vus (sidebar) */
export const DEMO_PLUS_VUS_FEATURED: RubriqueStory = {
  id: 51,
  titre:
    "Leadership et transformation digitale : les nouvelles routes du pouvoir",
  cover: "/legacy/articles/1591543587.jpg",
  category: "Entrevue",
  author: "Opt1mum",
  dateLabel: "18 juil. 2026",
  tagTone: "blue",
};

export const DEMO_PLUS_VUS_LIST: RubriqueStory[] = [
  {
    id: 52,
    titre: "Décryptage : les nouvelles routes du commerce régional",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Décryptage",
    author: "Opt1mum",
    dateLabel: "2 juil. 2026",
  },
  {
    id: 53,
    titre: "Zoom : l’écosystème entrepreneurial sous tension à Kinshasa",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Zoom",
    author: "Opt1mum",
    dateLabel: "28 juin 2026",
  },
];

/** Inspirationnel — featured split + grille 3 (après Start-up) */
export type RubriqueSplitStory = RubriqueStory & {
  excerpt?: string;
};

export const DEMO_INSPIRATIONNEL_FEATURED: RubriqueSplitStory = {
  id: 61,
  titre:
    "Inspirationnel : le parcours d’un top manager qui change la donne à Kinshasa",
  excerpt:
    "De la salle de réunion aux terrains d’innovation, un leadership qui inspire une génération d’entrepreneurs congolais…",
  cover: "/legacy/articles/1591545644.png",
  category: "Inspirationnel",
  author: "Opt1mum",
  dateLabel: "21 juil. 2026",
  tagTone: "red",
};

export const DEMO_INSPIRATIONNEL_GRID: RubriqueSplitStory[] = [
  {
    id: 62,
    titre:
      "Game changers : les acteurs qui redessinent le marché régional",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Inspirationnel",
    author: "Opt1mum",
    dateLabel: "21 juil. 2026",
    tagTone: "red",
  },
  {
    id: 63,
    titre: "Entrevue croisée : finance et innovation, deux visions pour Kinshasa",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Inspirationnel",
    author: "Opt1mum",
    dateLabel: "20 juil. 2026",
    tagTone: "red",
  },
  {
    id: 64,
    titre:
      "Leadership : comment transformer une organisation sans perdre ses équipes",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Inspirationnel",
    author: "Opt1mum",
    dateLabel: "18 juil. 2026",
    tagTone: "red",
  },
];

/** Zoom (après newsletter — layout featured + grille 2×2) */
export const DEMO_ZOOM_FEATURED: RubriqueStory = {
  id: 71,
  titre: "Zoom : l’écosystème entrepreneurial sous tension à Kinshasa",
  cover: "/legacy/articles/1591545854.jpg",
  category: "Zoom",
  author: "Opt1mum",
  dateLabel: "19 juil. 2026",
  tagTone: "dark",
};

export const DEMO_ZOOM_GRID: RubriqueStory[] = [
  {
    id: 72,
    titre: "Zoom industrie : ce que changent les nouvelles zones économiques",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Zoom",
    author: "Opt1mum",
    dateLabel: "17 juil. 2026",
    tagTone: "dark",
  },
  {
    id: 73,
    titre: "Zoom retail : la bataille des enseignes pour le client digital",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Zoom",
    author: "Opt1mum",
    dateLabel: "15 juil. 2026",
    tagTone: "dark",
  },
  {
    id: 74,
    titre: "Zoom énergie : les opérateurs face à la demande urbaine",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Zoom",
    author: "Opt1mum",
    dateLabel: "13 juil. 2026",
    tagTone: "dark",
  },
  {
    id: 75,
    titre: "Zoom logistique : corridors et délais, le vrai coût du commerce",
    cover: "/legacy/articles/1591545644.png",
    category: "Zoom",
    author: "Opt1mum",
    dateLabel: "11 juil. 2026",
    tagTone: "dark",
  },
];

/** Game Changers (sous Zoom — layout split) */
export const DEMO_GAME_FEATURED: RubriqueSplitStory = {
  id: 81,
  titre: "Game changers : les acteurs qui redessinent le marché régional",
  excerpt:
    "Portraits et trajectoires de ceux qui imposent un nouveau tempo à l’économie congolaise…",
  cover: "/legacy/articles/1591543587.jpg",
  category: "Game changers",
  author: "Opt1mum",
  dateLabel: "20 juil. 2026",
  tagTone: "gold",
};

export const DEMO_GAME_GRID: RubriqueSplitStory[] = [
  {
    id: 82,
    titre: "Celle qui a digitalisé une chaîne d’approvisionnement entière",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Game changers",
    author: "Opt1mum",
    dateLabel: "18 juil. 2026",
    tagTone: "gold",
  },
  {
    id: 83,
    titre: "Le fonds qui misé tôt sur les scale-ups d’Afrique centrale",
    cover: "/legacy/articles/1591543645.jpg",
    category: "Game changers",
    author: "Opt1mum",
    dateLabel: "16 juil. 2026",
    tagTone: "gold",
  },
  {
    id: 84,
    titre: "Une marque locale devenue référence continentale",
    cover: "/legacy/articles/1591545854.jpg",
    category: "Game changers",
    author: "Opt1mum",
    dateLabel: "14 juil. 2026",
    tagTone: "gold",
  },
];

/** Sidebar block 2 — À ne pas manquer */
export const DEMO_A_NE_PAS_MANQUER_FEATURED: RubriqueStory = {
  id: 91,
  titre: "Grandes entrevues : vision d’un dirigeant sur la décennie à venir",
  cover: "/legacy/articles/1591545644.png",
  category: "Entrevue",
  author: "Opt1mum",
  dateLabel: "22 juil. 2026",
  tagTone: "blue",
};

export const DEMO_A_NE_PAS_MANQUER_LIST: RubriqueStory[] = [
  {
    id: 92,
    titre: "Édito : ce que 2026 change vraiment pour les décideurs",
    cover: "/legacy/articles/1591543622.jpg",
    category: "Édito",
    author: "Opt1mum",
    dateLabel: "21 juil. 2026",
  },
  {
    id: 93,
    titre: "Entrevue croisée : deux générations, une même ambition",
    cover: "/legacy/articles/1591543587.jpg",
    category: "Entrevue croisée",
    author: "Opt1mum",
    dateLabel: "19 juil. 2026",
  },
];


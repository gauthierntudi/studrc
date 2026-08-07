import type {
  PublicArticleCard,
  PublicHomeArticles,
} from "@/lib/api";
import {
  DEMO_A_NE_PAS_MANQUER_FEATURED,
  DEMO_A_NE_PAS_MANQUER_LIST,
  DEMO_DOSSIERS,
  DEMO_FEATURED,
  DEMO_FIL_INFO,
  DEMO_GAME_FEATURED,
  DEMO_GAME_GRID,
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  DEMO_PLUS_VUS_FEATURED,
  DEMO_PLUS_VUS_LIST,
  DEMO_STARTUP_FEATURED,
  DEMO_STARTUP_GRID,
  DEMO_TOP_GRID,
  DEMO_ZOOM_FEATURED,
  DEMO_ZOOM_GRID,
  type DossierCard,
  type RubriqueSplitStory,
  type RubriqueStory,
  type TopStory,
} from "@/lib/legacy-demo";

const FALLBACK_COVER = "/legacy/articles/1591543587.jpg";

export function articleHref(story: {
  slug?: string;
  id: string | number;
}): string {
  return `/article/${encodeURIComponent(String(story.slug ?? story.id))}`;
}

function tone(
  value: string | undefined,
): TopStory["categoryTone"] {
  switch (value) {
    case "red":
    case "blue":
    case "teal":
    case "dark":
    case "gold":
      return value;
    case "orange":
    case "yellow":
      return "gold";
    default:
      return "teal";
  }
}

function tagTone(
  value: string | undefined,
): RubriqueStory["tagTone"] {
  switch (value) {
    case "red":
    case "blue":
    case "teal":
    case "dark":
    case "gold":
    case "orange":
    case "yellow":
      return value;
    default:
      return "teal";
  }
}

export function toTopStory(a: PublicArticleCard): TopStory {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    excerpt: a.excerpt ?? undefined,
    cover: a.coverUrl || FALLBACK_COVER,
    category: a.categoryLabel,
    categoryTone: tone(a.categoryTone),
    author: a.authorName,
    dateLabel: a.dateLabel,
    featured: true,
  };
}

export function toRubriqueStory(a: PublicArticleCard): RubriqueStory {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    cover: a.coverUrl || FALLBACK_COVER,
    category: a.categoryLabel,
    author: a.authorName,
    dateLabel: a.dateLabel,
    tagTone: tagTone(a.categoryTone),
  };
}

export function toSplitStory(a: PublicArticleCard): RubriqueSplitStory {
  return {
    ...toRubriqueStory(a),
    excerpt: a.excerpt ?? undefined,
  };
}

export function toDossierCard(a: PublicArticleCard): DossierCard {
  return {
    id: a.id,
    slug: a.slug,
    titre: a.title,
    cover: a.coverUrl || FALLBACK_COVER,
  };
}

function pick<T>(api: T[], demo: T[], min = 1): T[] {
  return api.length >= min ? api : demo;
}

function pickOne<T>(api: T[], demo: T): T {
  return api[0] ?? demo;
}

export type HomeArticlesView = {
  featured: TopStory[];
  topGrid: TopStory[];
  decryptages: DossierCard[];
  filInfo: { id: string | number; slug?: string; titre: string }[];
  startupFeatured: RubriqueStory;
  startupGrid: RubriqueStory[];
  inspirationnelFeatured: RubriqueSplitStory;
  inspirationnelGrid: RubriqueSplitStory[];
  plusVusFeatured: RubriqueStory;
  plusVusList: RubriqueStory[];
  zoomFeatured: RubriqueStory;
  zoomGrid: RubriqueStory[];
  gameFeatured: RubriqueSplitStory;
  gameGrid: RubriqueSplitStory[];
  aNePasManquerFeatured: RubriqueStory;
  aNePasManquerList: RubriqueStory[];
};

export function buildHomeArticlesView(
  feed: PublicHomeArticles | null,
): HomeArticlesView {
  const featured = (feed?.featured ?? []).map(toTopStory);
  const topGrid = (feed?.topGrid ?? []).map(toTopStory);
  const decryptages = (feed?.decryptages ?? []).map(toDossierCard);
  const filInfo = (feed?.filInfo ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    titre: a.title,
  }));
  const startup = (feed?.startup ?? []).map(toRubriqueStory);
  const inspirationnel = (feed?.inspirationnel ?? []).map(toSplitStory);
  const plusVus = (feed?.plusVus ?? []).map(toRubriqueStory);
  const zoom = (feed?.zoom ?? []).map(toRubriqueStory);
  const game = (feed?.gameChangers ?? []).map(toSplitStory);
  const miss = (feed?.aNePasManquer ?? []).map(toRubriqueStory);

  return {
    featured: pick(featured, DEMO_FEATURED, 1),
    topGrid: pick(topGrid, DEMO_TOP_GRID, 1),
    decryptages: pick(decryptages, DEMO_DOSSIERS, 1),
    filInfo: pick(
      filInfo,
      DEMO_FIL_INFO as { id: string | number; slug?: string; titre: string }[],
      1,
    ).slice(0, 5),
    startupFeatured: pickOne(startup, DEMO_STARTUP_FEATURED),
    startupGrid: pick(startup.slice(1), DEMO_STARTUP_GRID, 1),
    inspirationnelFeatured: pickOne(
      inspirationnel,
      DEMO_INSPIRATIONNEL_FEATURED,
    ),
    inspirationnelGrid: pick(
      inspirationnel.slice(1),
      DEMO_INSPIRATIONNEL_GRID,
      1,
    ),
    plusVusFeatured: pickOne(plusVus, DEMO_PLUS_VUS_FEATURED),
    plusVusList: pick(plusVus.slice(1), DEMO_PLUS_VUS_LIST, 1),
    zoomFeatured: pickOne(zoom, DEMO_ZOOM_FEATURED),
    zoomGrid: pick(zoom.slice(1), DEMO_ZOOM_GRID, 1),
    gameFeatured: pickOne(game, DEMO_GAME_FEATURED),
    gameGrid: pick(game.slice(1), DEMO_GAME_GRID, 1),
    aNePasManquerFeatured: pickOne(miss, DEMO_A_NE_PAS_MANQUER_FEATURED),
    aNePasManquerList: pick(miss.slice(1), DEMO_A_NE_PAS_MANQUER_LIST, 1),
  };
}

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
    videoHlsUrl: a.videoHlsUrl ?? null,
    videoPosterUrl: a.videoPosterUrl ?? null,
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

function pickLatestPerRubrique(
  groups: TopStory[][],
  demo: TopStory[],
  featuredIds: Set<string>,
): TopStory[] {
  const used = new Set(featuredIds);
  const out: TopStory[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] ?? [];
    const article =
      group.find((item) => !used.has(String(item.id))) ?? group[0] ?? demo[i];
    if (!article) continue;
    const id = String(article.id);
    if (used.has(id) && out.some((row) => String(row.id) === id)) continue;
    used.add(id);
    out.push(article);
  }
  return out.slice(0, 4);
}

export type HomeArticlesView = {
  featured: TopStory[];
  topGrid: TopStory[];
  stuData: DossierCard[];
  filInfo: { id: string | number; slug?: string; titre: string }[];
  stuNewsFeatured: RubriqueStory;
  stuNewsGrid: RubriqueStory[];
  stuStoriesFeatured: RubriqueSplitStory;
  stuStoriesGrid: RubriqueSplitStory[];
  plusVusFeatured: RubriqueStory;
  plusVusList: RubriqueStory[];
  stuTalkFeatured: RubriqueStory;
  stuTalkGrid: RubriqueStory[];
  stuMagFeatured: RubriqueSplitStory;
  stuMagGrid: RubriqueSplitStory[];
  aNePasManquerFeatured: RubriqueStory;
  aNePasManquerList: RubriqueStory[];
};

export function buildHomeArticlesView(
  feed: PublicHomeArticles | null,
): HomeArticlesView {
  const featured = (feed?.featured ?? []).map(toTopStory);
  const stuData = (feed?.stuData ?? []).map(toDossierCard);
  const filInfo = (feed?.filInfo ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    titre: a.title,
  }));
  const stuNews = (feed?.stuNews ?? []).map(toRubriqueStory);
  const stuStories = (feed?.stuStories ?? []).map(toSplitStory);
  const plusVus = (feed?.plusVus ?? []).map(toRubriqueStory);
  const stuTalk = (feed?.stuTalk ?? []).map(toRubriqueStory);
  const stuMag = (feed?.stuMag ?? []).map(toSplitStory);
  const miss = (feed?.aNePasManquer ?? []).map(toRubriqueStory);

  const featuredIds = new Set(featured.map((a) => String(a.id)));

  return {
    featured: pick(featured, DEMO_FEATURED, 1),
    topGrid: pickLatestPerRubrique(
      [
        (feed?.stuTalk ?? []).map(toTopStory),
        (feed?.stuStories ?? []).map(toTopStory),
        (feed?.stuData ?? []).map(toTopStory),
        (feed?.stuNews ?? []).map(toTopStory),
      ],
      DEMO_TOP_GRID,
      featuredIds,
    ),
    stuData: pick(stuData, DEMO_DOSSIERS, 1),
    filInfo: pick(
      filInfo,
      DEMO_FIL_INFO as { id: string | number; slug?: string; titre: string }[],
      1,
    ).slice(0, 5),
    stuNewsFeatured: pickOne(stuNews, DEMO_STARTUP_FEATURED),
    stuNewsGrid: pick(stuNews.slice(1), DEMO_STARTUP_GRID, 1),
    stuStoriesFeatured: pickOne(
      stuStories,
      DEMO_INSPIRATIONNEL_FEATURED,
    ),
    stuStoriesGrid: pick(
      stuStories.slice(1),
      DEMO_INSPIRATIONNEL_GRID,
      1,
    ),
    plusVusFeatured: pickOne(plusVus, DEMO_PLUS_VUS_FEATURED),
    plusVusList: pick(plusVus.slice(1), DEMO_PLUS_VUS_LIST, 1).slice(0, 2),
    stuTalkFeatured: pickOne(stuTalk, DEMO_ZOOM_FEATURED),
    stuTalkGrid: pick(stuTalk.slice(1), DEMO_ZOOM_GRID, 1),
    stuMagFeatured: pickOne(stuMag, DEMO_GAME_FEATURED),
    stuMagGrid: pick(stuMag.slice(1), DEMO_GAME_GRID, 1),
    aNePasManquerFeatured: pickOne(miss, DEMO_A_NE_PAS_MANQUER_FEATURED),
    aNePasManquerList: pick(miss.slice(1), DEMO_A_NE_PAS_MANQUER_LIST, 1).slice(
      0,
      2,
    ),
  };
}

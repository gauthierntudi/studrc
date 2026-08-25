import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articlesPublicApi } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { CATEGORY_BLURB, RUBRIQUE_BY_SLUG } from "@/lib/rubriques";
import { RubriqueFeed } from "./rubrique-feed";
import { RubriqueHeroCarousel } from "./rubrique-hero";
import "./rubrique.css";

type Props = {
  params: Promise<{ slug: string }>;
};

const PACK_COUNT = 8;
const INITIAL_FEED = 8;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const feed = await articlesPublicApi.byCategory(slug, { take: 1 });
    return {
      title: `${feed.label} — ${BRAND.name}`,
      description:
        CATEGORY_BLURB[feed.category] ??
        `Tous les articles de la rubrique ${feed.label}.`,
    };
  } catch {
    return { title: `Rubrique — ${BRAND.name}` };
  }
}

export default async function RubriquePage({ params }: Props) {
  const { slug } = await params;

  let feed;
  try {
    feed = await articlesPublicApi.byCategory(slug, {
      take: PACK_COUNT + INITIAL_FEED,
      skip: 0,
    });
  } catch {
    notFound();
  }

  const tone = feed.tone || "teal";
  const isVideo = RUBRIQUE_BY_SLUG[slug]?.format === "video";
  const topFive = feed.items.slice(0, PACK_COUNT);
  const more = feed.items.slice(PACK_COUNT);
  const mostRead = feed.mostRead ?? [];
  const packCount = topFive.length;

  return (
    <div
      className={`opt-rubrique opt-rubrique--${tone}${isVideo ? " opt-rubrique--video" : ""}`}
    >
      <div className="opt-rubrique__inner">
        <h1 className="opt-rubrique__sr-only">{feed.label}</h1>

        {feed.items.length === 0 ? (
          <div className="opt-rubrique__empty">
            <p>
              {isVideo
                ? "Pas encore de vidéos dans cette rubrique."
                : "Pas encore d’articles dans cette rubrique."}
            </p>
            <Link href="/">Retour à l’accueil</Link>
          </div>
        ) : (
          <>
            {topFive.length > 0 ? (
              <RubriqueHeroCarousel items={topFive} video={isVideo} />
            ) : null}

            {more.length > 0 ||
            feed.total > packCount ||
            mostRead.length > 0 ? (
              <RubriqueFeed
                categorySlug={feed.category}
                categoryLabel={feed.label}
                initialItems={more}
                mostRead={mostRead}
                total={feed.total}
                packCount={packCount}
                video={isVideo}
                showHeading={
                  topFive.length > 0 &&
                  (more.length > 0 || feed.total > packCount)
                }
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

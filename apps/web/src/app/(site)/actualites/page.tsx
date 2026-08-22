import Link from "next/link";
import type { Metadata } from "next";
import { articlesPublicApi } from "@/lib/api";
import { RubriqueFeed } from "../rubrique/[slug]/rubrique-feed";
import { RubriqueHeroCarousel } from "../rubrique/[slug]/rubrique-hero";
import "../rubrique/[slug]/rubrique.css";

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Toute l’actualité éducative STUDRC — STU NEWS, DATA, STORIES, TALK et MAG.",
};

const PACK_COUNT = 8;
const INITIAL_FEED = 8;

export default async function ActualitesPage() {
  let feed;
  try {
    feed = await articlesPublicApi.feed({
      take: PACK_COUNT + INITIAL_FEED,
      skip: 0,
    });
  } catch {
    feed = null;
  }

  if (!feed) {
    return (
      <div className="opt-rubrique opt-rubrique--red">
        <div className="opt-rubrique__inner">
          <div className="opt-rubrique__empty">
            <p>Impossible de charger les actualités pour le moment.</p>
            <Link href="/">Retour à l’accueil</Link>
          </div>
        </div>
      </div>
    );
  }

  const topFive = feed.items.slice(0, PACK_COUNT);
  const more = feed.items.slice(PACK_COUNT);
  const mostRead = feed.mostRead ?? [];
  const packCount = topFive.length;

  return (
    <div className="opt-rubrique opt-rubrique--red">
      <div className="opt-rubrique__inner">
        <h1 className="opt-rubrique__sr-only">Actualités</h1>

        {feed.items.length === 0 ? (
          <div className="opt-rubrique__empty">
            <p>Pas encore d’articles publiés.</p>
            <Link href="/">Retour à l’accueil</Link>
          </div>
        ) : (
          <>
            {topFive.length > 0 ? (
              <RubriqueHeroCarousel items={topFive} />
            ) : null}

            {more.length > 0 ||
            feed.total > packCount ||
            mostRead.length > 0 ? (
              <RubriqueFeed
                categorySlug="actualites"
                categoryLabel="Actualités"
                initialItems={more}
                mostRead={mostRead}
                total={feed.total}
                packCount={packCount}
                globalFeed
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

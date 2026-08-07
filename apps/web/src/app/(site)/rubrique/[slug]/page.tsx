import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articlesPublicApi } from "@/lib/api";
import { RubriqueFeed } from "./rubrique-feed";
import { RubriqueHeroCarousel } from "./rubrique-hero";
import "./rubrique.css";

type Props = {
  params: Promise<{ slug: string }>;
};

const PACK_COUNT = 8;
const INITIAL_FEED = 8;

const CATEGORY_BLURB: Record<string, string> = {
  "grandes-entrevues":
    "Rencontres exclusives avec les décideurs qui façonnent l’économie et la société.",
  decryptages:
    "Analyses claires pour comprendre les enjeux politiques, économiques et sociaux.",
  zoom: "Focus sur les sujets qui comptent, avec le regard Opt1mum.",
  "entrevue-croisee":
    "Deux regards, une même question : le débat croisé des personnalités.",
  "start-up": "L’écosystème innovant, les fondateurs et les projets qui montent.",
  inspirationnel:
    "Parcours, leadership et histoires qui donnent le goût d’agir.",
  "game-changers":
    "Celles et ceux qui changent les règles du jeu en Afrique et ailleurs.",
  edito: "La voix de la rédaction Opt1mum.",
  "vus-sur-le-net": "Ce qui fait le buzz, sélectionné et contextualisé.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const feed = await articlesPublicApi.byCategory(slug, { take: 1 });
    return {
      title: `${feed.label} — Opt1mum`,
      description:
        CATEGORY_BLURB[feed.category] ??
        `Tous les articles de la rubrique ${feed.label}.`,
    };
  } catch {
    return { title: "Rubrique — Opt1mum" };
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
  const topFive = feed.items.slice(0, PACK_COUNT);
  const more = feed.items.slice(PACK_COUNT);
  const mostRead = feed.mostRead ?? [];
  const packCount = topFive.length;

  return (
    <div className={`opt-rubrique opt-rubrique--${tone}`}>
      <div className="opt-rubrique__inner">
        <h1 className="opt-rubrique__sr-only">{feed.label}</h1>

        {feed.items.length === 0 ? (
          <div className="opt-rubrique__empty">
            <p>Pas encore d’articles dans cette rubrique.</p>
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
                categorySlug={feed.category}
                categoryLabel={feed.label}
                initialItems={more}
                mostRead={mostRead}
                total={feed.total}
                packCount={packCount}
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

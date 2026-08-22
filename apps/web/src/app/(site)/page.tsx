import { Suspense } from "react";
import { TopStories } from "@/components/site/top-stories";
import { HomeKiosque } from "@/components/site/home-kiosque";
import { HomeDossiers } from "@/components/site/home-dossiers";
import {
  HomeRubrique,
  HomeRubriqueSuite,
} from "@/components/site/home-rubrique";
import { HomeNewsletter } from "@/components/site/home-newsletter";
import { HomeSkeleton } from "@/components/site/home-skeleton";
import { MagazinePromoFloat } from "@/components/site/magazine-promo-float";
import { articlesPublicApi, magazinesPublicApi } from "@/lib/api";
import { buildHomeArticlesView } from "@/lib/home-articles";

function capitalizeDate(label: string) {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Accueil — articles + magazines dynamiques (API) avec repli démo */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [feedResult, magResult, latestResult] = await Promise.allSettled([
    articlesPublicApi.home(),
    magazinesPublicApi.list(12),
    magazinesPublicApi.latest(),
  ]);

  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;

  const magazines =
    magResult.status === "fulfilled"
      ? (magResult.value.items ?? []).map((m) => ({
          id: m.id,
          titre: m.title,
          cover: m.coverUrl || "/legacy/covers/1591457791.jpg",
          dateLabel: capitalizeDate(m.dateLabel),
        }))
      : [];

  const latestMagazine =
    latestResult.status === "fulfilled" ? latestResult.value : null;

  const articles = buildHomeArticlesView(feed);

  return (
    <>
      <TopStories featured={articles.featured} grid={articles.topGrid} />
      <HomeKiosque magazines={magazines} />
      <HomeDossiers
        decryptages={articles.stuData}
        filInfo={articles.filInfo}
      />
      <HomeRubrique
        primary={{
          title: "STU NEWS",
          href: "/rubrique/stu-news",
          titleClass: "opt-rub__title--red",
          dotClass: "opt-rub__dot--red",
          featured: articles.stuNewsFeatured,
          grid: articles.stuNewsGrid,
        }}
        split={{
          title: "STU STORIES",
          href: "/rubrique/stu-stories",
          accentClass: "opt-rsplit__title--gold",
          featured: articles.stuStoriesFeatured,
          grid: articles.stuStoriesGrid,
        }}
        sidebar={{
          title: "Les plus vus",
          titleClass: "opt-rub__title--blue",
          dotClass: "opt-rub__dot--blue",
          featured: articles.plusVusFeatured,
          list: articles.plusVusList,
        }}
      />
      <HomeNewsletter />
      <HomeRubriqueSuite
        primary={{
          title: "STU TALK",
          href: "/rubrique/stu-talk",
          titleClass: "opt-rub__title--teal",
          dotClass: "opt-rub__dot--teal",
          featured: articles.stuTalkFeatured,
          grid: articles.stuTalkGrid,
        }}
        split={{
          title: "STU MAG",
          href: "/kiosque",
          accentClass: "opt-rsplit__title--dark",
          featured: articles.stuMagFeatured,
          grid: articles.stuMagGrid,
        }}
        sidebar={{
          title: "À ne pas manquer",
          titleClass: "opt-rub__title--navy",
          dotClass: "opt-rub__dot--navy",
          featured: articles.aNePasManquerFeatured,
          list: articles.aNePasManquerList,
        }}
      />
      {latestMagazine ? (
        <MagazinePromoFloat
          magazine={latestMagazine}
          eyebrow="Nouveau numéro"
          showDelayMs={2500}
        />
      ) : null}
    </>
  );
}

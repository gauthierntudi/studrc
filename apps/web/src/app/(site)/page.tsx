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

/** Accueil — articles + magazines dynamiques (API) avec repli démo */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const [feedResult, latestResult, magsResult] = await Promise.allSettled([
    articlesPublicApi.home(),
    magazinesPublicApi.latest(),
    magazinesPublicApi.list(4),
  ]);

  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;

  const latestMagazine =
    latestResult.status === "fulfilled" ? latestResult.value : null;

  const magazines =
    magsResult.status === "fulfilled"
      ? (magsResult.value.items ?? []).slice(0, 4).map((m) => ({
          id: m.id,
          title: m.title,
          cover: m.coverUrl || "/legacy/covers/1591457791.jpg",
          issueNumber: m.issueNumber,
          dateLabel: m.dateLabel,
        }))
      : [];

  const articles = buildHomeArticlesView(feed);

  return (
    <>
      <TopStories featured={articles.featured} grid={articles.topGrid} />
      <HomeKiosque
        items={[
          articles.stuStoriesFeatured,
          ...articles.stuStoriesGrid,
        ].map((s) => ({
          id: s.id,
          slug: s.slug,
          titre: s.titre,
          cover: s.cover,
          dateLabel: s.dateLabel,
          videoHlsUrl: s.videoHlsUrl,
          videoPosterUrl: s.videoPosterUrl,
        }))}
      />
      <HomeDossiers decryptages={articles.stuData} />
      <HomeRubrique
        primary={{
          title: "STU NEWS",
          href: "/rubrique/stu-news",
          titleClass: "opt-rub__title--red",
          dotClass: "opt-rub__dot--red",
          featured: articles.stuNewsFeatured,
          grid: articles.stuNewsGrid,
        }}
        sidebar={{
          title: "Juste pour toi",
          titleClass: "opt-rub__title--navy",
          dotClass: "opt-rub__dot--navy",
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
          moreLabel: "Toutes les vidéos",
          video: true,
          featured: articles.stuTalkFeatured,
          grid: articles.stuTalkGrid,
        }}
        split={{
          title: "STU MAG",
          href: "/kiosque",
          accentClass: "opt-rsplit__title--dark",
          moreLabel: "Tous les numéros",
          magazines,
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

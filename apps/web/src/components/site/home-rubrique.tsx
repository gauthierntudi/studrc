import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  DEMO_PLUS_VUS_FEATURED,
  DEMO_PLUS_VUS_LIST,
  DEMO_STARTUP_FEATURED,
  DEMO_STARTUP_GRID,
  type RubriqueStory,
} from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import {
  HomeRubriqueSplit,
  type HomeRubriqueSplitProps,
} from "@/components/site/home-rubrique-split";
import { CoverImage } from "@/components/site/cover-image";
import "./home-rubrique.css";

function Meta({
  author,
  dateLabel,
  light,
}: {
  author: string;
  dateLabel: string;
  light?: boolean;
}) {
  return (
    <p className={`opt-rub__meta${light ? " opt-rub__meta--light" : ""}`}>
      <span>Par {author}</span>
      <span className="opt-rub__meta-date">{dateLabel}</span>
    </p>
  );
}

function Tag({
  label,
  tone = "teal",
}: {
  label: string;
  tone?: RubriqueStory["tagTone"];
}) {
  return (
    <span className={`opt-rub__tag opt-rub__tag--${tone ?? "teal"}`}>
      {label}
    </span>
  );
}

function FeaturedCard({ story }: { story: RubriqueStory }) {
  return (
    <Link href={articleHref(story)} className="opt-rub__featured">
      <CoverImage src={story.cover} className="opt-rub__featured-cover" />
      <div className="opt-rub__featured-shade" aria-hidden />
      <div className="opt-rub__featured-body">
        <Tag label={story.category} tone={story.tagTone} />
        <h3 className="opt-rub__featured-title">{story.titre}</h3>
        <Meta author={story.author} dateLabel={story.dateLabel} light />
      </div>
    </Link>
  );
}

function GridCard({ story }: { story: RubriqueStory }) {
  return (
    <Link href={articleHref(story)} className="opt-rub__grid-card">
      <div className="opt-rub__grid-media">
        <CoverImage src={story.cover} />
        <Tag label={story.category} tone={story.tagTone} />
      </div>
      <h3 className="opt-rub__grid-title">{story.titre}</h3>
      <p className="opt-rub__grid-date">{story.dateLabel}</p>
    </Link>
  );
}

function PlusVusItem({ story }: { story: RubriqueStory }) {
  return (
    <Link href={articleHref(story)} className="opt-rub__pv-item">
      <div className="opt-rub__pv-thumb">
        <CoverImage src={story.cover} />
      </div>
      <div className="opt-rub__pv-body">
        <span className="opt-rub__pv-cat">{story.category}</span>
        <h3 className="opt-rub__pv-title">{story.titre}</h3>
        <p className="opt-rub__grid-date">{story.dateLabel}</p>
      </div>
    </Link>
  );
}

export type HomeRubriqueBlockProps = {
  ariaLabel: string;
  primary: {
    title: string;
    href: string;
    titleClass?: string;
    dotClass?: string;
    featured: RubriqueStory;
    grid: RubriqueStory[];
  };
  split: HomeRubriqueSplitProps;
  sidebar: {
    title: string;
    titleClass?: string;
    dotClass?: string;
    featured: RubriqueStory;
    list: RubriqueStory[];
  };
};

/**
 * Bloc rubriques : catégorie featured+2×2, catégorie split, sidebar sticky.
 */
export function HomeRubriqueBlock({
  ariaLabel,
  primary,
  split,
  sidebar,
}: HomeRubriqueBlockProps) {
  return (
    <section className="opt-rub" aria-label={ariaLabel}>
      <div className="opt-rub__inner">
        <div className="opt-rub__main">
          <header className="opt-rub__head">
            <h2
              className={`opt-rub__title${primary.titleClass ? ` ${primary.titleClass}` : ""}`}
            >
              <span
                className={`opt-rub__dot${primary.dotClass ? ` ${primary.dotClass}` : ""}`}
                aria-hidden
              />
              {primary.title}
            </h2>
            <Link href={primary.href} className="opt-rub__more">
              En savoir plus
              <span className="opt-rub__more-icon" aria-hidden>
                <ArrowRight size={14} strokeWidth={2.5} />
              </span>
            </Link>
          </header>

          <div className="opt-rub__main-body">
            <FeaturedCard story={primary.featured} />
            <div className="opt-rub__grid">
              {primary.grid.map((story) => (
                <GridCard key={story.id} story={story} />
              ))}
            </div>
          </div>

          <HomeRubriqueSplit {...split} />
        </div>

        <aside className="opt-rub__side" aria-label={sidebar.title}>
          <header className="opt-rub__head">
            <h2
              className={`opt-rub__title${sidebar.titleClass ? ` ${sidebar.titleClass}` : ""}`}
            >
              <span
                className={`opt-rub__dot${sidebar.dotClass ? ` ${sidebar.dotClass}` : " opt-rub__dot--blue"}`}
                aria-hidden
              />
              {sidebar.title}
            </h2>
          </header>

          <FeaturedCard story={sidebar.featured} />
          <div className="opt-rub__pv-list">
            {sidebar.list.map((story) => (
              <PlusVusItem key={story.id} story={story} />
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Après le fil info : Start-up + Inspirationnel + Les plus vus */
export function HomeRubrique({
  primary,
  split,
  sidebar,
}: Partial<HomeRubriqueBlockProps> = {}) {
  return (
    <HomeRubriqueBlock
      ariaLabel="Start-up, Inspirationnel et les plus vus"
      primary={
        primary ?? {
          title: "Start-up",
          href: "/rubrique/start-up",
          titleClass: "opt-rub__title--teal",
          dotClass: "opt-rub__dot--teal",
          featured: DEMO_STARTUP_FEATURED,
          grid: DEMO_STARTUP_GRID,
        }
      }
      split={
        split ?? {
          title: "Inspirationnel",
          href: "/rubrique/inspirationnel",
          accentClass: "opt-rsplit__title--red",
          featured: DEMO_INSPIRATIONNEL_FEATURED,
          grid: DEMO_INSPIRATIONNEL_GRID,
        }
      }
      sidebar={
        sidebar ?? {
          title: "Les plus vus",
          titleClass: "opt-rub__title--blue",
          dotClass: "opt-rub__dot--blue",
          featured: DEMO_PLUS_VUS_FEATURED,
          list: DEMO_PLUS_VUS_LIST,
        }
      }
    />
  );
}

/** Après newsletter : Zoom + Game changers + À ne pas manquer */
export function HomeRubriqueSuite({
  primary,
  split,
  sidebar,
}: {
  primary: HomeRubriqueBlockProps["primary"];
  split: HomeRubriqueSplitProps;
  sidebar: HomeRubriqueBlockProps["sidebar"];
}) {
  return (
    <HomeRubriqueBlock
      ariaLabel={`${primary.title}, ${split.title ?? ""} et ${sidebar.title}`}
      primary={primary}
      split={split}
      sidebar={sidebar}
    />
  );
}

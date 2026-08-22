import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  DEMO_INSPIRATIONNEL_FEATURED,
  DEMO_INSPIRATIONNEL_GRID,
  type RubriqueSplitStory,
} from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import "./home-rubrique-split.css";

function Meta({ author, dateLabel }: { author: string; dateLabel: string }) {
  return (
    <p className="opt-rsplit__meta">
      <span>
        Par <strong>{author}</strong>
      </span>
      <span className="opt-rsplit__meta-date">{dateLabel}</span>
    </p>
  );
}

function FeaturedSplit({ story }: { story: RubriqueSplitStory }) {
  return (
    <Link href={articleHref(story)} className="opt-rsplit__featured">
      <div className="opt-rsplit__featured-media">
        <CoverImage src={story.cover} />
      </div>
      <div className="opt-rsplit__featured-panel">
        <span
          className={`opt-rsplit__tag opt-rsplit__tag--${story.tagTone ?? "teal"}`}
        >
          {story.category}
        </span>
        <h3 className="opt-rsplit__featured-title">{story.titre}</h3>
        {story.excerpt ? (
          <p className="opt-rsplit__excerpt">{story.excerpt}</p>
        ) : null}
        <Meta author={story.author} dateLabel={story.dateLabel} />
      </div>
    </Link>
  );
}

function GridCard({ story }: { story: RubriqueSplitStory }) {
  return (
    <Link href={articleHref(story)} className="opt-rsplit__card">
      <div className="opt-rsplit__card-media">
        <CoverImage src={story.cover} />
        <span
          className={`opt-rsplit__tag opt-rsplit__tag--${story.tagTone ?? "teal"}`}
        >
          {story.category}
        </span>
      </div>
      <h3 className="opt-rsplit__card-title">{story.titre}</h3>
      <Meta author={story.author} dateLabel={story.dateLabel} />
    </Link>
  );
}

export type HomeRubriqueSplitProps = {
  title?: string;
  href?: string;
  accentClass?: string;
  featured?: RubriqueSplitStory;
  grid?: RubriqueSplitStory[];
};

/**
 * Rubrique colonne principale — featured split + grille 3 cols.
 */
export function HomeRubriqueSplit({
  title = "STU STORIES",
  href = "/rubrique/stu-stories",
  accentClass,
  featured = DEMO_INSPIRATIONNEL_FEATURED,
  grid = DEMO_INSPIRATIONNEL_GRID,
}: HomeRubriqueSplitProps = {}) {
  return (
    <div className="opt-rsplit" aria-label={title}>
      <header className="opt-rsplit__head">
        <h2 className={`opt-rsplit__title${accentClass ? ` ${accentClass}` : ""}`}>
          <span className="opt-rsplit__dot" aria-hidden />
          {title}
        </h2>
        <Link href={href} className="opt-rsplit__more">
          En savoir plus
          <span className="opt-rsplit__more-icon" aria-hidden>
            <ArrowRight size={14} strokeWidth={2.5} />
          </span>
        </Link>
      </header>

      <FeaturedSplit story={featured} />

      <div className="opt-rsplit__grid">
        {grid.map((story) => (
          <GridCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  );
}

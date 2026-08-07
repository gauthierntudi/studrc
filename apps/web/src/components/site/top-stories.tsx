"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_FEATURED, DEMO_TOP_GRID, type TopStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import "./top-stories.css";

/** Couleurs vives compatibles texte blanc */
const FEATURED_BG = [
  "#e9262a",
  "#e11d48",
  "#ea580c",
  "#d97706",
  "#16a34a",
  "#0d9488",
  "#0891b2",
  "#0284c7",
  "#2563eb",
  "#db2777",
  "#c026d3",
  "#7c3aed",
] as const;

const AUTO_MS = 6000;

function hashId(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bgForStory(story: TopStory) {
  return FEATURED_BG[hashId(story.id) % FEATURED_BG.length];
}

function Meta({ author, dateLabel }: { author: string; dateLabel: string }) {
  return (
    <p className="opt-top__meta">
      <span className="opt-top__meta-author">{author}</span>
      <span className="opt-top__meta-date">{dateLabel}</span>
    </p>
  );
}

function CategoryBadge({
  label,
  tone,
}: {
  label: string;
  tone: TopStory["categoryTone"];
}) {
  return <span className={`opt-top__badge opt-top__badge--${tone}`}>{label}</span>;
}

function GridCard({ story }: { story: TopStory }) {
  return (
    <article className="opt-top__card">
      <Link href={articleHref(story)} className="opt-top__card-link">
        <CoverImage src={story.cover} className="opt-top__card-cover" />
        <div className="opt-top__card-shade" aria-hidden />
        <div className="opt-top__card-overlay">
          <CategoryBadge label={story.category} tone={story.categoryTone} />
          <h3 className="opt-top__card-title">{story.titre}</h3>
          <Meta author={story.author} dateLabel={story.dateLabel} />
        </div>
      </Link>
    </article>
  );
}

function FeaturedSlide({ story }: { story: TopStory }) {
  return (
    <article className="opt-top__featured">
      <Link href={articleHref(story)} className="opt-top__featured-media">
        <CoverImage src={story.cover} />
        <div className="opt-top__featured-badges">
          <CategoryBadge label={story.category} tone={story.categoryTone} />
          <span className="opt-top__badge opt-top__badge--dark">À la une</span>
        </div>
      </Link>
      <div
        className="opt-top__featured-body"
        style={{ backgroundColor: bgForStory(story) }}
      >
        <h2 className="opt-top__featured-title">
          <Link href={articleHref(story)}>{story.titre}</Link>
        </h2>
        {story.excerpt && (
          <p className="opt-top__featured-excerpt">{story.excerpt}</p>
        )}
        <Meta author={story.author} dateLabel={story.dateLabel} />
      </div>
    </article>
  );
}

function FeaturedSlider({ stories }: { stories: TopStory[] }) {
  const n = stories.length;
  const multi = n > 1;
  /** Piste : [clone dernier, ...stories, clone premier] — index réel démarre à 1 */
  const trackStories = multi
    ? [stories[n - 1], ...stories, stories[0]]
    : stories;

  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slideW, setSlideW] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const realIndex = multi ? (pos - 1 + n) % n : 0;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => setSlideW(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!multi || busy) return;
      setBusy(true);
      setAnimate(true);
      setPos((p) => p + dir);
    },
    [multi, busy],
  );

  const jumpTo = useCallback((target: number) => {
    setAnimate(false);
    setPos(target);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimate(true);
        setBusy(false);
      });
    });
  }, []);

  const onTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.target !== trackRef.current) return;
      if (e.propertyName !== "transform") return;
      if (!multi) return;

      if (pos === n + 1) {
        jumpTo(1);
      } else if (pos === 0) {
        jumpTo(n);
      } else {
        setBusy(false);
      }
    },
    [jumpTo, multi, n, pos],
  );

  useEffect(() => {
    if (!multi || paused || busy) return;
    const id = window.setInterval(() => go(1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [multi, paused, busy, go, pos]);

  if (!multi) {
    return <FeaturedSlide story={stories[0]} />;
  }

  const offsetPx = slideW > 0 ? -(pos * slideW) : 0;

  return (
    <div
      className={`opt-top__slider${paused ? " is-paused" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="opt-top__slider-viewport" ref={viewportRef}>
        <div
          ref={trackRef}
          className={`opt-top__slider-track${animate ? "" : " is-instant"}`}
          style={{
            transform:
              slideW > 0
                ? `translate3d(${offsetPx}px, 0, 0)`
                : `translate3d(-${pos * 100}%, 0, 0)`,
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {trackStories.map((story, i) => (
            <div
              className="opt-top__slider-slide"
              key={`${story.id}-${i}`}
              aria-hidden={i !== pos}
              style={slideW > 0 ? { width: slideW, minWidth: slideW, maxWidth: slideW, flexBasis: slideW } : undefined}
            >
              <FeaturedSlide story={story} />
            </div>
          ))}
        </div>
      </div>

      <div className="opt-top__slider-progress" aria-hidden>
        <span
          key={realIndex}
          className="opt-top__slider-progress-bar"
          style={{ animationDuration: `${AUTO_MS}ms` }}
        />
      </div>

      <button
        type="button"
        className="opt-top__slider-nav opt-top__slider-nav--prev"
        aria-label="Article précédent"
        onClick={() => go(-1)}
      >
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="opt-top__slider-nav opt-top__slider-nav--next"
        aria-label="Article suivant"
        onClick={() => go(1)}
      >
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </button>

      <div className="opt-top__slider-dots" role="tablist" aria-label="À la une">
        {stories.map((story, i) => (
          <button
            key={story.id}
            type="button"
            role="tab"
            aria-selected={i === realIndex}
            aria-label={`Article ${i + 1}`}
            className={`opt-top__slider-dot${i === realIndex ? " is-active" : ""}`}
            onClick={() => {
              if (busy || i === realIndex) return;
              setBusy(true);
              setAnimate(true);
              setPos(i + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Première section accueil — à la une (slide si plusieurs) + grille 2×2. */
export function TopStories({
  featured = DEMO_FEATURED,
  grid = DEMO_TOP_GRID,
}: {
  featured?: TopStory[];
  grid?: TopStory[];
} = {}) {
  return (
    <section className="opt-top" aria-label="À la une">
      <div className="opt-top__inner">
        <FeaturedSlider stories={featured} />

        <div className="opt-top__grid">
          {grid.map((story) => (
            <GridCard key={story.id} story={story} />
          ))}
        </div>
      </div>
    </section>
  );
}

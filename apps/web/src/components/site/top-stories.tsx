"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
} from "react";
import { DEMO_FEATURED, DEMO_TOP_GRID, type TopStory } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import { VideoPlay } from "@/components/site/video-play";
import { isVideoRubrique } from "@/lib/rubriques";
import "./top-stories.css";

const AUTO_MS = 6000;

/** Accents charte — fonds du sticker « à la une » */
const FEATURED_ACCENT = ["#ff0c00", "#0462a9", "#022144", "#e1045c"] as const;

function hashId(id: string | number) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function accentForStory(story: TopStory) {
  return FEATURED_ACCENT[hashId(story.id) % FEATURED_ACCENT.length];
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
  const video = isVideoRubrique(story.category);
  return (
    <article className={`opt-top__card opt-top__card--${story.categoryTone}`}>
      <Link href={articleHref(story)} className="opt-top__card-link">
        <div className="opt-top__card-media">
          <CoverImage src={story.cover} className="opt-top__card-cover" />
          {video ? <VideoPlay size={18} className="opt-video-play--sm" /> : null}
          <CategoryBadge label={story.category} tone={story.categoryTone} />
        </div>
        <div className="opt-top__card-body">
          <h3 className="opt-top__card-title">{story.titre}</h3>
          <Meta author={story.author} dateLabel={story.dateLabel} />
        </div>
      </Link>
    </article>
  );
}

function FeaturedSlide({ story }: { story: TopStory }) {
  const video = isVideoRubrique(story.category);
  return (
    <article className="opt-top__featured">
      <Link href={articleHref(story)} className="opt-top__featured-media">
        <CoverImage src={story.cover} />
        {video ? <VideoPlay size={26} /> : null}
        <div className="opt-top__featured-badges">
          <CategoryBadge label={story.category} tone={story.categoryTone} />
          <span className="opt-top__badge opt-top__badge--dark">À la une</span>
        </div>
      </Link>
      <div
        className="opt-top__featured-body"
        style={{ backgroundColor: accentForStory(story) }}
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
  const skipClickRef = useRef(false);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    axis: null as null | "x" | "y",
  });
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);

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

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !multi) return;
    const blockScroll = (e: Event) => {
      if (dragRef.current.axis === "x") e.preventDefault();
    };
    el.addEventListener("touchmove", blockScroll, { passive: false });
    el.addEventListener("pointermove", blockScroll, { passive: false });
    return () => {
      el.removeEventListener("touchmove", blockScroll);
      el.removeEventListener("pointermove", blockScroll);
    };
  }, [multi]);

  const endDrag = useCallback(
    (clientX: number) => {
      const d = dragRef.current;
      const dx = clientX - d.startX;
      const wasSwipe = d.axis === "x";
      d.pointerId = -1;
      d.axis = null;
      setSwiping(false);
      setPaused(false);
      if (!wasSwipe) {
        setDragX(0);
        return;
      }
      const threshold = Math.max(48, slideW * 0.16);
      if (dx <= -threshold) {
        skipClickRef.current = true;
        setAnimate(true);
        setDragX(0);
        go(1);
      } else if (dx >= threshold) {
        skipClickRef.current = true;
        setAnimate(true);
        setDragX(0);
        go(-1);
      } else {
        setAnimate(true);
        setDragX(0);
      }
    },
    [go, slideW],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!multi || busy) return;
      if (e.pointerType === "mouse") return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        axis: null,
      };
      setPaused(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [busy, multi],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.axis === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        setAnimate(false);
        setSwiping(true);
      }
    }
    if (d.axis !== "x") return;
    e.preventDefault();
    setDragX(dx);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current.pointerId !== e.pointerId) return;
      endDrag(e.clientX);
    },
    [endDrag],
  );

  if (!multi) {
    return <FeaturedSlide story={stories[0]} />;
  }

  const offsetPx = slideW > 0 ? -(pos * slideW) + dragX : 0;

  return (
    <div
      className={`opt-top__slider${paused ? " is-paused" : ""}${swiping ? " is-swiping" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onClickCapture={(e) => {
        if (!skipClickRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        skipClickRef.current = false;
      }}
    >
      <div
        className="opt-top__slider-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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
          {grid.slice(0, 4).map((story) => (
            <GridCard key={story.id} story={story} />
          ))}
        </div>
      </div>
    </section>
  );
}

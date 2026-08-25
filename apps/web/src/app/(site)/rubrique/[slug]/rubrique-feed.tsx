"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  articlesPublicApi,
  type PublicArticleCard,
} from "@/lib/api";
import { CoverImage } from "@/components/site/cover-image";
import { VideoPlay } from "@/components/site/video-play";

const BATCH = 8;

type Props = {
  /** Rubrique (`decryptages`…) ou fil global (`actualites`). */
  categorySlug: string;
  categoryLabel: string;
  initialItems: PublicArticleCard[];
  mostRead: PublicArticleCard[];
  total: number;
  /** Nombre d’articles déjà affichés dans le pack du haut (ex. 5). */
  packCount: number;
  showHeading: boolean;
  /** Si true, charge via `/articles/feed` (toutes actualités). */
  globalFeed?: boolean;
  video?: boolean;
};

export function RubriqueFeed({
  categorySlug,
  categoryLabel,
  initialItems,
  mostRead,
  total,
  packCount,
  showHeading,
  globalFeed = false,
  video = false,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loaded = packCount + items.length;
  const done = exhausted || loaded >= total;
  const hasFeed = items.length > 0 || !done;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const skip = packCount + items.length;
      const res = globalFeed
        ? await articlesPublicApi.feed({ take: BATCH, skip })
        : await articlesPublicApi.byCategory(categorySlug, {
            take: BATCH,
            skip,
          });
      const seen = new Set(items.map((a) => a.id));
      const next = res.items.filter((a) => !seen.has(a.id));
      if (next.length === 0 || skip + res.items.length >= res.total) {
        setExhausted(true);
      }
      if (next.length) {
        setItems((prev) => [...prev, ...next]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger la suite",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [categorySlug, done, globalFeed, items.length, packCount]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, loadMore]);

  if (!hasFeed && mostRead.length === 0) return null;

  return (
    <section
      className="opt-rubrique__more"
      aria-labelledby={showHeading ? "opt-rubrique-more" : undefined}
    >
      {showHeading ? (
        <h2 id="opt-rubrique-more" className="opt-rubrique__more-title">
          {video ? "Nos autres vidéos" : "Nos autres articles"}
        </h2>
      ) : null}

      <div className="opt-rubrique__more-layout">
        <div className="opt-rubrique__feed">
          {items.map((item) => (
            <FeedRow key={item.id} article={item} video={video} />
          ))}

          {!done ? (
            <div
              ref={sentinelRef}
              className="opt-rubrique__feed-sentinel"
              aria-hidden
            />
          ) : null}

          {!done ? (
            <div
              ref={sentinelRef}
              className="opt-rubrique__feed-sentinel"
              aria-hidden
            />
          ) : null}

          {loading ? (
            <div
              className="opt-rubrique__feed-skel"
              aria-busy="true"
              aria-label="Chargement"
              role="status"
            >
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="opt-rubrique__feed-skel-row">
                  <span className="opt-rubrique__feed-skel-media" />
                  <span className="opt-rubrique__feed-skel-body">
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--title" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--excerpt-short" />
                    <span className="opt-rubrique__feed-skel-line opt-rubrique__feed-skel-line--meta" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="opt-rubrique__feed-status opt-rubrique__feed-status--error">
              {error}{" "}
              <button
                type="button"
                className="opt-rubrique__feed-retry"
                onClick={() => void loadMore()}
              >
                Réessayer
              </button>
            </p>
          ) : null}

          {done && items.length > 0 ? (
            <p className="opt-rubrique__feed-end" role="status">
              Vous êtes à jour
            </p>
          ) : null}
        </div>

        {mostRead.length > 0 ? (
          <aside className="opt-rubrique__popular" aria-label="Les plus lus">
            <h3 className="opt-rubrique__popular-title">
              {video ? "Les plus vues" : "Les plus lus"} — {categoryLabel}
            </h3>
            <ol className="opt-rubrique__popular-list">
              {mostRead.map((item, i) => (
                <li key={item.id}>
                  <Link
                    href={`/article/${encodeURIComponent(item.slug)}`}
                    className="opt-rubrique__popular-link"
                  >
                    <span className="opt-rubrique__popular-num" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="opt-rubrique__popular-text">
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function FeedRow({
  article,
  video,
}: {
  article: PublicArticleCard;
  video?: boolean;
}) {
  return (
    <article className="opt-rubrique__feed-row">
      <Link
        href={`/article/${encodeURIComponent(article.slug)}`}
        className="opt-rubrique__feed-link"
      >
        <span className="opt-rubrique__feed-media">
          {article.coverUrl ? (
            <CoverImage src={article.coverUrl} />
          ) : (
            <span className="opt-rubrique__ph" aria-hidden />
          )}
          {video ? (
            <VideoPlay size={18} className="opt-video-play--sm" />
          ) : null}
        </span>
        <span className="opt-rubrique__feed-body">
          <span className="opt-rubrique__feed-title">{article.title}</span>
          {article.excerpt ? (
            <span className="opt-rubrique__feed-excerpt">{article.excerpt}</span>
          ) : null}
          <span className="opt-rubrique__feed-meta">
            <span>{article.categoryLabel}</span>
            {article.dateLabel ? (
              <>
                <span aria-hidden>·</span>
                <span>{article.dateLabel}</span>
              </>
            ) : null}
          </span>
        </span>
      </Link>
    </article>
  );
}

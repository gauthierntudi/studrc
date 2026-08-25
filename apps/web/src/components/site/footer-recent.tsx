"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  articlesPublicApi,
  type PublicArticleCard,
} from "@/lib/api";
import { DEMO_FEATURED, DEMO_TOP_GRID } from "@/lib/legacy-demo";
import { isVideoRubrique } from "@/lib/rubriques";
import { VideoPlay } from "@/components/site/video-play";

const FALLBACK_COVER = "/legacy/articles/1591543587.jpg";

type RecentItem = {
  id: string;
  href: string;
  title: string;
  cover: string;
  dateLabel: string;
  category?: string;
};

const DEMO_RECENT: RecentItem[] = [...DEMO_FEATURED, ...DEMO_TOP_GRID]
  .slice(0, 3)
  .map((post) => ({
    id: String(post.id),
    href: `/article/${post.slug ?? post.id}`,
    title: post.titre,
    cover: post.cover,
    dateLabel: post.dateLabel,
    category: post.category,
  }));

function fromApi(a: PublicArticleCard): RecentItem {
  return {
    id: a.id,
    href: `/article/${a.slug}`,
    title: a.title,
    cover: a.coverUrl || FALLBACK_COVER,
    dateLabel: a.dateLabel,
    category: a.categoryLabel,
  };
}

/** Colonne « Récents » du footer — articles publiés en live. */
export function FooterRecent() {
  const [items, setItems] = useState<RecentItem[]>(DEMO_RECENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    articlesPublicApi
      .recent(3)
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.items ?? []).map(fromApi);
        if (mapped.length > 0) setItems(mapped);
      })
      .catch(() => {
        /* keep demo */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready && items.length === 0) {
    return (
      <p className="opt-ft__recent-empty">Aucun article récent pour le moment.</p>
    );
  }

  return (
    <ul className="opt-ft__recent" aria-busy={!ready}>
      {items.map((post) => (
        <li key={post.id}>
          <Link href={post.href} className="opt-ft__recent-item">
            <span className="opt-ft__recent-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover} alt="" />
              {isVideoRubrique(post.category) ? (
                <VideoPlay size={12} className="opt-video-play--xs" />
              ) : null}
            </span>
            <span className="opt-ft__recent-body">
              <span className="opt-ft__recent-title">{post.title}</span>
              {post.dateLabel ? (
                <span className="opt-ft__recent-date">{post.dateLabel}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

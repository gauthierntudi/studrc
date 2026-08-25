"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  articlesPublicApi,
  type PublicArticleCard,
} from "@/lib/api";
import { SEARCH_FILTERS, isVideoRubrique } from "@/lib/rubriques";
import { VideoPlay } from "@/components/site/video-play";
import "./recherche.css";

const COVER_FALLBACK = "/legacy/articles/1591543587.jpg";
const PAGE_SIZE = 10;
const TITLE_MAX = 90;

function truncateTitle(title: string): string {
  const t = title.trim();
  if (t.length <= TITLE_MAX) return t;
  return `${t.slice(0, TITLE_MAX).trimEnd()}…`;
}

const FILTERS = SEARCH_FILTERS;

function buildPageItems(current: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(pageCount);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function RechercheInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const category = (params.get("rubrique") ?? "").trim();
  const pageParam = Number(params.get("page") ?? "1");
  const current = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const skip = (current - 1) * PAGE_SIZE;

  const [items, setItems] = useState<PublicArticleCard[]>([]);
  const [mostRead, setMostRead] = useState<PublicArticleCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(q.length >= 2);
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPopularLoading(true);
    articlesPublicApi
      .mostRead(5)
      .then((res) => {
        if (!cancelled) setMostRead(res.items);
      })
      .catch(() => {
        if (!cancelled) setMostRead([]);
      })
      .finally(() => {
        if (!cancelled) setPopularLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (q.length < 2) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    articlesPublicApi
      .search(q, PAGE_SIZE, category || undefined, skip)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, category, skip]);

  function pushQuery(next: { rubrique?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    const rubrique =
      next.rubrique !== undefined ? next.rubrique : category;
    if (rubrique) qs.set("rubrique", rubrique);
    const page = next.page ?? current;
    if (page > 1) qs.set("page", String(page));
    const suffix = qs.toString();
    router.replace(suffix ? `/recherche?${suffix}` : "/recherche", {
      scroll: false,
    });
  }

  function setFilter(slug: string) {
    pushQuery({ rubrique: slug, page: 1 });
  }

  function goToPage(page: number) {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    const next = Math.min(Math.max(1, page), pageCount);
    pushQuery({ page: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);
  const activeLabel = FILTERS.find((f) => f.slug === category)?.label;
  const meta =
    q.length < 2
      ? "Saisissez au moins 2 caractères dans la barre du header."
      : loading
        ? `Recherche de « ${q} »…`
        : `${total} résultat${total > 1 ? "s" : ""} pour « ${q} »${
            activeLabel && category ? ` · ${activeLabel}` : ""
          }`;

  return (
    <section className="opt-search">
      <div className="opt-search__inner">
        <header className="opt-search__head">
          <div className="opt-search__head-top">
            <h1 className="opt-search__title">Recherche</h1>
            <p className="opt-search__meta">{meta}</p>
          </div>

          <div
            className="opt-search__filters"
            role="group"
            aria-label="Filtrer par rubrique"
          >
            {FILTERS.map((f) => {
              const active = f.slug === category;
              return (
                <button
                  key={f.slug || "all"}
                  type="button"
                  className={
                    active
                      ? "opt-search__filter is-active"
                      : "opt-search__filter"
                  }
                  aria-pressed={active}
                  onClick={() => setFilter(f.slug)}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="opt-search__layout">
          <div className="opt-search__main">
            {loading && q.length >= 2 ? (
              <div className="opt-search__skel" aria-busy="true" aria-label="Chargement des résultats">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="opt-search__skel-row">
                    <span className="opt-search__skel-cover" />
                    <span className="opt-search__skel-body">
                      <span className="opt-search__skel-line opt-search__skel-line--title" />
                      <span className="opt-search__skel-line opt-search__skel-line--excerpt" />
                      <span className="opt-search__skel-line opt-search__skel-line--excerpt-short" />
                      <span className="opt-search__skel-line opt-search__skel-line--meta" />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && q.length >= 2 && items.length === 0 ? (
              <p className="opt-search__empty">Aucun article trouvé.</p>
            ) : null}

            {!loading ? (
              <ul className="opt-search__list">
                {items.map((item) => (
                  <li key={item.id} className="opt-search__row">
                    <Link
                      href={`/article/${encodeURIComponent(item.slug)}`}
                      className="opt-search__link"
                    >
                      <span
                        className={`opt-search__cover${
                          isVideoRubrique(item.category, item.categoryLabel)
                            ? " opt-search__cover--video"
                            : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.coverUrl || COVER_FALLBACK}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = COVER_FALLBACK;
                          }}
                        />
                        {isVideoRubrique(item.category, item.categoryLabel) ? (
                          <VideoPlay size={18} className="opt-video-play--sm" />
                        ) : null}
                      </span>
                      <span className="opt-search__body">
                        <span className="opt-search__item-title">
                          {truncateTitle(item.title)}
                        </span>
                        {item.excerpt ? (
                          <span className="opt-search__item-excerpt">
                            {item.excerpt}
                          </span>
                        ) : null}
                        <span className="opt-search__item-meta">
                          {item.categoryLabel}
                          {item.dateLabel ? ` · ${item.dateLabel}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {!loading && total > PAGE_SIZE ? (
              <nav className="opt-search__pager" aria-label="Pagination">
                <p className="opt-search__pager-info">
                  {from}–{to} sur {total}
                </p>
                <div className="opt-search__pager-controls">
                  <button
                    type="button"
                    className="opt-search__pager-btn"
                    disabled={current <= 1}
                    aria-label="Première page"
                    onClick={() => goToPage(1)}
                  >
                    <ChevronsLeft size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-search__pager-btn"
                    disabled={current <= 1}
                    aria-label="Page précédente"
                    onClick={() => goToPage(current - 1)}
                  >
                    <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  {buildPageItems(current, pageCount).map((p, i) =>
                    p === "…" ? (
                      <span
                        key={`e-${i}`}
                        className="opt-search__pager-ellipsis"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={
                          p === current
                            ? "opt-search__pager-btn is-active"
                            : "opt-search__pager-btn"
                        }
                        aria-current={p === current ? "page" : undefined}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="opt-search__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Page suivante"
                    onClick={() => goToPage(current + 1)}
                  >
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-search__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Dernière page"
                    onClick={() => goToPage(pageCount)}
                  >
                    <ChevronsRight size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </nav>
            ) : null}
          </div>

          {popularLoading ? (
            <aside
              className="opt-search__popular"
              aria-busy="true"
              aria-label="Chargement des plus lus"
            >
              <h2 className="opt-search__popular-title">Les plus lus</h2>
              <div className="opt-search__popular-skel">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="opt-search__popular-skel-row">
                    <span className="opt-search__popular-skel-num" />
                    <span className="opt-search__popular-skel-text">
                      <span className="opt-search__skel-line opt-search__skel-line--pop" />
                      <span className="opt-search__skel-line opt-search__skel-line--pop-short" />
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          ) : mostRead.length > 0 ? (
            <aside className="opt-search__popular" aria-label="Les plus lus">
              <h2 className="opt-search__popular-title">Les plus lus</h2>
              <ol className="opt-search__popular-list">
                {mostRead.map((item, i) => (
                  <li key={item.id}>
                    <Link
                      href={`/article/${encodeURIComponent(item.slug)}`}
                      className="opt-search__popular-link"
                    >
                      <span className="opt-search__popular-num" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="opt-search__popular-text">
                        {item.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function RecherchePage() {
  return (
    <Suspense fallback={<div className="p-5">Chargement…</div>}>
      <RechercheInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  Eye,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  libraryApi,
  magazinesPublicApi,
  type PublicMagazineCard,
  type PublicMagazineDetail,
} from "@/lib/api";
import "./kiosque.css";

const FALLBACK_COVER = "/legacy/covers/1591457791.jpg";
const DEFAULT_THEME = { bgColor: "#0d203d", accentColor: "#02d0d1" };
const PAGE_SIZE = 12;

/** Contraste texte sur une couleur de fond (WCAG relative luminance). */
function contrastOn(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#062a2b";
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L < 0.45 ? "#ffffff" : "#062a2b";
}

type AccessState = {
  canRead: boolean;
  accessVia: "free" | "subscription" | "purchase" | "preview" | null;
  subscribed: boolean;
};

function formatPrice(cents: number | null | undefined, currency: string) {
  if (cents == null || cents <= 0) return null;
  const amount = (cents / 100).toLocaleString("fr-FR", {
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  const sym = currency?.toUpperCase() === "USD" ? "$" : currency || "$";
  return `${amount}${sym}`;
}

function issueLabel(issueNumber: string | null | undefined) {
  if (!issueNumber) return null;
  return issueNumber.startsWith("#") ? issueNumber : `#${issueNumber}`;
}

function kiosqueHref(opts: {
  magazine?: string | null;
  page?: number;
  hash?: string;
}) {
  const qs = new URLSearchParams();
  if (opts.magazine) qs.set("magazine", opts.magazine);
  if (opts.page && opts.page > 1) qs.set("page", String(opts.page));
  const s = qs.toString();
  const base = s ? `/kiosque?${s}` : "/kiosque";
  return opts.hash ? `${base}${opts.hash}` : base;
}

function buildPageItems(
  current: number,
  pageCount: number,
): Array<number | "…"> {
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

function KiosqueSkeleton() {
  return (
    <div className="opt-kq__loading" aria-busy="true" aria-label="Chargement">
      <div className="opt-kq__skel">
        <div className="opt-kq__skel-cover" />
        <div className="opt-kq__skel-lines">
          <div className="opt-kq__skel-line opt-kq__skel-line--sm" />
          <div className="opt-kq__skel-line opt-kq__skel-line--lg" />
          <div className="opt-kq__skel-line" />
          <div className="opt-kq__skel-line" />
          <div className="opt-kq__skel-line opt-kq__skel-line--sm" />
        </div>
      </div>
    </div>
  );
}

export function KiosqueClient() {
  const params = useSearchParams();
  const magParam = params.get("magazine");
  const pageParam = Number(params.get("page") || "1");
  const page =
    Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const { user, loading: authLoading } = useAuth();

  const [list, setList] = useState<PublicMagazineCard[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<PublicMagazineDetail | null>(null);
  const [listReady, setListReady] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [access, setAccess] = useState<AccessState>({
    canRead: false,
    accessVia: null,
    subscribed: false,
  });

  const gridRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    let cancelled = false;
    setListReady(false);
    magazinesPublicApi
      .list({ take: PAGE_SIZE, skip: (currentPage - 1) * PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setList(res.items ?? []);
        setTotal(res.total ?? res.items?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setList([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setListReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const selectedId = useMemo(() => {
    if (magParam) return magParam;
    if (!list.length) return null;
    return list[0].id;
  }, [list, magParam]);

  const card = useMemo(
    () => (selectedId ? list.find((m) => m.id === selectedId) ?? null : null),
    [list, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    magazinesPublicApi
      .get(selectedId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (authLoading || !selectedId) return;

    if (!user) {
      setAccess({ canRead: false, accessVia: null, subscribed: false });
      return;
    }

    let cancelled = false;
    Promise.all([
      magazinesPublicApi.read(selectedId).catch(() => null),
      libraryApi.me().catch(() => null),
    ]).then(([session, lib]) => {
      if (cancelled) return;
      setAccess({
        canRead: Boolean(session?.canRead),
        accessVia: session?.accessVia ?? null,
        subscribed: lib?.status === "active",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, selectedId]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    function onKey(e: KeyboardEvent) {
      if (!el) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        el.scrollBy({ left: 160, behavior: "smooth" });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        el.scrollBy({ left: -160, behavior: "smooth" });
      }
    }

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [listReady, currentPage]);

  if (!listReady || (selectedId && detailLoading && !detail && !card)) {
    return (
      <>
        <SiteHeader showNav={false} />
        <div className="opt-kq" style={{ background: DEFAULT_THEME.bgColor }}>
          <KiosqueSkeleton />
        </div>
        <SiteFooter />
      </>
    );
  }

  if (!detail && !card && !list.length) {
    return (
      <>
        <SiteHeader showNav={false} />
        <div className="opt-kq" style={{ background: DEFAULT_THEME.bgColor }}>
          <div className="opt-kq__empty">
            <p>Aucun magazine publié pour le moment.</p>
            <Link href="/" className="opt-kq__btn opt-kq__btn--primary">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (selectedId && !detail && !card && !detailLoading) {
    return (
      <>
        <SiteHeader showNav={false} />
        <div className="opt-kq" style={{ background: DEFAULT_THEME.bgColor }}>
          <div className="opt-kq__empty">
            <p>Magazine introuvable.</p>
            <Link href="/kiosque" className="opt-kq__btn opt-kq__btn--primary">
              Voir le kiosque
            </Link>
          </div>
        </div>
        <SiteFooter />
      </>
    );
  }

  const mag: PublicMagazineDetail | PublicMagazineCard = detail ?? card!;
  const theme = detail?.theme ?? DEFAULT_THEME;
  const highlights = detail?.highlights ?? [];
  const description = detail?.description ?? null;
  const accessType = mag.accessType ?? "PAID";
  const isFree = accessType === "FREE";
  const priceLabel = formatPrice(mag.priceCents, mag.currency);
  const issue = issueLabel(mag.issueNumber);
  const cover = mag.coverUrl || FALLBACK_COVER;
  const lectureHref = `/lecture/${mag.id}`;
  const previewHref = `/lecture/${mag.id}?preview=1`;
  const loginHref = `/connexion?next=${encodeURIComponent(lectureHref)}`;
  const readHref = user ? lectureHref : loginHref;

  const canOpen = isFree || access.canRead;
  const showBuy = !isFree && !access.canRead;
  const showSubscribe = !isFree && !access.subscribed && !access.canRead;

  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <>
      <SiteHeader showNav={false} />
      <div
        className="opt-kq"
        style={
          {
            background: theme.bgColor,
            ["--kq-bg" as string]: theme.bgColor,
            ["--kq-accent" as string]: theme.accentColor,
            ["--kq-on-accent" as string]: contrastOn(theme.accentColor),
          } as CSSProperties
        }
      >
        <main className="opt-kq__main">
        <section className="opt-kq__hero" aria-labelledby="kq-title">
          <div className="opt-kq__cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={`Couverture — ${mag.title}`} />
          </div>

          <div className="opt-kq__body">
            <p className="opt-kq__eyebrow">Kiosque Opt1mum</p>
            <h1 id="kq-title" className="opt-kq__title">
              {mag.title}
            </h1>

            <div className="opt-kq__meta">
              {issue ? (
                <span className="opt-kq__chip opt-kq__chip--accent">{issue}</span>
              ) : null}
              {mag.dateLabel ? (
                <span className="opt-kq__chip">{mag.dateLabel}</span>
              ) : null}
              {isFree ? (
                <span className="opt-kq__chip">Gratuit</span>
              ) : priceLabel ? (
                <span className="opt-kq__chip">{priceLabel}</span>
              ) : null}
              {access.canRead && access.accessVia === "subscription" ? (
                <span className="opt-kq__chip">Inclus dans votre abonnement</span>
              ) : null}
              {access.canRead && access.accessVia === "purchase" ? (
                <span className="opt-kq__chip">Déjà acheté</span>
              ) : null}
            </div>

            {description ? <p className="opt-kq__desc">{description}</p> : null}

            {!isFree && priceLabel && !canOpen ? (
              <p className="opt-kq__price">
                {priceLabel}
                <span>numéro digital</span>
              </p>
            ) : null}

            <div className="opt-kq__actions">
              {canOpen ? (
                <Link href={readHref} className="opt-kq__btn opt-kq__btn--primary">
                  <BookOpen size={16} strokeWidth={2.25} aria-hidden />
                  {user ? "Lire ce numéro" : "Se connecter pour lire"}
                </Link>
              ) : null}

              <Link
                href={previewHref}
                className={`opt-kq__btn ${canOpen ? "opt-kq__btn--secondary" : "opt-kq__btn--primary"}`}
              >
                <Eye size={16} strokeWidth={2.25} aria-hidden />
                Aperçu
              </Link>

              {showBuy ? (
                <Link
                  href={`/achat?magazine=${encodeURIComponent(mag.id)}`}
                  className="opt-kq__btn opt-kq__btn--secondary"
                >
                  <CreditCard size={16} strokeWidth={2.25} aria-hidden />
                  Acheter
                  {priceLabel ? ` · ${priceLabel}` : ""}
                </Link>
              ) : null}

              {showSubscribe ? (
                <Link href="/abonnement" className="opt-kq__btn opt-kq__btn--ghost">
                  <Sparkles size={16} strokeWidth={2.25} aria-hidden />
                  S&apos;abonner
                </Link>
              ) : null}
            </div>

            <p className="opt-kq__note">
              L&apos;aperçu ouvre les 15 premières pages sans compte ni
              abonnement.
              {showBuy
                ? " L’abonnement débloque la lecture complète de ce numéro."
                : null}
            </p>

            {highlights.length > 0 ? (
              <div className="opt-kq__toc">
                <h2>À la une de ce numéro</h2>
                <ul className="opt-kq__toc-list">
                  {highlights.map((h, i) => (
                    <li key={`${h.label}-${i}`}>
                      {h.label ? (
                        <span className="opt-kq__toc-label">{h.label}</span>
                      ) : null}
                      <span className="opt-kq__toc-text">{h.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {total > 0 ? (
          <section className="opt-kq__others" aria-labelledby="kq-others">
            <div className="opt-kq__others-head">
              <h2 id="kq-others">Tous les numéros</h2>
              <span className="opt-kq__others-count">
                {from}–{to} sur {total}
              </span>
            </div>
            <div
              className="opt-kq__grid"
              ref={gridRef}
              tabIndex={0}
              role="list"
              aria-label="Choisir un autre numéro"
            >
              {list.map((m) => {
                const active = m.id === mag.id;
                return (
                  <Link
                    key={m.id}
                    href={kiosqueHref({ magazine: m.id, page: currentPage })}
                    className={`opt-kq__card${active ? " is-active" : ""}`}
                    role="listitem"
                    aria-current={active ? "true" : undefined}
                  >
                    <div className="opt-kq__card-cover">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.coverUrl || FALLBACK_COVER}
                        alt={m.title}
                      />
                    </div>
                    <div className="opt-kq__card-meta">
                      <p className="opt-kq__card-title">{m.title}</p>
                      {m.dateLabel ? (
                        <p className="opt-kq__card-date">{m.dateLabel}</p>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>

            {pageCount > 1 ? (
              <nav className="opt-kq__pager" aria-label="Pagination des numéros">
                <p className="opt-kq__pager-info">
                  Page <strong>{currentPage}</strong>
                  <span aria-hidden> / </span>
                  {pageCount}
                </p>

                <div className="opt-kq__pager-controls">
                  <Link
                    href={kiosqueHref({
                      magazine: mag.id,
                      page: 1,
                      hash: "#kq-others",
                    })}
                    className={`opt-kq__pager-btn${currentPage <= 1 ? " is-disabled" : ""}`}
                    aria-label="Première page"
                    aria-disabled={currentPage <= 1}
                    tabIndex={currentPage <= 1 ? -1 : undefined}
                    onClick={(e) => {
                      if (currentPage <= 1) e.preventDefault();
                    }}
                  >
                    <ChevronsLeft size={16} strokeWidth={2.25} aria-hidden />
                  </Link>
                  <Link
                    href={kiosqueHref({
                      magazine: mag.id,
                      page: currentPage - 1,
                      hash: "#kq-others",
                    })}
                    className={`opt-kq__pager-btn${currentPage <= 1 ? " is-disabled" : ""}`}
                    aria-label="Page précédente"
                    aria-disabled={currentPage <= 1}
                    tabIndex={currentPage <= 1 ? -1 : undefined}
                    onClick={(e) => {
                      if (currentPage <= 1) e.preventDefault();
                    }}
                  >
                    <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
                  </Link>

                  <div className="opt-kq__pager-pages">
                    {buildPageItems(currentPage, pageCount).map((item, i) =>
                      item === "…" ? (
                        <span
                          key={`e-${i}`}
                          className="opt-kq__pager-ellipsis"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <Link
                          key={item}
                          href={kiosqueHref({
                            magazine: mag.id,
                            page: item,
                            hash: "#kq-others",
                          })}
                          className={`opt-kq__pager-page${item === currentPage ? " is-active" : ""}`}
                          aria-label={`Page ${item}`}
                          aria-current={item === currentPage ? "page" : undefined}
                        >
                          {item}
                        </Link>
                      ),
                    )}
                  </div>

                  <Link
                    href={kiosqueHref({
                      magazine: mag.id,
                      page: currentPage + 1,
                      hash: "#kq-others",
                    })}
                    className={`opt-kq__pager-btn${currentPage >= pageCount ? " is-disabled" : ""}`}
                    aria-label="Page suivante"
                    aria-disabled={currentPage >= pageCount}
                    tabIndex={currentPage >= pageCount ? -1 : undefined}
                    onClick={(e) => {
                      if (currentPage >= pageCount) e.preventDefault();
                    }}
                  >
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </Link>
                  <Link
                    href={kiosqueHref({
                      magazine: mag.id,
                      page: pageCount,
                      hash: "#kq-others",
                    })}
                    className={`opt-kq__pager-btn${currentPage >= pageCount ? " is-disabled" : ""}`}
                    aria-label="Dernière page"
                    aria-disabled={currentPage >= pageCount}
                    tabIndex={currentPage >= pageCount ? -1 : undefined}
                    onClick={(e) => {
                      if (currentPage >= pageCount) e.preventDefault();
                    }}
                  >
                    <ChevronsRight size={16} strokeWidth={2.25} aria-hidden />
                  </Link>
                </div>
              </nav>
            ) : null}
          </section>
        ) : null}
      </main>
      </div>
      <SiteFooter />
    </>
  );
}

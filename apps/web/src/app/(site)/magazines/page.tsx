"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  LockOpen,
  RotateCcw,
  Search,
  Star,
  Store,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import { libraryApi, type LibraryResponse } from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";
import { MagazineCover } from "./magazine-cover";
import "./magazines.css";

const ICON = { size: 18, strokeWidth: 2 } as const;
const PAGE_SIZE = 12;

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

export default function MagazinesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/connexion?next=${encodeURIComponent("/magazines")}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    libraryApi
      .me()
      .then((data) => {
        if (!cancelled) setLibrary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger votre bibliothèque",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const magazines = library?.magazines ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return magazines;
    return magazines.filter((m) => {
      const hay = `${m.title} ${m.issueNumber ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [magazines, query]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const current = Math.min(page, pageCount);
  const skip = (current - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(skip, skip + PAGE_SIZE);
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);

  function goToPage(nextPage: number) {
    const next = Math.min(Math.max(1, nextPage), pageCount);
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (authLoading || !user || loading) {
    return (
      <section className="opt-mags opt-mags--loading" aria-busy="true">
        <div className="opt-mags__loader">
          <span className="opt-mags__spinner" aria-hidden />
          <p className="opt-mags__loader-title">Chargement</p>
          <p className="opt-mags__loader-sub">Votre bibliothèque magazine</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="opt-mags">
        <div className="opt-mags__container">
          <div className="opt-mags__state opt-mags__state--danger">
            <h2>Erreur</h2>
            <p>{error}</p>
            <button
              type="button"
              className="opt-mags__btn opt-mags__btn--primary"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </button>
          </div>
        </div>
      </section>
    );
  }

  const status = library?.status ?? "none";
  const hasLibrary = magazines.length > 0;
  const showEmptyLibrary =
    !hasLibrary && (status === "active" || !SUBSCRIPTIONS_ENABLED);

  return (
    <section className="opt-mags" aria-label="Magazines">
      <div className="opt-mags__container">
        <AccountTabs />

        {hasLibrary || showEmptyLibrary ? (
          <>
            <header className="opt-mags__hero">
              <div className="opt-mags__hero-text">
                <h1>
                  Magazine
                  {magazines.length > 0 ? (
                    <span
                      className="opt-mags__count"
                      aria-label={`${magazines.length} numéros`}
                    >
                      {magazines.length}
                    </span>
                  ) : null}
                </h1>
                <p>
                  {status === "active" && library?.planName
                    ? `${library.planName} — `
                    : user.name
                      ? `${user.name} — `
                      : null}
                  {status === "active"
                    ? "Tous les numéros de votre bibliothèque."
                    : "Numéros gratuits et achats disponibles dans votre bibliothèque."}
                </p>
              </div>

              {magazines.length > 4 ? (
                <label className="opt-mags__search">
                  <Search size={16} strokeWidth={2.25} aria-hidden />
                  <input
                    type="search"
                    placeholder="Rechercher un numéro…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {query ? (
                    <button
                      type="button"
                      className="opt-mags__search-clear"
                      aria-label="Effacer la recherche"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} strokeWidth={2.5} aria-hidden />
                    </button>
                  ) : null}
                </label>
              ) : null}
            </header>

            {magazines.length > 0 ? (
              filtered.length > 0 ? (
                <>
                  <ul className="opt-mags__grid">
                    {pageItems.map((mag, index) => {
                      const href =
                        mag.readPath ??
                        `/kiosque?magazine=${encodeURIComponent(mag.id)}`;
                      const canRead = Boolean(mag.readPath);
                      const isLatest = !query && skip + index === 0;

                      return (
                        <li key={mag.id}>
                          <Link
                            href={href}
                            className={cn(
                              "opt-mags__item",
                              isLatest && "is-latest",
                              !canRead && "is-locked",
                            )}
                            aria-label={
                              mag.issueNumber
                                ? `${mag.title} — N° ${mag.issueNumber}`
                                : mag.title
                            }
                          >
                            <MagazineCover
                              title={mag.title}
                              issueNumber={mag.issueNumber}
                              coverUrl={mag.coverUrl}
                              seed={mag.id}
                              isLatest={isLatest}
                              canRead={canRead}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {total > PAGE_SIZE ? (
                    <nav className="opt-mags__pager" aria-label="Pagination">
                      <p className="opt-mags__pager-info">
                        {from}–{to} sur {total}
                      </p>
                      <div className="opt-mags__pager-controls">
                        <button
                          type="button"
                          className="opt-mags__pager-btn"
                          disabled={current <= 1}
                          aria-label="Première page"
                          onClick={() => goToPage(1)}
                        >
                          <ChevronsLeft
                            size={16}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className="opt-mags__pager-btn"
                          disabled={current <= 1}
                          aria-label="Page précédente"
                          onClick={() => goToPage(current - 1)}
                        >
                          <ChevronLeft
                            size={16}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                        {buildPageItems(current, pageCount).map((p, i) =>
                          p === "…" ? (
                            <span
                              key={`e-${i}`}
                              className="opt-mags__pager-ellipsis"
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              type="button"
                              className={cn(
                                "opt-mags__pager-btn opt-mags__pager-num",
                                p === current && "is-active",
                              )}
                              aria-current={
                                p === current ? "page" : undefined
                              }
                              onClick={() => goToPage(p)}
                            >
                              {p}
                            </button>
                          ),
                        )}
                        <button
                          type="button"
                          className="opt-mags__pager-btn"
                          disabled={current >= pageCount}
                          aria-label="Page suivante"
                          onClick={() => goToPage(current + 1)}
                        >
                          <ChevronRight
                            size={16}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className="opt-mags__pager-btn"
                          disabled={current >= pageCount}
                          aria-label="Dernière page"
                          onClick={() => goToPage(pageCount)}
                        >
                          <ChevronsRight
                            size={16}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        </button>
                      </div>
                    </nav>
                  ) : null}
                </>
              ) : (
                <div className="opt-mags__state opt-mags__state--info">
                  <div className="opt-mags__state-icon" aria-hidden>
                    <Search {...ICON} />
                  </div>
                  <h2>Aucun résultat</h2>
                  <p>
                    Aucun magazine ne correspond à « {query.trim()} ».
                  </p>
                  <button
                    type="button"
                    className="opt-mags__btn opt-mags__btn--primary"
                    onClick={() => setQuery("")}
                  >
                    Effacer la recherche
                  </button>
                </div>
              )
            ) : showEmptyLibrary ? (
              <div className="opt-mags__state opt-mags__state--info">
                <div className="opt-mags__state-icon" aria-hidden>
                  <BookOpen {...ICON} />
                </div>
                <h2>Aucun magazine disponible</h2>
                <p>
                  De nouveaux numéros seront bientôt publiés. Revenez plus tard
                  ou consultez le kiosque.
                </p>
                <Link
                  href="/kiosque"
                  className="opt-mags__btn opt-mags__btn--primary"
                >
                  <Store size={15} strokeWidth={2} aria-hidden />
                  Aller au kiosque
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        {SUBSCRIPTIONS_ENABLED && status === "expired" ? (
          <div className="opt-mags__state opt-mags__state--danger">
            <div className="opt-mags__state-icon" aria-hidden>
              <CalendarX2 {...ICON} />
            </div>
            <h2>Abonnement expiré</h2>
            <p>
              Votre abonnement a pris fin. Renouvelez-le pour retrouver
              l&apos;accès illimité à tous les magazines.
            </p>
            <Link
              href="/abonnement"
              className="opt-mags__btn opt-mags__btn--primary"
            >
              <RotateCcw size={15} strokeWidth={2} aria-hidden />
              Renouveler
            </Link>
          </div>
        ) : null}

        {SUBSCRIPTIONS_ENABLED && status === "pending" ? (
          <div className="opt-mags__state opt-mags__state--warning">
            <div className="opt-mags__state-icon" aria-hidden>
              <CreditCard {...ICON} />
            </div>
            <h2>Abonnement inactif</h2>
            <p>
              Votre paiement n&apos;est pas encore finalisé. Activez votre
              abonnement pour débloquer la lecture des magazines.
            </p>
            <Link
              href="/abonnement"
              className="opt-mags__btn opt-mags__btn--primary"
            >
              <LockOpen size={15} strokeWidth={2} aria-hidden />
              Finaliser le paiement
            </Link>
          </div>
        ) : null}

        {SUBSCRIPTIONS_ENABLED && status === "none" ? (
          <div className="opt-mags__state opt-mags__state--info">
            <div className="opt-mags__state-icon" aria-hidden>
              <Star {...ICON} />
            </div>
            <h2>Aucun abonnement actif</h2>
            <p>
              Souscrivez à une formule pour accéder à tous les magazines
              payants sans limite, sur tous vos appareils.
            </p>
            <Link
              href="/abonnement"
              className="opt-mags__btn opt-mags__btn--primary"
            >
              <ArrowRight size={15} strokeWidth={2} aria-hidden />
              Voir les formules
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

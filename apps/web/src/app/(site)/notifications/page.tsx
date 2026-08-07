"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CreditCard,
  Newspaper,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import "@/components/site/account-shell.css";
import {
  libraryApi,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import "./notifications.css";

const PAGE_SIZE = 10;

type Filters = {
  q: string;
  type: "all" | "articles" | "magazines" | "account";
  days: 3 | 7 | 30;
  unreadOnly: boolean;
};

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

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function kindIcon(kind: NotificationKind) {
  switch (kind) {
    case "ARTICLE":
      return Newspaper;
    case "MAGAZINE":
      return BookOpen;
    case "PAYMENT_SUCCESS":
      return CheckCircle2;
    case "PAYMENT_FAILED":
      return AlertTriangle;
    case "SUBSCRIPTION_EXPIRING":
      return Clock;
    case "PURCHASE_READY":
      return ShoppingBag;
    default:
      return Bell;
  }
}

function kindBadge(kind: NotificationKind) {
  switch (kind) {
    case "ARTICLE":
      return { label: "Article", className: "opt-notif__chip--teal" };
    case "MAGAZINE":
      return { label: "Magazine", className: "opt-notif__chip--teal" };
    case "PAYMENT_SUCCESS":
      return { label: "Paiement", className: "opt-notif__chip--ok" };
    case "PAYMENT_FAILED":
      return { label: "Échec", className: "opt-notif__chip--fail" };
    case "SUBSCRIPTION_EXPIRING":
      return { label: "Abonnement", className: "opt-notif__chip--warn" };
    case "PURCHASE_READY":
      return { label: "Achat", className: "opt-notif__chip--ok" };
    default:
      return { label: "Alerte", className: "opt-notif__chip--muted" };
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    type: "all",
    days: 3,
    unreadOnly: false,
  });
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(
        `/connexion?next=${encodeURIComponent("/notifications")}`,
      );
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQ(filters.q.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [filters.q]);

  useEffect(() => {
    setSkip(0);
  }, [debouncedQ, filters.type, filters.days, filters.unreadOnly]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    libraryApi
      .notifications({
        take: PAGE_SIZE,
        skip,
        days: filters.days,
        q: debouncedQ || undefined,
        type: filters.type === "all" ? undefined : filters.type,
        unreadOnly: filters.unreadOnly || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setUnreadCount(res.unreadCount);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les notifications",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    user,
    skip,
    debouncedQ,
    filters.type,
    filters.days,
    filters.unreadOnly,
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const current = total === 0 ? 1 : Math.floor(skip / PAGE_SIZE) + 1;
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);
  const hasActiveFilters =
    Boolean(filters.q.trim()) ||
    filters.type !== "all" ||
    filters.days !== 3 ||
    filters.unreadOnly;

  function goToPage(page: number) {
    const next = Math.min(Math.max(1, page), pageCount);
    setSkip((next - 1) * PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearFilters() {
    setFilters({ q: "", type: "all", days: 3, unreadOnly: false });
  }

  function emitUnread(count: number) {
    setUnreadCount(count);
    window.dispatchEvent(
      new CustomEvent("opt:notifications-unread", { detail: { count } }),
    );
  }

  async function onOpenItem(item: NotificationItem) {
    if (!item.unread) return;
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, unread: false } : row,
      ),
    );
    try {
      const res = await libraryApi.markNotificationRead(item.id);
      emitUnread(res.unreadCount);
      if (filters.unreadOnly) {
        setItems((prev) => prev.filter((row) => row.id !== item.id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, unread: true } : row,
        ),
      );
    }
  }

  async function markAllRead() {
    try {
      const res = await libraryApi.markNotificationsSeen(filters.days);
      emitUnread(res.unreadCount);
      setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
      if (filters.unreadOnly) {
        setItems([]);
        setTotal(0);
      }
    } catch {
      /* ignore */
    }
  }

  if (authLoading || !user) {
    return (
      <section className="opt-account opt-account--loading" aria-busy="true">
        <p>Chargement…</p>
      </section>
    );
  }

  return (
    <section className="opt-account" aria-label="Notifications">
      <div className="opt-account__container">
        <AccountTabs />

        <header className="opt-account__hero">
          <h1>
            Notifications
            {unreadCount > 0 ? (
              <span
                className="opt-notif__count"
                aria-label={`${unreadCount} non lues`}
              >
                {unreadCount}
              </span>
            ) : total > 0 ? (
              <span
                className="opt-notif__count opt-notif__count--muted"
                aria-label={`${total} notifications`}
              >
                {total}
              </span>
            ) : null}
          </h1>
          <p>
            Nouveautés éditoriales et alertes de compte sur{" "}
            {filters.days} jour{filters.days > 1 ? "s" : ""}.
            {unreadCount > 0 ? (
              <>
                {" "}
                <button
                  type="button"
                  className="opt-notif__mark-all"
                  onClick={() => void markAllRead()}
                >
                  Tout marquer comme lu
                </button>
              </>
            ) : null}
          </p>
        </header>

        <div className="opt-notif__toolbar">
          <label className="opt-notif__search">
            <Search size={16} strokeWidth={2.25} aria-hidden />
            <input
              type="search"
              placeholder="Rechercher…"
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
              autoComplete="off"
            />
            {filters.q ? (
              <button
                type="button"
                className="opt-notif__search-clear"
                aria-label="Effacer la recherche"
                onClick={() => setFilters((prev) => ({ ...prev, q: "" }))}
              >
                <X size={14} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </label>

          <div className="opt-notif__filters">
            <select
              aria-label="Type de notification"
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as Filters["type"],
                }))
              }
            >
              <option value="all">Tout</option>
              <option value="articles">Articles</option>
              <option value="magazines">Magazines</option>
              <option value="account">Compte</option>
            </select>

            <select
              aria-label="Fenêtre temporelle"
              value={filters.days}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  days: Number(e.target.value) as Filters["days"],
                }))
              }
            >
              <option value={3}>3 jours</option>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
            </select>

            <label className="opt-notif__unread-toggle">
              <input
                type="checkbox"
                checked={filters.unreadOnly}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    unreadOnly: e.target.checked,
                  }))
                }
              />
              Non lues
            </label>

            {hasActiveFilters ? (
              <button
                type="button"
                className="opt-notif__reset"
                onClick={clearFilters}
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="opt-account__empty">
            <h2>Erreur</h2>
            <p>{error}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="opt-notif__loading">Chargement…</p>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="opt-account__empty">
            <Bell size={28} strokeWidth={1.75} aria-hidden />
            <h2 style={{ marginTop: "0.85rem" }}>
              {hasActiveFilters ? "Aucun résultat" : "Rien de nouveau"}
            </h2>
            <p>
              {hasActiveFilters
                ? "Aucune notification ne correspond à vos filtres."
                : "Pas d’article, magazine ou alerte de compte sur cette période."}
            </p>
            <div className="opt-notif__empty-actions">
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="opt-notif__reset opt-notif__cta"
                  onClick={clearFilters}
                >
                  Réinitialiser les filtres
                </button>
              ) : null}
              <Link href="/kiosque" className="opt-notif__cta opt-notif__cta--primary">
                Voir le kiosque
              </Link>
              <Link href="/magazines" className="opt-notif__cta">
                Mes magazines
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <>
            <ul className="opt-notif__list">
              {items.map((item) => {
                const Icon = kindIcon(item.kind);
                const chip = kindBadge(item.kind);
                const showThumb =
                  item.coverUrl &&
                  (item.kind === "ARTICLE" ||
                    item.kind === "MAGAZINE" ||
                    item.kind === "PURCHASE_READY");

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "opt-notif__item",
                        item.unread && "is-unread",
                      )}
                      onClick={() => void onOpenItem(item)}
                    >
                      {showThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={cn(
                            "opt-notif__thumb",
                            item.kind !== "ARTICLE" && "opt-notif__thumb--mag",
                          )}
                          src={
                            item.coverUrl ||
                            (item.kind === "ARTICLE"
                              ? "/legacy/articles/1591543587.jpg"
                              : "/legacy/covers/1591457791.jpg")
                          }
                          alt=""
                        />
                      ) : (
                        <span
                          className={cn(
                            "opt-notif__icon",
                            item.kind === "PAYMENT_FAILED" &&
                              "opt-notif__icon--fail",
                            item.kind === "SUBSCRIPTION_EXPIRING" &&
                              "opt-notif__icon--warn",
                            item.kind === "PAYMENT_SUCCESS" &&
                              "opt-notif__icon--ok",
                          )}
                          aria-hidden
                        >
                          {item.kind === "PAYMENT_SUCCESS" ||
                          item.kind === "PAYMENT_FAILED" ? (
                            <CreditCard size={18} strokeWidth={2} />
                          ) : (
                            <Icon size={18} strokeWidth={2} />
                          )}
                        </span>
                      )}

                      <div className="opt-notif__body">
                        <div className="opt-notif__title-row">
                          <h3>{item.title}</h3>
                          <span className={cn("opt-notif__chip", chip.className)}>
                            {chip.label}
                          </span>
                        </div>
                        {item.body ? (
                          <p className="opt-notif__meta">{item.body}</p>
                        ) : null}
                        <p className="opt-notif__date">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>

                      {item.unread ? (
                        <span className="opt-notif__dot" aria-label="Non lu" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {total > PAGE_SIZE ? (
              <nav className="opt-notif__pager" aria-label="Pagination">
                <p className="opt-notif__pager-info">
                  {from}–{to} sur {total}
                </p>
                <div className="opt-notif__pager-controls">
                  <button
                    type="button"
                    className="opt-notif__pager-btn"
                    disabled={current <= 1}
                    aria-label="Première page"
                    onClick={() => goToPage(1)}
                  >
                    <ChevronsLeft size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-notif__pager-btn"
                    disabled={current <= 1}
                    aria-label="Page précédente"
                    onClick={() => goToPage(current - 1)}
                  >
                    <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  {buildPageItems(current, pageCount).map((p, i) =>
                    p === "…" ? (
                      <span key={`e-${i}`} className="opt-notif__pager-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={cn(
                          "opt-notif__pager-btn opt-notif__pager-num",
                          p === current && "is-active",
                        )}
                        aria-current={p === current ? "page" : undefined}
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="opt-notif__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Page suivante"
                    onClick={() => goToPage(current + 1)}
                  >
                    <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-notif__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Dernière page"
                    onClick={() => goToPage(pageCount)}
                  >
                    <ChevronsRight size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

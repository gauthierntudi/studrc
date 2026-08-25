"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  CreditCard,
  Receipt,
  Search,
  ShoppingBag,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import "@/components/site/account-shell.css";
import { libraryApi, type PaymentHistoryItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import "./historique.css";

const PAGE_SIZE = 10;

type Filters = {
  q: string;
  status: string;
  provider: string;
  purpose: string;
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

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function providerLabel(provider: string) {
  switch (provider) {
    case "STRIPE":
      return "Carte";
    case "FLEXPAIE":
      return "Mobile Money";
    case "LEGACY":
      return "Legacy";
    default:
      return provider;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "SUCCESS":
      return { className: "opt-history__status--ok", label: "Payé" };
    case "PENDING":
      return { className: "opt-history__status--pending", label: "En attente" };
    case "FAILED":
      return { className: "opt-history__status--fail", label: "Échoué" };
    case "CANCELLED":
      return { className: "opt-history__status--fail", label: "Annulé" };
    case "REFUNDED":
      return { className: "opt-history__status--muted", label: "Remboursé" };
    default:
      return { className: "opt-history__status--muted", label: status };
  }
}

function purposeLabel(purpose: string) {
  return purpose === "PURCHASE" ? "Achat magazine" : "Abonnement";
}

function statusLabel(status: string) {
  return statusBadge(status).label;
}

function shortenRef(ref: string | null) {
  if (!ref) return null;
  if (ref.length <= 18) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-6)}`;
}

function metaEntries(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return [];
  const skip = new Set(["channel"]);
  return Object.entries(meta).filter(([k, v]) => {
    if (skip.has(k)) return false;
    if (v == null || v === "") return false;
    if (typeof v === "object") return false;
    return true;
  });
}

export default function HistoriquePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: "",
    status: "",
    provider: "",
    purpose: "",
  });
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/connexion?next=${encodeURIComponent("/historique")}`);
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
    setExpandedId(null);
  }, [debouncedQ, filters.status, filters.provider, filters.purpose]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    libraryApi
      .payments({
        take: PAGE_SIZE,
        skip,
        q: debouncedQ || undefined,
        status: filters.status || undefined,
        provider: filters.provider || undefined,
        purpose: filters.purpose || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setPayments(res.payments);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger l’historique",
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
    filters.status,
    filters.provider,
    filters.purpose,
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const current = total === 0 ? 1 : Math.floor(skip / PAGE_SIZE) + 1;
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);
  const hasActiveFilters =
    Boolean(filters.q.trim()) ||
    Boolean(filters.status) ||
    Boolean(filters.provider) ||
    Boolean(filters.purpose);

  function goToPage(page: number) {
    const next = Math.min(Math.max(1, page), pageCount);
    setExpandedId(null);
    setSkip((next - 1) * PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleDetails(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function clearFilters() {
    setFilters({ q: "", status: "", provider: "", purpose: "" });
  }

  async function copyRef(ref: string) {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success("Référence copiée");
    } catch {
      toast.error("Impossible de copier");
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
    <section className="opt-account" aria-label="Historique des paiements">
      <div className="opt-account__container">
        <AccountTabs />

        <header className="opt-account__hero">
          <h1>
            Historique
            {total > 0 ? (
              <span
                className="opt-history__count"
                aria-label={`${total} paiements`}
              >
                {total}
              </span>
            ) : null}
          </h1>
          <p>Vos paiements d&apos;abonnements et d&apos;achats unitaires.</p>
        </header>

        <div className="opt-history__toolbar">
          <label className="opt-history__search">
            <Search size={16} strokeWidth={2.25} aria-hidden />
            <input
              type="search"
              placeholder="Rechercher (réf., formule, magazine…)"
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
              autoComplete="off"
            />
            {filters.q ? (
              <button
                type="button"
                className="opt-history__search-clear"
                aria-label="Effacer la recherche"
                onClick={() => setFilters((prev) => ({ ...prev, q: "" }))}
              >
                <X size={14} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </label>

          <div className="opt-history__filters">
            <select
              aria-label="Filtrer par statut"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="">Tous les statuts</option>
              <option value="SUCCESS">Payé</option>
              <option value="PENDING">En attente</option>
              <option value="FAILED">Échoué</option>
              <option value="CANCELLED">Annulé</option>
              <option value="REFUNDED">Remboursé</option>
            </select>

            <select
              aria-label="Filtrer par moyen de paiement"
              value={filters.provider}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, provider: e.target.value }))
              }
            >
              <option value="">Tous les moyens</option>
              <option value="STRIPE">Carte</option>
              <option value="FLEXPAIE">Mobile Money</option>
              <option value="LEGACY">Legacy</option>
            </select>

            <select
              aria-label="Filtrer par type"
              value={filters.purpose}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, purpose: e.target.value }))
              }
            >
              <option value="">Tous les types</option>
              <option value="SUBSCRIPTION">Abonnement</option>
              <option value="PURCHASE">Achat magazine</option>
            </select>

            {hasActiveFilters ? (
              <button
                type="button"
                className="opt-history__reset"
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
          <p className="opt-history__loading">Chargement…</p>
        ) : null}

        {!loading && !error && payments.length === 0 ? (
          <div className="opt-account__empty">
            <Receipt size={28} strokeWidth={1.75} aria-hidden />
            <h2>
              {hasActiveFilters ? "Aucun résultat" : "Aucun paiement"}
            </h2>
            <p>
              {hasActiveFilters
                ? "Aucun paiement ne correspond à votre recherche ou à vos filtres."
                : "Les transactions carte et Mobile Money apparaîtront ici une fois effectuées."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="opt-history__reset opt-history__reset--block"
                onClick={clearFilters}
                style={{ marginTop: "1rem" }}
              >
                Réinitialiser les filtres
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && payments.length > 0 ? (
          <>
            <ul className="opt-history">
              {payments.map((p) => {
                const badge = statusBadge(p.status);
                const isPurchase = p.purpose === "PURCHASE";
                const isMomo = p.provider === "FLEXPAIE";
                const ref = shortenRef(p.providerRef);
                const open = expandedId === p.id;
                const iconClass = isMomo
                  ? "opt-history__icon--momo"
                  : isPurchase
                    ? "opt-history__icon--buy"
                    : "opt-history__icon--sub";
                const details = metaEntries(p.metadata);
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "opt-history__item",
                      open && "opt-history__item--open",
                    )}
                  >
                    <button
                      type="button"
                      className="opt-history__row"
                      aria-expanded={open}
                      onClick={() => toggleDetails(p.id)}
                    >
                      <div
                        className={`opt-history__icon ${iconClass}`}
                        aria-hidden
                      >
                        {isMomo ? (
                          <Smartphone size={16} strokeWidth={2} />
                        ) : isPurchase ? (
                          <ShoppingBag size={16} strokeWidth={2} />
                        ) : (
                          <CreditCard size={16} strokeWidth={2} />
                        )}
                      </div>
                      <div className="opt-history__body">
                        <h3 className="opt-history__title">{p.label}</h3>
                        <p className="opt-history__meta">
                          <span>{formatDate(p.createdAt)}</span>
                          <span className="opt-history__provider">
                            {providerLabel(p.provider)}
                          </span>
                          {ref ? (
                            <span
                              className="opt-history__ref"
                              title={p.providerRef ?? undefined}
                            >
                              {ref}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <p className="opt-history__amount">
                        {formatMoney(p.amountCents, p.currency)}
                      </p>
                      <span
                        className={`opt-history__status ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span
                        className={cn(
                          "opt-history__chevron",
                          open && "is-open",
                        )}
                        aria-hidden
                      >
                        <ChevronDown size={18} strokeWidth={2.25} />
                      </span>
                    </button>

                    {open ? (
                      <div className="opt-history__details">
                        <dl className="opt-history__dl">
                          <div>
                            <dt>Type</dt>
                            <dd>{purposeLabel(p.purpose)}</dd>
                          </div>
                          <div>
                            <dt>Statut</dt>
                            <dd>{statusLabel(p.status)}</dd>
                          </div>
                          <div>
                            <dt>Moyen</dt>
                            <dd>{providerLabel(p.provider)}</dd>
                          </div>
                          <div>
                            <dt>Montant</dt>
                            <dd>
                              {formatMoney(p.amountCents, p.currency)}
                            </dd>
                          </div>
                          {p.planName ? (
                            <div>
                              <dt>Formule</dt>
                              <dd>{p.planName}</dd>
                            </div>
                          ) : null}
                          {p.magazineTitle ? (
                            <div>
                              <dt>Magazine</dt>
                              <dd>
                                {p.magazineTitle}
                                {p.magazineIssue
                                  ? ` (#${p.magazineIssue})`
                                  : ""}
                              </dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>Créé le</dt>
                            <dd>{formatDate(p.createdAt)}</dd>
                          </div>
                          {p.updatedAt ? (
                            <div>
                              <dt>Mis à jour</dt>
                              <dd>{formatDate(p.updatedAt)}</dd>
                            </div>
                          ) : null}
                          <div className="opt-history__dl-wide">
                            <dt>Référence</dt>
                            <dd>
                              {p.providerRef ? (
                                <span className="opt-history__ref-full">
                                  <code>{p.providerRef}</code>
                                  <button
                                    type="button"
                                    className="opt-history__copy"
                                    aria-label="Copier la référence"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void copyRef(p.providerRef!);
                                    }}
                                  >
                                    <Copy size={14} strokeWidth={2.25} />
                                  </button>
                                </span>
                              ) : (
                                "—"
                              )}
                            </dd>
                          </div>
                          <div className="opt-history__dl-wide">
                            <dt>ID interne</dt>
                            <dd>
                              <code className="opt-history__code">{p.id}</code>
                            </dd>
                          </div>
                          {details.map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {total > PAGE_SIZE ? (
              <div className="opt-history__pager">
                <p className="opt-history__pager-summary">
                  <strong>
                    {from}–{to}
                  </strong>{" "}
                  sur <strong>{total}</strong>
                </p>
                <nav
                  className="opt-history__pager-nav"
                  aria-label="Pagination"
                >
                  <button
                    type="button"
                    className="opt-history__pager-btn"
                    disabled={current <= 1}
                    aria-label="Première page"
                    title="Première page"
                    onClick={() => goToPage(1)}
                  >
                    <ChevronsLeft size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-history__pager-btn"
                    disabled={current <= 1}
                    aria-label="Page précédente"
                    title="Précédent"
                    onClick={() => goToPage(current - 1)}
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>

                  <div className="opt-history__pager-pages">
                    {buildPageItems(current, pageCount).map((item, i) =>
                      item === "…" ? (
                        <span
                          key={`e-${i}`}
                          className="opt-history__pager-ellipsis"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          className={cn(
                            "opt-history__pager-num",
                            item === current &&
                              "opt-history__pager-num--active",
                          )}
                          aria-label={`Page ${item}`}
                          aria-current={
                            item === current ? "page" : undefined
                          }
                          onClick={() => goToPage(item)}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    className="opt-history__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Page suivante"
                    title="Suivant"
                    onClick={() => goToPage(current + 1)}
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="opt-history__pager-btn"
                    disabled={current >= pageCount}
                    aria-label="Dernière page"
                    title="Dernière page"
                    onClick={() => goToPage(pageCount)}
                  >
                    <ChevronsRight size={16} aria-hidden />
                  </button>
                </nav>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

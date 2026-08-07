"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Ban, Pencil, ShieldCheck } from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";
import { Alert } from "@/components/ui/alert";
import {
  adminSubscribersApi,
  type AdminSubscriber,
  type AdminSubscriberSummary,
  type PaymentStatusName,
  type SubscriptionStatusName,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TAKE = 10;

const STATUS_LABEL: Record<SubscriptionStatusName, string> = {
  ACTIVE: "Actif",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
};

const PAYMENT_LABEL: Record<PaymentStatusName, string> = {
  PENDING: "En attente",
  SUCCESS: "Payé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatWhenFull(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: "#02d0d1", fg: "#041512" },
  { bg: "#5b7cfa", fg: "#ffffff" },
  { bg: "#f97366", fg: "#ffffff" },
  { bg: "#10b981", fg: "#ffffff" },
  { bg: "#f59e0b", fg: "#1a1408" },
  { bg: "#8b5cf6", fg: "#ffffff" },
  { bg: "#ec4899", fg: "#ffffff" },
  { bg: "#06b6d4", fg: "#041512" },
  { bg: "#84cc16", fg: "#14200a" },
  { bg: "#f43f5e", fg: "#ffffff" },
  { bg: "#6366f1", fg: "#ffffff" },
  { bg: "#14b8a6", fg: "#041512" },
] as const;

function avatarTone(seed: string): (typeof AVATAR_PALETTE)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

function SubscriberAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(avatarUrl) && !broken;
  const tone = avatarTone(name.trim().toLowerCase() || "?");

  return (
    <span
      className={cn(
        "admin-sub__avatar",
        size === "lg" && "admin-sub__avatar--lg",
      )}
      style={showImg ? undefined : { background: tone.bg, color: tone.fg }}
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- legacy / CDN avatars
        <img src={avatarUrl!} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="admin-sub__avatar-fallback">{initials(name)}</span>
      )}
    </span>
  );
}

type EditForm = {
  name: string;
  email: string;
  phone: string;
  country: string;
  countryCode: string;
  address: string;
};

function formFromSubscriber(row: AdminSubscriber): EditForm {
  return {
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    country: row.country ?? "",
    countryCode: row.countryCode ?? "",
    address: row.address ?? "",
  };
}

export default function AdminSubscribersPage() {
  return (
    <Suspense
      fallback={
        <header className="admin-dash__header">
          <div>
            <h1>Abonnés</h1>
            <p>Chargement…</p>
          </div>
        </header>
      }
    >
      <AdminSubscribersPageInner />
    </Suspense>
  );
}

function AdminSubscribersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modalId = searchParams.get("id");
  const detailOpen = Boolean(modalId);

  const [items, setItems] = useState<AdminSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminSubscriberSummary | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [active, setActive] = useState("");
  const [verified, setVerified] = useState("");
  const [subscription, setSubscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSubscriber | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const restoredId = useRef<string | null>(null);

  function setDetailUrl(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!id) params.delete("id");
    else params.set("id", id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function closeDetail() {
    if (saving) return;
    restoredId.current = null;
    setDetail(null);
    setEditForm(null);
    setDetailUrl(null);
  }

  function openDetail(row: AdminSubscriber) {
    restoredId.current = row.id;
    setDetail(row);
    setEditForm(formFromSubscriber(row));
    setDetailUrl(row.id);
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminSubscribersApi.list({
        q,
        active: active || undefined,
        verified: verified || undefined,
        subscription: subscription || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [q, active, verified, subscription, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modalId) {
      setDetail(null);
      setEditForm(null);
      restoredId.current = null;
      return;
    }
    if (restoredId.current === modalId && detail?.id === modalId) return;

    let cancelled = false;
    setModalLoading(true);
    restoredId.current = modalId;
    void adminSubscribersApi
      .get(modalId)
      .then((row) => {
        if (cancelled) return;
        setDetail(row);
        setEditForm(formFromSubscriber(row));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Abonné introuvable");
        restoredId.current = null;
        setDetailUrl(null);
      })
      .finally(() => {
        if (!cancelled) setModalLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL id only
  }, [modalId]);

  async function patch(
    id: string,
    input: Parameters<typeof adminSubscribersApi.update>[1],
    successMessage: string,
  ) {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const updated = await adminSubscribersApi.update(id, input);
      setDetail((prev) => (prev?.id === id ? updated : prev));
      if (restoredId.current === id) {
        setEditForm(formFromSubscriber(updated));
      }
      setOk(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!detail || !editForm) return;
    await patch(
      detail.id,
      {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        country: editForm.country.trim() || null,
        countryCode: editForm.countryCode.trim() || null,
        address: editForm.address.trim() || null,
      },
      "Profil abonné mis à jour",
    );
  }

  async function toggleBlock(row: AdminSubscriber) {
    if (row.isActive) {
      const okConfirm = window.confirm(
        `Bloquer « ${row.name} » ?\nCe compte ne pourra plus se connecter.`,
      );
      if (!okConfirm) return;
    }
    await patch(
      row.id,
      { isActive: !row.isActive },
      row.isActive ? "Abonné bloqué" : "Abonné débloqué",
    );
  }

  const formDirty =
    Boolean(detail && editForm) &&
    (editForm!.name !== detail!.name ||
      editForm!.email !== detail!.email ||
      editForm!.phone !== (detail!.phone ?? "") ||
      editForm!.country !== (detail!.country ?? "") ||
      editForm!.countryCode !== (detail!.countryCode ?? "") ||
      editForm!.address !== (detail!.address ?? ""));

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Abonnés</h1>
          <p>
            Comptes inscrits ({total} résultat{total > 1 ? "s" : ""}
            {summary ? ` · ${summary.total} au total` : ""}).
          </p>
        </div>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques abonnés"
          style={{ ["--kpi-count" as string]: "5" }}
        >
          {(
            [
              {
                key: "total",
                label: "Total",
                value: formatCount(summary.total),
                color: "teal" as const,
                active: !active && !verified && !subscription,
                onSelect: () => {
                  setSkip(0);
                  setActive("");
                  setVerified("");
                  setSubscription("");
                },
              },
              {
                key: "active",
                label: "Actifs",
                value: formatCount(summary.active),
                color: "green" as const,
                active: active === "true" && !verified && !subscription,
                onSelect: () => {
                  setSkip(0);
                  setActive("true");
                  setVerified("");
                  setSubscription("");
                },
              },
              {
                key: "inactive",
                label: "Bloqués",
                value: formatCount(summary.inactive),
                color: "coral" as const,
                active: active === "false" && !verified && !subscription,
                onSelect: () => {
                  setSkip(0);
                  setActive("false");
                  setVerified("");
                  setSubscription("");
                },
              },
              {
                key: "verified",
                label: "Email vérifié",
                value: formatCount(summary.verified),
                color: "blue" as const,
                active: verified === "true" && !active && !subscription,
                onSelect: () => {
                  setSkip(0);
                  setActive("");
                  setVerified("true");
                  setSubscription("");
                },
              },
              {
                key: "live",
                label: "Abo en cours",
                value: formatCount(summary.withLiveSub),
                color: "violet" as const,
                active: subscription === "LIVE" && !active && !verified,
                onSelect: () => {
                  setSkip(0);
                  setActive("");
                  setVerified("");
                  setSubscription("LIVE");
                },
              },
            ] as const
          ).map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
              aria-pressed={card.active}
              className={cn(
                "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
                `admin-dash__kpi-vivid--${card.color}`,
                card.active && "admin-dash__kpi-vivid--active",
              )}
              onClick={card.onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  card.onSelect();
                }
              }}
            >
              <p className="snow-dash__kpi-label">{card.label}</p>
              <p className="snow-dash__kpi-value">{card.value}</p>
            </article>
          ))}
        </section>
      ) : null}

      <div className="admin-dash__filters">
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setSkip(0);
              setQ(e.target.value);
            }}
            placeholder="nom, email, téléphone, code…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Compte</span>
          <select
            value={active}
            onChange={(e) => {
              setSkip(0);
              setActive(e.target.value);
            }}
            aria-label="Statut compte"
          >
            <option value="">Tous</option>
            <option value="true">Actif</option>
            <option value="false">Bloqué</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Email</span>
          <select
            value={verified}
            onChange={(e) => {
              setSkip(0);
              setVerified(e.target.value);
            }}
            aria-label="Vérification email"
          >
            <option value="">Tous</option>
            <option value="true">Vérifié</option>
            <option value="false">Non vérifié</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Abonnement</span>
          <select
            value={subscription}
            onChange={(e) => {
              setSkip(0);
              setSubscription(e.target.value);
            }}
            aria-label="Abonnement en cours"
          >
            <option value="">Tous</option>
            <option value="LIVE">En cours</option>
            <option value="NONE">Sans abo en cours</option>
          </select>
        </label>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={() => void load()}
        >
          Filtrer
        </button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {ok ? <Alert variant="success">{ok}</Alert> : null}

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Abonné</th>
              <th>Contact</th>
              <th>Compte</th>
              <th>Abonnement</th>
              <th>Inscrit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-dash__muted">
                  Aucun abonné.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="admin-dash__table-row--click"
                  onClick={() => openDetail(row)}
                >
                  <td>
                    <div className="admin-sub__user">
                      <SubscriberAvatar
                        name={row.name}
                        avatarUrl={row.avatarUrl}
                      />
                      <div className="admin-sub__user-meta">
                        <strong>{row.name}</strong>
                        <span className="admin-dash__muted">
                          {row.subscriberCode
                            ? `#${row.subscriberCode}`
                            : row.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.email}
                    <br />
                    <span className="admin-dash__muted">
                      {row.phone || row.country || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        row.isActive
                          ? "admin-mag__badge admin-mag__badge--on"
                          : "admin-mag__badge admin-mag__badge--off"
                      }
                    >
                      {row.isActive ? "Actif" : "Bloqué"}
                    </span>
                    <br />
                    <span className="admin-dash__muted">
                      {row.emailVerified ? "Email OK" : "Email non vérifié"}
                    </span>
                  </td>
                  <td>
                    {row.liveSubscription ? (
                      <>
                        <span className="admin-mag__badge admin-mag__badge--on">
                          En cours
                        </span>
                        <br />
                        <span className="admin-dash__muted">
                          {row.liveSubscription.plan.name} →{" "}
                          {formatWhen(row.liveSubscription.expiresAt)}
                        </span>
                      </>
                    ) : (
                      <span className="admin-dash__muted">Aucun</span>
                    )}
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td>
                    <div
                      className="admin-sub__plan-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        title="Modifier"
                        aria-label={`Modifier ${row.name}`}
                        disabled={saving}
                        onClick={() => openDetail(row)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "admin-dash__icon-action",
                          row.isActive
                            ? "admin-dash__icon-action--disable"
                            : "admin-dash__icon-action--enable",
                        )}
                        title={row.isActive ? "Bloquer" : "Débloquer"}
                        aria-label={
                          row.isActive
                            ? `Bloquer ${row.name}`
                            : `Débloquer ${row.name}`
                        }
                        disabled={saving}
                        onClick={() => void toggleBlock(row)}
                      >
                        {row.isActive ? (
                          <Ban size={16} />
                        ) : (
                          <ShieldCheck size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-dash__actions" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="admin-dash__btn"
          disabled={skip <= 0}
          onClick={() => setSkip((s) => Math.max(0, s - TAKE))}
        >
          Précédent
        </button>
        <span className="admin-dash__muted">
          {total === 0
            ? "0"
            : `${skip + 1}–${Math.min(skip + TAKE, total)}`}{" "}
          / {total}
        </span>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          disabled={skip + TAKE >= total}
          onClick={() => setSkip((s) => s + TAKE)}
        >
          Suivant
        </button>
      </div>

      <AdminModal
        open={detailOpen}
        title="Fiche abonné"
        wide
        onClose={closeDetail}
      >
        {modalLoading && !detail ? (
          <p className="admin-dash__muted">Chargement…</p>
        ) : detail && editForm ? (
          <div className="admin-sub-detail">
            <div className="admin-activity-detail">
              <div className="admin-activity-detail__row">
                <span>Identité</span>
                <div className="admin-sub__user admin-sub__user--detail">
                  <SubscriberAvatar
                    name={detail.name}
                    avatarUrl={detail.avatarUrl}
                    size="lg"
                  />
                  <strong>
                    {detail.name}
                    <br />
                    <span className="admin-dash__muted">
                      {detail.subscriberCode
                        ? `Code ${detail.subscriberCode}`
                        : detail.id}
                    </span>
                  </strong>
                </div>
              </div>
              <div className="admin-activity-detail__row">
                <span>Accès</span>
                <strong>
                  <span
                    className={
                      detail.isActive
                        ? "admin-mag__badge admin-mag__badge--on"
                        : "admin-mag__badge admin-mag__badge--off"
                    }
                  >
                    {detail.isActive ? "Actif" : "Bloqué"}
                  </span>{" "}
                  <span
                    className={
                      detail.emailVerified
                        ? "admin-mag__badge admin-mag__badge--on"
                        : "admin-mag__badge admin-sub__badge--pending"
                    }
                  >
                    {detail.emailVerified
                      ? "Email vérifié"
                      : "Email non vérifié"}
                  </span>
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Inscription</span>
                <strong>
                  {formatWhenFull(detail.createdAt)} · MAJ{" "}
                  {formatWhenFull(detail.updatedAt)}
                </strong>
              </div>
            </div>

            <h3 style={{ margin: "1.25rem 0 0.75rem", fontSize: "1rem" }}>
              Modifier le profil
            </h3>
            <div className="admin-dash__form">
              <label className="admin-dash__field">
                <span>Nom</span>
                <input
                  value={editForm.name}
                  disabled={saving}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, name: e.target.value } : f))
                  }
                />
              </label>
              <label className="admin-dash__field">
                <span>Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  disabled={saving}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, email: e.target.value } : f,
                    )
                  }
                />
              </label>
              <label className="admin-dash__field">
                <span>Téléphone</span>
                <input
                  value={editForm.phone}
                  disabled={saving}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, phone: e.target.value } : f,
                    )
                  }
                />
              </label>
              <div className="admin-dash__form-grid">
                <label className="admin-dash__field">
                  <span>Pays</span>
                  <input
                    value={editForm.country}
                    disabled={saving}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, country: e.target.value } : f,
                      )
                    }
                  />
                </label>
                <label className="admin-dash__field">
                  <span>Code pays</span>
                  <input
                    value={editForm.countryCode}
                    disabled={saving}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, countryCode: e.target.value } : f,
                      )
                    }
                  />
                </label>
              </div>
              <label className="admin-dash__field">
                <span>Adresse</span>
                <input
                  value={editForm.address}
                  disabled={saving}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, address: e.target.value } : f,
                    )
                  }
                />
              </label>
            </div>

            <div className="admin-sub-detail__actions">
              <button
                type="button"
                className="admin-dash__btn admin-dash__btn--primary"
                disabled={saving || !formDirty}
                onClick={() => void saveProfile()}
              >
                Enregistrer les modifications
              </button>
              <button
                type="button"
                className={cn(
                  "admin-dash__btn",
                  detail.isActive && "admin-dash__btn--danger",
                )}
                disabled={saving}
                onClick={() => void toggleBlock(detail)}
              >
                {detail.isActive ? (
                  <>
                    <Ban size={16} aria-hidden /> Bloquer le compte
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} aria-hidden /> Débloquer le compte
                  </>
                )}
              </button>
            </div>

            {!detail.isActive ? (
              <p className="admin-dash__muted" style={{ marginTop: "0.75rem" }}>
                Ce compte est bloqué : l’abonné ne peut plus se connecter.
              </p>
            ) : null}

            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
                Abonnements
              </h3>
              {detail.subscriptions.length === 0 ? (
                <p className="admin-dash__muted">Aucun abonnement.</p>
              ) : (
                <ul className="admin-dash__feed">
                  {detail.subscriptions.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/admin/abonnements?id=${encodeURIComponent(sub.id)}`}
                        className="admin-dash__feed-item"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="admin-dash__feed-main">
                          <strong>{sub.plan.name}</strong>
                          <span>
                            {formatMoney(sub.plan.priceCents, sub.plan.currency)}{" "}
                            · {PAYMENT_LABEL[sub.paymentStatus]}
                          </span>
                        </span>
                        <span className="admin-dash__feed-meta">
                          <strong>
                            {sub.isLive
                              ? "En cours"
                              : STATUS_LABEL[sub.status]}
                          </strong>
                          <span>
                            {formatWhen(sub.startsAt)} →{" "}
                            {formatWhen(sub.expiresAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, Clock3, Pencil, Plus, Power, PowerOff, RefreshCw } from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";
import { Alert } from "@/components/ui/alert";
import {
  adminPlansApi,
  adminSubscriptionsApi,
  type AdminPlan,
  type AdminSubscription,
  type AdminSubscriptionSummary,
  type PaymentStatusName,
  type SubscriptionStatusName,
} from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

const TAKE = 10;

type PlanForm = {
  name: string;
  description: string;
  priceDollars: string;
  currency: string;
  durationDays: string;
  isActive: boolean;
};

const emptyPlanForm = (): PlanForm => ({
  name: "",
  description: "",
  priceDollars: "",
  currency: "USD",
  durationDays: "365",
  isActive: true,
});

function dollarsToCents(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function planFromAdmin(plan: AdminPlan): PlanForm {
  return {
    name: plan.name,
    description: plan.description ?? "",
    priceDollars: centsToDollars(plan.priceCents),
    currency: plan.currency || "USD",
    durationDays: String(plan.durationDays),
    isActive: plan.isActive,
  };
}

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
  { bg: "#0565ab", fg: "#041512" },
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
      style={
        showImg
          ? undefined
          : { background: tone.bg, color: tone.fg }
      }
      aria-hidden
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- legacy / CDN avatars
        <img
          src={avatarUrl!}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="admin-sub__avatar-fallback">{initials(name)}</span>
      )}
    </span>
  );
}

function statusBadgeClass(row: AdminSubscription): string {
  if (row.isLive) return "admin-mag__badge admin-mag__badge--on";
  if (row.status === "CANCELLED") return "admin-mag__badge admin-mag__badge--off";
  if (row.status === "EXPIRED" || new Date(row.expiresAt) <= new Date()) {
    return "admin-mag__badge admin-sub__badge--expired";
  }
  return "admin-mag__badge admin-sub__badge--pending";
}

function statusLabel(row: AdminSubscription): string {
  if (row.isLive) return "En cours";
  if (row.status === "CANCELLED") return "Annulé";
  if (row.status === "EXPIRED" || new Date(row.expiresAt) <= new Date()) {
    return "Expiré";
  }
  return STATUS_LABEL[row.status];
}

function paymentBadgeClass(status: PaymentStatusName): string {
  if (status === "SUCCESS") return "admin-mag__badge admin-mag__badge--on";
  if (status === "PENDING") return "admin-mag__badge admin-sub__badge--pending";
  return "admin-mag__badge admin-mag__badge--off";
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) router.replace("/admin");
  }, [router]);
  if (!SUBSCRIPTIONS_ENABLED) return null;

  return (
    <Suspense
      fallback={
        <header className="admin-dash__header">
          <div>
            <h1>Abonnements</h1>
            <p>Chargement…</p>
          </div>
        </header>
      }
    >
      <AdminSubscriptionsPageInner />
    </Suspense>
  );
}

function AdminSubscriptionsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modalId = searchParams.get("id");
  const detailOpen = Boolean(modalId);

  const [items, setItems] = useState<AdminSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminSubscriptionSummary | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSubscription | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [plansManagerOpen, setPlansManagerOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [planSaving, setPlanSaving] = useState(false);
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
    setDetailUrl(null);
  }

  function openDetail(row: AdminSubscription) {
    restoredId.current = row.id;
    setDetail(row);
    setDetailUrl(row.id);
  }

  const loadPlans = useCallback(async () => {
    try {
      const res = await adminPlansApi.list();
      setPlans(res.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur chargement formules",
      );
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminSubscriptionsApi.list({
        q,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [q, status, paymentStatus, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  function openPlansManager() {
    setPlansManagerOpen(true);
    void loadPlans();
  }

  function closePlansManager() {
    if (planSaving || planModalOpen) return;
    setPlansManagerOpen(false);
  }

  function openCreatePlan() {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm());
    setPlanModalOpen(true);
  }

  function openEditPlan(plan: AdminPlan) {
    setEditingPlanId(plan.id);
    setPlanForm(planFromAdmin(plan));
    setPlanModalOpen(true);
  }

  function closePlanModal() {
    if (planSaving) return;
    setPlanModalOpen(false);
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm());
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = dollarsToCents(planForm.priceDollars);
    if (priceCents == null) {
      setError("Prix invalide");
      return;
    }
    const durationDays = Number(planForm.durationDays);
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setError("Durée invalide (jours)");
      return;
    }

    setPlanSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim() || null,
        priceCents,
        currency: planForm.currency.trim().toUpperCase() || "USD",
        durationDays,
        isActive: planForm.isActive,
      };
      if (editingPlanId) {
        await adminPlansApi.update(editingPlanId, payload);
        setOk("Formule mise à jour");
      } else {
        await adminPlansApi.create(payload);
        setOk("Formule créée");
      }
      setPlanModalOpen(false);
      setEditingPlanId(null);
      setPlanForm(emptyPlanForm());
      setPlansManagerOpen(true);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec enregistrement formule");
    } finally {
      setPlanSaving(false);
    }
  }

  async function togglePlanActive(plan: AdminPlan) {
    setError(null);
    setOk(null);
    try {
      await adminPlansApi.update(plan.id, { isActive: !plan.isActive });
      setOk(
        plan.isActive ? "Formule désactivée" : "Formule activée",
      );
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec statut formule");
    }
  }

  useEffect(() => {
    if (!modalId) {
      setDetail(null);
      restoredId.current = null;
      return;
    }
    if (modalId === restoredId.current && detail?.id === modalId) return;
    restoredId.current = modalId;

    let cancelled = false;
    setModalLoading(true);
    void adminSubscriptionsApi
      .get(modalId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Abonnement introuvable",
        );
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
    input: Parameters<typeof adminSubscriptionsApi.update>[1],
    successMessage: string,
  ) {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const updated = await adminSubscriptionsApi.update(id, input);
      setDetail(updated);
      setOk(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec mise à jour");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Abonnements</h1>
          <p>
            Suivi des formules abonnés ({total} résultat
            {total > 1 ? "s" : ""}
            {summary ? ` · ${summary.total} au total` : ""}).
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={openPlansManager}
        >
          Formules ({plans.length})
        </button>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques abonnements"
          style={{ ["--kpi-count" as string]: "5" }}
        >
          {(
            [
              {
                key: "total",
                label: "Total",
                value: formatCount(summary.total),
                color: "teal" as const,
                active: !status && !paymentStatus,
                onSelect: () => {
                  setSkip(0);
                  setStatus("");
                  setPaymentStatus("");
                },
              },
              {
                key: "active",
                label: "En cours",
                value: formatCount(summary.activeNow),
                color: "green" as const,
                active: status === "ACTIVE_NOW" && !paymentStatus,
                onSelect: () => {
                  setSkip(0);
                  setStatus("ACTIVE_NOW");
                  setPaymentStatus("");
                },
              },
              {
                key: "pending",
                label: "En attente",
                value: formatCount(summary.pendingPayment),
                color: "gold" as const,
                active: !status && paymentStatus === "PENDING",
                onSelect: () => {
                  setSkip(0);
                  setStatus("");
                  setPaymentStatus("PENDING");
                },
              },
              {
                key: "expired",
                label: "Expirés",
                value: formatCount(summary.expired),
                color: "coral" as const,
                active: status === "EXPIRED" && !paymentStatus,
                onSelect: () => {
                  setSkip(0);
                  setStatus("EXPIRED");
                  setPaymentStatus("");
                },
              },
              {
                key: "cancelled",
                label: "Annulés",
                value: formatCount(summary.cancelled),
                color: "violet" as const,
                active: status === "CANCELLED" && !paymentStatus,
                onSelect: () => {
                  setSkip(0);
                  setStatus("CANCELLED");
                  setPaymentStatus("");
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
            placeholder="nom, email, formule, transaction…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={status}
            onChange={(e) => {
              setSkip(0);
              setStatus(e.target.value);
            }}
            aria-label="Statut abonnement"
          >
            <option value="">Tous</option>
            <option value="ACTIVE_NOW">En cours</option>
            <option value="ACTIVE">Actif (DB)</option>
            <option value="EXPIRED">Expiré</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Paiement</span>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setSkip(0);
              setPaymentStatus(e.target.value);
            }}
            aria-label="Statut paiement"
          >
            <option value="">Tous</option>
            <option value="SUCCESS">Payé</option>
            <option value="PENDING">En attente</option>
            <option value="FAILED">Échoué</option>
            <option value="CANCELLED">Annulé</option>
            <option value="REFUNDED">Remboursé</option>
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
              <th>Formule</th>
              <th>Statut</th>
              <th>Paiement</th>
              <th>Période</th>
              <th>Créé</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-dash__muted">
                  Aucun abonnement.
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
                        name={row.subscriber.name}
                        avatarUrl={row.subscriber.avatarUrl}
                      />
                      <div className="admin-sub__user-meta">
                        <strong>{row.subscriber.name}</strong>
                        <span className="admin-dash__muted">
                          {row.subscriber.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.plan.name}
                    <br />
                    <span className="admin-dash__muted">
                      {formatMoney(row.plan.priceCents, row.plan.currency)} ·{" "}
                      {row.plan.durationDays} j
                    </span>
                  </td>
                  <td>
                    <span className={statusBadgeClass(row)}>
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td>
                    <span className={paymentBadgeClass(row.paymentStatus)}>
                      {PAYMENT_LABEL[row.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    {formatWhen(row.startsAt)}
                    <br />
                    <span className="admin-dash__muted">
                      → {formatWhen(row.expiresAt)}
                    </span>
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.createdAt)}
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
        title="Détail abonnement"
        wide
        onClose={closeDetail}
      >
        {modalLoading && !detail ? (
          <p className="admin-dash__muted">Chargement…</p>
        ) : detail ? (
          <div className="admin-sub-detail">
            <div className="admin-activity-detail">
              <div className="admin-activity-detail__row">
                <span>Abonné</span>
                <div className="admin-sub__user admin-sub__user--detail">
                  <SubscriberAvatar
                    name={detail.subscriber.name}
                    avatarUrl={detail.subscriber.avatarUrl}
                    size="lg"
                  />
                  <strong>
                    {detail.subscriber.name}
                    <br />
                    <span className="admin-dash__muted">
                      {detail.subscriber.email}
                      {detail.subscriber.phone
                        ? ` · ${detail.subscriber.phone}`
                        : ""}
                    </span>
                  </strong>
                </div>
              </div>
              <div className="admin-activity-detail__row">
                <span>Formule</span>
                <strong>
                  {detail.plan.name} ·{" "}
                  {formatMoney(detail.plan.priceCents, detail.plan.currency)} ·{" "}
                  {detail.plan.durationDays} jours
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Statut</span>
                <strong>
                  <span className={statusBadgeClass(detail)}>
                    {statusLabel(detail)}
                  </span>
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Paiement</span>
                <strong>
                  <span className={paymentBadgeClass(detail.paymentStatus)}>
                    {PAYMENT_LABEL[detail.paymentStatus]}
                  </span>
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Période</span>
                <strong>
                  {formatWhenFull(detail.startsAt)} →{" "}
                  {formatWhenFull(detail.expiresAt)}
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Transaction</span>
                <strong className="admin-dash__mono">
                  {detail.transactionRef || "—"}
                </strong>
              </div>
              <div className="admin-activity-detail__row">
                <span>Créé / MAJ</span>
                <strong>
                  {formatWhenFull(detail.createdAt)} ·{" "}
                  {formatWhenFull(detail.updatedAt)}
                </strong>
              </div>
            </div>

            <div className="admin-sub-detail__actions">
              {detail.paymentStatus !== "SUCCESS" ? (
                <button
                  type="button"
                  className="admin-dash__btn admin-dash__btn--primary"
                  disabled={saving}
                  onClick={() =>
                    void patch(
                      detail.id,
                      {
                        paymentStatus: "SUCCESS",
                        status: "ACTIVE",
                      },
                      "Paiement marqué comme payé",
                    )
                  }
                >
                  <CheckCircle2 size={16} />
                  Valider le paiement
                </button>
              ) : null}

              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving}
                onClick={() =>
                  void patch(
                    detail.id,
                    { extendDays: 30, status: "ACTIVE" },
                    "Abonnement prolongé de 30 jours",
                  )
                }
              >
                <Clock3 size={16} />
                +30 jours
              </button>

              {!detail.isLive && detail.status !== "CANCELLED" ? (
                <button
                  type="button"
                  className="admin-dash__btn"
                  disabled={saving}
                  onClick={() =>
                    void patch(
                      detail.id,
                      {
                        status: "ACTIVE",
                        paymentStatus: "SUCCESS",
                        extendDays:
                          new Date(detail.expiresAt) <= new Date()
                            ? detail.plan.durationDays
                            : undefined,
                      },
                      "Abonnement réactivé",
                    )
                  }
                >
                  <RefreshCw size={16} />
                  Réactiver
                </button>
              ) : null}

              {detail.status !== "CANCELLED" ? (
                <button
                  type="button"
                  className="admin-dash__btn admin-dash__btn--danger"
                  disabled={saving}
                  onClick={() =>
                    void patch(
                      detail.id,
                      { status: "CANCELLED" },
                      "Abonnement annulé",
                    )
                  }
                >
                  <Ban size={16} />
                  Annuler
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={plansManagerOpen && !planModalOpen}
        title="Formules (prix & durée)"
        wide
        onClose={closePlansManager}
      >
        <div className="admin-sub__plans-modal">
          <div className="admin-sub__plans-modal-head">
            <p className="admin-dash__muted">
              {plans.length} formule{plans.length > 1 ? "s" : ""} · le prix et
              la durée s’appliquent aux nouvelles souscriptions.
            </p>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--primary"
              onClick={openCreatePlan}
            >
              <Plus size={16} />
              Nouvelle formule
            </button>
          </div>
          <div className="admin-dash__table-wrap">
            <table className="admin-dash__table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prix</th>
                  <th>Durée</th>
                  <th>Abonnés</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-dash__muted">
                      Aucune formule — créez-en une pour proposer un
                      abonnement.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                        {plan.description ? (
                          <>
                            <br />
                            <span className="admin-dash__muted admin-sub__plan-desc">
                              {plan.description}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td>{formatMoney(plan.priceCents, plan.currency)}</td>
                      <td>{plan.durationDays} jours</td>
                      <td>
                        <span className="admin-mag__badge">
                          {formatCount(plan.subscriptionsCount)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            plan.isActive
                              ? "admin-mag__badge admin-mag__badge--on"
                              : "admin-mag__badge admin-mag__badge--off"
                          }
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-sub__plan-actions">
                          <button
                            type="button"
                            className="admin-dash__icon-action admin-dash__icon-action--edit"
                            title="Modifier"
                            aria-label={`Modifier ${plan.name}`}
                            onClick={() => openEditPlan(plan)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className={
                              plan.isActive
                                ? "admin-dash__icon-action admin-dash__icon-action--disable"
                                : "admin-dash__icon-action admin-dash__icon-action--enable"
                            }
                            title={plan.isActive ? "Désactiver" : "Activer"}
                            aria-label={
                              plan.isActive
                                ? `Désactiver ${plan.name}`
                                : `Activer ${plan.name}`
                            }
                            onClick={() => void togglePlanActive(plan)}
                          >
                            {plan.isActive ? (
                              <PowerOff className="h-4 w-4" strokeWidth={2} />
                            ) : (
                              <Power className="h-4 w-4" strokeWidth={2} />
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
        </div>
      </AdminModal>

      <AdminModal
        open={planModalOpen}
        title={editingPlanId ? "Modifier la formule" : "Nouvelle formule"}
        onClose={closePlanModal}
      >
        <form className="admin-dash__form" onSubmit={(e) => void savePlan(e)}>
          <div className="admin-dash__form-grid">
            <label className="admin-dash__field admin-dash__field--full">
              <span>Nom</span>
              <input
                required
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm({ ...planForm, name: e.target.value })
                }
                placeholder="Premium"
              />
            </label>
            <label className="admin-dash__field admin-dash__field--full">
              <span>Description</span>
              <textarea
                rows={3}
                value={planForm.description}
                onChange={(e) =>
                  setPlanForm({ ...planForm, description: e.target.value })
                }
                placeholder="Accès illimité aux magazines premium…"
              />
            </label>
            <label className="admin-dash__field">
              <span>Prix</span>
              <input
                required
                inputMode="decimal"
                value={planForm.priceDollars}
                onChange={(e) =>
                  setPlanForm({ ...planForm, priceDollars: e.target.value })
                }
                placeholder="19.99"
              />
            </label>
            <label className="admin-dash__field">
              <span>Devise</span>
              <input
                required
                maxLength={8}
                value={planForm.currency}
                onChange={(e) =>
                  setPlanForm({ ...planForm, currency: e.target.value })
                }
                placeholder="USD"
              />
            </label>
            <label className="admin-dash__field">
              <span>Durée (jours)</span>
              <input
                required
                type="number"
                min={1}
                max={3650}
                value={planForm.durationDays}
                onChange={(e) =>
                  setPlanForm({ ...planForm, durationDays: e.target.value })
                }
              />
            </label>
            <label className="admin-dash__field">
              <span>Statut</span>
              <select
                value={planForm.isActive ? "1" : "0"}
                onChange={(e) =>
                  setPlanForm({
                    ...planForm,
                    isActive: e.target.value === "1",
                  })
                }
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="admin-dash__btn admin-dash__btn--primary admin-dash__btn--lg"
            disabled={planSaving}
          >
            {planSaving
              ? "Enregistrement…"
              : editingPlanId
                ? "Enregistrer"
                : "Créer"}
          </button>
        </form>
      </AdminModal>
    </>
  );
}

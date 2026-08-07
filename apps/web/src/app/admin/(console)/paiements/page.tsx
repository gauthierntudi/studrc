"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock3,
  CreditCard,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import { AdminDatePicker } from "@/components/admin/admin-date-picker";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { OtpBoxes } from "@/components/site/otp-boxes";
import {
  adminPaymentsApi,
  type AdminPaymentItem,
  type AdminPaymentSummary,
  type PaymentStatusName,
} from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const TAKE = 10;

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

function formatMoney(cents: number, currency = "USD"): string {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "STRIPE":
      return "Carte (Stripe)";
    case "FLEXPAIE":
      return "Mobile Money";
    case "LEGACY":
      return "Legacy";
    default:
      return provider;
  }
}

function purposeLabel(purpose: string): string {
  return purpose === "PURCHASE" ? "Achat" : "Abonnement";
}

function paymentBadgeClass(status: PaymentStatusName): string {
  if (status === "SUCCESS") return "admin-mag__badge admin-mag__badge--on";
  if (status === "PENDING") return "admin-mag__badge admin-sub__badge--pending";
  if (status === "REFUNDED") return "admin-mag__badge admin-sub__badge--expired";
  return "admin-mag__badge admin-mag__badge--off";
}

function shortenRef(ref: string | null): string {
  if (!ref) return "—";
  if (ref.length <= 22) return ref;
  return `${ref.slice(0, 10)}…${ref.slice(-6)}`;
}

function SubscriberCell({
  subscriber,
}: {
  subscriber: AdminPaymentItem["subscriber"];
}) {
  return (
    <div className="admin-sub__user">
      <span className="admin-sub__avatar" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(subscriber.avatarUrl)}
          alt=""
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = avatarLocalFallback(subscriber.avatarUrl);
          }}
        />
      </span>
      <div className="admin-sub__user-meta">
        <strong>{subscriber.name || "—"}</strong>
        <span className="admin-dash__muted">{subscriber.email}</span>
      </div>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const { admin } = useAdminAuth();
  const canForcePayment =
    admin?.role === "SUPERADMIN" || admin?.role === "ADMIN";

  const [items, setItems] = useState<AdminPaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminPaymentSummary | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [purpose, setPurpose] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<AdminPaymentItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editStatus, setEditStatus] = useState<PaymentStatusName>("PENDING");
  const [editNote, setEditNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [showOtherStatus, setShowOtherStatus] = useState(false);
  const [otpPendingStatus, setOtpPendingStatus] =
    useState<PaymentStatusName | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpMaskedEmail, setOtpMaskedEmail] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [confirmActivateOpen, setConfirmActivateOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setSkip(0);
  }, [debouncedQ]);

  const load = useCallback(async () => {
    try {
      const res = await adminPaymentsApi.list({
        take: TAKE,
        skip,
        q: debouncedQ || undefined,
        status: status || undefined,
        provider: provider || undefined,
        purpose: purpose || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [skip, debouncedQ, status, provider, purpose, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  function resetOtpStep() {
    setOtpPendingStatus(null);
    setOtpValue("");
    setOtpMaskedEmail("");
    setOtpError(false);
    setSendingOtp(false);
    setResendIn(0);
    setConfirmActivateOpen(false);
  }

  async function openDetail(id: string) {
    setLoadingDetail(true);
    try {
      const row = await adminPaymentsApi.get(id);
      setDetail(row);
      setEditStatus(row.status);
      setEditNote("");
      setShowOtherStatus(false);
      resetOtpStep();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Détail introuvable");
    } finally {
      setLoadingDetail(false);
    }
  }

  function applyUpdated(updated: AdminPaymentItem) {
    setDetail(updated);
    setEditStatus(updated.status);
    setEditNote("");
    setShowOtherStatus(false);
    resetOtpStep();
    setItems((prev) =>
      prev.map((row) => (row.id === updated.id ? updated : row)),
    );
  }

  async function requestOtp(nextStatus: PaymentStatusName) {
    if (!detail) return;
    if (nextStatus === detail.status) {
      toast.info("Aucun changement de statut.");
      return;
    }

    setSendingOtp(true);
    setOtpError(false);
    setConfirmActivateOpen(false);
    try {
      const res = await toast.promise(
        adminPaymentsApi.requestStatusOtp(detail.id, {
          status: nextStatus,
          note: editNote.trim() || undefined,
        }),
        {
          pending: "Envoi du code OTP…",
          success: "Code envoyé par e-mail",
          error: {
            render({ data }) {
              return data instanceof Error
                ? data.message
                : "Impossible d’envoyer le code";
            },
          },
        },
      );
      setOtpPendingStatus(nextStatus);
      setOtpMaskedEmail(res.maskedEmail);
      setOtpValue("");
      setResendIn(60);
    } catch {
      /* toast */
    } finally {
      setSendingOtp(false);
    }
  }

  async function confirmWithOtp() {
    if (!detail || !otpPendingStatus) return;
    if (!/^\d{6}$/.test(otpValue)) {
      setOtpError(true);
      toast.error("Saisissez le code OTP à 6 chiffres.");
      return;
    }

    setSavingStatus(true);
    setOtpError(false);
    try {
      const updated = await toast.promise(
        adminPaymentsApi.updateStatus(detail.id, {
          status: otpPendingStatus,
          note: editNote.trim() || undefined,
          otp: otpValue,
        }),
        {
          pending: "Vérification du code…",
          success:
            otpPendingStatus === "SUCCESS"
              ? "Paiement activé — accès accordé"
              : "Statut mis à jour",
          error: {
            render({ data }) {
              return data instanceof Error
                ? data.message
                : "Impossible de confirmer";
            },
          },
        },
      );
      applyUpdated(updated);
      void load();
    } catch {
      setOtpError(true);
    } finally {
      setSavingStatus(false);
    }
  }

  const volumeLabel = summary
    ? formatMoney(summary.volumePaidCents, "USD")
    : "—";

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Historique paiements</h1>
          <p>
            Journal des transactions ({formatCount(total)} résultat
            {total > 1 ? "s" : ""}).
          </p>
        </div>
        <div className="admin-dash__header-actions">
          <AdminDatePicker
            label="Du"
            value={from}
            max={to || undefined}
            onChange={(next) => {
              setSkip(0);
              setFrom(next);
            }}
          />
          <AdminDatePicker
            label="Au"
            value={to}
            min={from || undefined}
            onChange={(next) => {
              setSkip(0);
              setTo(next);
            }}
          />
          <button
            type="button"
            className="admin-dash__btn"
            onClick={() => void load()}
          >
            <RefreshCw size={15} strokeWidth={2} aria-hidden />
            Actualiser
          </button>
        </div>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques paiements"
          style={{ ["--kpi-count" as string]: "5" }}
        >
          {(
            [
              {
                key: "total",
                label: "Total",
                value: formatCount(summary.total),
                color: "teal",
                icon: Receipt,
                active: status === "",
                onSelect: () => {
                  setSkip(0);
                  setStatus("");
                },
              },
              {
                key: "success",
                label: "Payés",
                value: formatCount(summary.success),
                color: "green",
                icon: CheckCircle2,
                active: status === "SUCCESS",
                onSelect: () => {
                  setSkip(0);
                  setStatus("SUCCESS");
                },
              },
              {
                key: "pending",
                label: "En attente",
                value: formatCount(summary.pending),
                color: "gold",
                icon: Clock3,
                active: status === "PENDING",
                onSelect: () => {
                  setSkip(0);
                  setStatus("PENDING");
                },
              },
              {
                key: "failed",
                label: "Échoués",
                value: formatCount(summary.failed),
                color: "coral",
                icon: Ban,
                active: status === "FAILED",
                onSelect: () => {
                  setSkip(0);
                  setStatus("FAILED");
                },
              },
              {
                key: "volume",
                label: "Volume encaissé",
                value: volumeLabel,
                color: "violet",
                icon: CreditCard,
                active: false,
                onSelect: () => {
                  setSkip(0);
                  setStatus("SUCCESS");
                },
              },
            ] as const
          ).map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
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
              <p className="snow-dash__kpi-label">
                <card.icon size={14} strokeWidth={2} aria-hidden /> {card.label}
              </p>
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
            onChange={(e) => setQ(e.target.value)}
            placeholder="nom, e-mail, réf., plan…"
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
            aria-label="Statut du paiement"
          >
            <option value="">Tous</option>
            <option value="SUCCESS">Payé</option>
            <option value="PENDING">En attente</option>
            <option value="FAILED">Échoué</option>
            <option value="CANCELLED">Annulé</option>
            <option value="REFUNDED">Remboursé</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Moyen</span>
          <select
            value={provider}
            onChange={(e) => {
              setSkip(0);
              setProvider(e.target.value);
            }}
            aria-label="Moyen de paiement"
          >
            <option value="">Tous</option>
            <option value="STRIPE">Carte (Stripe)</option>
            <option value="FLEXPAIE">Mobile Money</option>
            <option value="LEGACY">Legacy</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Type</span>
          <select
            value={purpose}
            onChange={(e) => {
              setSkip(0);
              setPurpose(e.target.value);
            }}
            aria-label="Type de paiement"
          >
            <option value="">Tous</option>
            <option value="SUBSCRIPTION">Abonnement</option>
            <option value="PURCHASE">Achat magazine</option>
          </select>
        </label>
      </div>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Abonné</th>
              <th>Libellé</th>
              <th>Moyen</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Réf.</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-dash__muted">
                  Aucun paiement.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="admin-dash__table-row--click"
                  onClick={() => void openDetail(row.id)}
                >
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <SubscriberCell subscriber={row.subscriber} />
                  </td>
                  <td>
                    <div className="admin-sub__user-meta">
                      <strong>{row.label}</strong>
                      <span className="admin-dash__muted">
                        {purposeLabel(row.purpose)}
                      </span>
                    </div>
                  </td>
                  <td>{providerLabel(row.provider)}</td>
                  <td className="admin-dash__mono">
                    {formatMoney(row.amountCents, row.currency)}
                  </td>
                  <td>
                    <span className={paymentBadgeClass(row.status)}>
                      {PAYMENT_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="admin-dash__mono admin-dash__muted">
                    {shortenRef(row.providerRef)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        total={total}
        take={TAKE}
        skip={skip}
        onSkipChange={setSkip}
      />

      <AdminModal
        open={Boolean(detail) || loadingDetail}
        title="Détail du paiement"
        onClose={() => {
          setDetail(null);
          setConfirmActivateOpen(false);
          resetOtpStep();
        }}
      >
        {loadingDetail && !detail ? (
          <p className="admin-dash__muted">Chargement…</p>
        ) : detail ? (
          <div className="admin-activity-detail">
            <div className="admin-activity-detail__row">
              <span>Date</span>
              <strong>{formatWhen(detail.createdAt)}</strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Abonné</span>
              <div className="admin-sub__user admin-sub__user--detail">
                <span className="admin-sub__avatar admin-sub__avatar--lg" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc(detail.subscriber.avatarUrl)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = avatarLocalFallback(
                        detail.subscriber.avatarUrl,
                      );
                    }}
                  />
                </span>
                <div className="admin-sub__user-meta">
                  <strong>{detail.subscriber.name}</strong>
                  <span className="admin-dash__muted">
                    {detail.subscriber.email}
                  </span>
                </div>
              </div>
            </div>
            <div className="admin-activity-detail__row">
              <span>Libellé</span>
              <strong>{detail.label}</strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Type</span>
              <strong>
                {detail.purpose === "PURCHASE" ? (
                  <>
                    <ShoppingBag size={14} strokeWidth={2} aria-hidden /> Achat
                    magazine
                  </>
                ) : (
                  <>
                    <CreditCard size={14} strokeWidth={2} aria-hidden />{" "}
                    Abonnement
                  </>
                )}
              </strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Montant</span>
              <strong>
                {formatMoney(detail.amountCents, detail.currency)}
              </strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Moyen</span>
              <strong>{providerLabel(detail.provider)}</strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Référence</span>
              <code className="admin-dash__mono">
                {detail.providerRef || "—"}
              </code>
            </div>
            <div className="admin-activity-detail__row">
              <span>ID interne</span>
              <code className="admin-dash__mono">{detail.id}</code>
            </div>

            <section
              className={cn(
                "admin-payment-status",
                detail.status === "SUCCESS" && "is-success",
                detail.status === "PENDING" && "is-pending",
                (detail.status === "FAILED" ||
                  detail.status === "CANCELLED") &&
                  "is-fail",
              )}
              aria-label="Statut du paiement"
            >
              <header className="admin-payment-status__head">
                <div>
                  <p className="admin-payment-status__label">Statut</p>
                  <span className={paymentBadgeClass(detail.status)}>
                    {PAYMENT_LABEL[detail.status] ?? detail.status}
                  </span>
                </div>
                {detail.metadata?.adminForced ? (
                  <span className="admin-payment-status__forced">
                    Activé manuellement
                  </span>
                ) : null}
              </header>

              {canForcePayment && detail.status === "SUCCESS" ? (
                <p className="admin-payment-status__locked">
                  Paiement confirmé — la rétrogradation est interdite.
                </p>
              ) : null}

              {canForcePayment && detail.status !== "SUCCESS" ? (
                <div className="admin-payment-force">
                  <div className="admin-payment-force__banner">
                    <ShieldAlert size={16} strokeWidth={2} aria-hidden />
                    <div>
                      <strong>Assistance urgence</strong>
                      <p>
                        Activation manuelle d’urgence — confirmation OTP
                        requise.
                      </p>
                    </div>
                  </div>

                  {otpPendingStatus ? (
                    <div className="admin-payment-otp">
                      <p className="admin-payment-otp__text">
                        Code envoyé à <strong>{otpMaskedEmail}</strong>
                        {otpPendingStatus === "SUCCESS"
                          ? " pour activer ce paiement."
                          : ` pour passer en « ${PAYMENT_LABEL[otpPendingStatus]} ».`}
                      </p>
                      <OtpBoxes
                        value={otpValue}
                        onChange={(next) => {
                          setOtpError(false);
                          setOtpValue(next);
                        }}
                        disabled={savingStatus || sendingOtp}
                        hasError={otpError}
                      />
                      <div className="admin-payment-otp__actions">
                        <button
                          type="button"
                          className="admin-dash__btn admin-dash__btn--primary"
                          disabled={
                            savingStatus ||
                            sendingOtp ||
                            otpValue.length !== 6
                          }
                          onClick={() => void confirmWithOtp()}
                        >
                          <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
                          {savingStatus ? "Confirmation…" : "Confirmer"}
                        </button>
                        <button
                          type="button"
                          className="admin-dash__btn"
                          disabled={sendingOtp || savingStatus || resendIn > 0}
                          onClick={() => void requestOtp(otpPendingStatus)}
                        >
                          {resendIn > 0
                            ? `Renvoyer (${resendIn}s)`
                            : "Renvoyer le code"}
                        </button>
                        <button
                          type="button"
                          className="admin-payment-force__other-toggle"
                          disabled={savingStatus || sendingOtp}
                          onClick={resetOtpStep}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="admin-dash__field admin-payment-force__note">
                        <span>Note assistance (optionnel)</span>
                        <textarea
                          rows={2}
                          value={editNote}
                          disabled={savingStatus || sendingOtp}
                          placeholder="Ex. Client débité le 03/08, pas de callback…"
                          onChange={(e) => setEditNote(e.target.value)}
                        />
                      </label>

                      <button
                        type="button"
                        className="admin-dash__btn admin-dash__btn--primary admin-payment-force__cta"
                        disabled={savingStatus || sendingOtp}
                        onClick={() => setConfirmActivateOpen(true)}
                      >
                        <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
                        {sendingOtp
                          ? "Envoi du code…"
                          : "Activer & marquer payé"}
                      </button>

                      <div className="admin-payment-force__other">
                        <button
                          type="button"
                          className="admin-payment-force__other-toggle"
                          disabled={savingStatus || sendingOtp}
                          aria-expanded={showOtherStatus}
                          onClick={() => setShowOtherStatus((v) => !v)}
                        >
                          {showOtherStatus
                            ? "Masquer les autres statuts"
                            : "Changer vers un autre statut"}
                        </button>

                        {showOtherStatus ? (
                          <div className="admin-payment-force__other-body">
                            <label className="admin-dash__field">
                              <span>Statut</span>
                              <select
                                value={editStatus}
                                disabled={savingStatus || sendingOtp}
                                onChange={(e) =>
                                  setEditStatus(
                                    e.target.value as PaymentStatusName,
                                  )
                                }
                              >
                                <option value="PENDING">En attente</option>
                                <option value="FAILED">Échoué</option>
                                <option value="CANCELLED">Annulé</option>
                                <option value="REFUNDED">Remboursé</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              className="admin-dash__btn"
                              disabled={
                                savingStatus ||
                                sendingOtp ||
                                editStatus === "SUCCESS" ||
                                editStatus === detail.status
                              }
                              onClick={() => void requestOtp(editStatus)}
                            >
                              Demander un OTP
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {detail.status === "REFUNDED" ? (
                <p className="admin-payment-status__refund">
                  <RotateCcw size={14} strokeWidth={2} aria-hidden /> Paiement
                  remboursé
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal
        open={confirmActivateOpen}
        title="Confirmer l’activation"
        onClose={() => {
          if (!sendingOtp) setConfirmActivateOpen(false);
        }}
      >
        <div className="admin-payment-confirm">
          <div className="admin-payment-confirm__icon" aria-hidden>
            <ShieldAlert size={22} strokeWidth={2} />
          </div>
          <p className="admin-payment-confirm__lead">
            Marquer ce paiement comme <strong>payé</strong>&nbsp;?
          </p>
          <p className="admin-payment-confirm__detail">
            Un OTP sera envoyé à votre e-mail, puis l’accès sera activé.
          </p>
          {detail ? (
            <div className="admin-payment-confirm__target">
              <strong>{detail.label}</strong>
              <span className="admin-dash__muted">
                {formatMoney(detail.amountCents, detail.currency)} ·{" "}
                {detail.subscriber.email}
              </span>
            </div>
          ) : null}
          <div className="admin-payment-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn"
              disabled={sendingOtp}
              onClick={() => setConfirmActivateOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={sendingOtp || !detail}
              onClick={() => void requestOtp("SUCCESS")}
            >
              <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
              {sendingOtp ? "Envoi…" : "Continuer"}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}

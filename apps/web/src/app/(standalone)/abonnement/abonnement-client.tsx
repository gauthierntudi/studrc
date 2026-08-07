"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Check,
  CreditCard,
  Home,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import {
  magazinesPublicApi,
  paymentsApi,
  plansApi,
  type PublicPlan,
} from "@/lib/api";
import { DEMO_MAGAZINES } from "@/lib/legacy-demo";
import { cn } from "@/lib/utils";
import "./abonnement.css";

const StripePaymentModal = dynamic(
  () =>
    import("./stripe-payment-modal").then((m) => m.StripePaymentModal),
  { ssr: false },
);

type PayChannel = "stripe" | "flexpaie";

type StripePaySession = {
  paymentId: string;
  clientSecret: string;
  publishableKey: string;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function durationLabel(days: number): string {
  if (days % 365 === 0) {
    const y = days / 365;
    return y === 1 ? "1 an" : `${y} ans`;
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return m === 1 ? "1 mois" : `${m} mois`;
  }
  return `${days} jours`;
}

function AbonnementInner({
  initialPlans,
  initialCover,
}: {
  initialPlans: PublicPlan[];
  initialCover: {
    title: string;
    coverUrl: string;
    issueNumber: string | null;
  } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState<PublicPlan[]>(initialPlans);
  const [plansLoading, setPlansLoading] = useState(initialPlans.length === 0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialPlans[0]?.id ?? null,
  );
  const [channel, setChannel] = useState<PayChannel>("stripe");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [stripePay, setStripePay] = useState<StripePaySession | null>(null);
  const [flexPendingId, setFlexPendingId] = useState<string | null>(null);
  const [flexStatus, setFlexStatus] = useState<
    "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | null
  >(null);
  const [cover, setCover] = useState<{
    title: string;
    coverUrl: string;
    issueNumber: string | null;
  } | null>(initialCover);

  const cancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    let alive = true;
    if (initialPlans.length === 0) setPlansLoading(true);
    void (async () => {
      try {
        const [plansRes, latest] = await Promise.all([
          plansApi.list(),
          magazinesPublicApi.latest().catch(() => null),
        ]);
        if (!alive) return;
        setPlans(plansRes.items);
        if (plansRes.items[0]) {
          setSelectedPlanId((prev) => prev ?? plansRes.items[0]!.id);
        }
        if (latest?.coverUrl) {
          setCover({
            title: latest.title,
            coverUrl: latest.coverUrl,
            issueNumber: latest.issueNumber,
          });
        } else if (!initialCover) {
          const demo = DEMO_MAGAZINES[0];
          setCover({
            title: demo.titre,
            coverUrl: demo.cover,
            issueNumber: null,
          });
        }
      } catch (err) {
        if (!alive || initialPlans.length > 0) return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Impossible de charger les formules",
        );
      } finally {
        if (alive) setPlansLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialCover, initialPlans.length]);

  useEffect(() => {
    if (cancelled) {
      toast.info("Paiement annulé — vous pouvez réessayer.");
      router.replace("/abonnement", { scroll: false });
    }
  }, [cancelled, router]);

  // Poll statut DB (webhook). Check FlexPaie seulement après un délai (USSD).
  useEffect(() => {
    if (!flexPendingId) {
      setFlexStatus(null);
      return;
    }
    setFlexStatus("PENDING");
    let stop = false;
    const startedAt = Date.now();
    const CHECK_AFTER_MS = 20_000;
    const CHECK_EVERY_MS = 12_000;
    let lastCheckAt = 0;

    const applyStatus = (
      status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED",
      paymentId: string,
    ) => {
      if (stop) return;
      if (status === "PENDING" || status === "REFUNDED") {
        setFlexStatus(status === "PENDING" ? "PENDING" : status);
        return;
      }
      setFlexStatus(status);
      if (status === "SUCCESS") {
        window.setTimeout(() => {
          if (stop) return;
          setFlexPendingId(null);
          toast.success("Paiement confirmé — abonnement activé");
          router.push(`/abonnement/retour?payment=${paymentId}`);
        }, 700);
        return;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        window.setTimeout(() => {
          if (stop) return;
          setFlexPendingId(null);
          toast.error("Paiement Mobile Money échoué");
        }, 900);
      }
    };

    const tick = async () => {
      try {
        const elapsed = Date.now() - startedAt;
        const dueForCheck =
          elapsed >= CHECK_AFTER_MS &&
          Date.now() - lastCheckAt >= CHECK_EVERY_MS;

        let p;
        if (dueForCheck) {
          lastCheckAt = Date.now();
          p = await paymentsApi.check(flexPendingId);
        } else {
          p = await paymentsApi.get(flexPendingId);
        }
        applyStatus(p.status, p.id);
      } catch {
        /* keep polling */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [flexPendingId, router]);

  useEffect(() => {
    if (!flexPendingId && !stripePay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [flexPendingId, stripePay]);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  async function startCheckout() {
    if (!user) {
      router.push(`/connexion?next=${encodeURIComponent("/abonnement")}`);
      return;
    }
    if (!selected) {
      toast.error("Choisissez une formule");
      return;
    }
    setBusy(true);
    try {
      if (channel === "stripe") {
        const res = await paymentsApi.createStripeCheckout(selected.id);
        const key =
          res.publishableKey ||
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
          "";
        if (!res.clientSecret || !key) {
          throw new Error("Configuration Stripe incomplète");
        }
        setStripePay({
          paymentId: res.paymentId,
          clientSecret: res.clientSecret,
          publishableKey: key,
        });
        return;
      }
      if (!phone.trim()) {
        toast.error("Indiquez votre numéro Mobile Money");
        setBusy(false);
        return;
      }
      const res = await paymentsApi.createFlexpaie(selected.id, phone.trim());
      setFlexPendingId(res.paymentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du paiement");
    } finally {
      setBusy(false);
    }
  }

  function cancelFlexWait() {
    setFlexPendingId(null);
    setFlexStatus(null);
  }

  function onStripeSuccess(paymentId: string) {
    setStripePay(null);
    toast.success("Paiement confirmé — abonnement activé");
    router.push(`/abonnement/retour?payment=${paymentId}`);
  }

  return (
    <>
      <div className="opt-abo">
      <div className="opt-abo__bg" aria-hidden />

      <header className="opt-abo__top">
        <Link href="/" className="opt-abo__brand" aria-label="Opt1mum — Accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/legacy/img/kiosque1.png" alt="" />
        </Link>
        <p className="opt-abo__top-tag">Abonnement 100 % numérique</p>
      </header>

      <main className="opt-abo__main">
        <section className="opt-abo__hero">
          <h1>Lisez partout. Tout de suite.</h1>
          <p className="opt-abo__lead">
            Accès illimité à tous les numéros sur smartphone, tablette et PC —
            dès validation du paiement.
          </p>
        </section>

        <div className="opt-abo__grid">
          <div className="opt-abo__offer">
            {plansLoading ? (
              <p className="opt-abo__muted">
                <Loader2 className="opt-abo__spin" size={18} aria-hidden />
                Chargement des formules…
              </p>
            ) : plans.length === 0 ? (
              <p className="opt-abo__muted">
                Aucune formule active pour le moment.
              </p>
            ) : (
              <ul className="opt-abo__plans" role="list">
                {plans.map((plan) => {
                  const active = plan.id === selectedPlanId;
                  return (
                    <li key={plan.id}>
                      <button
                        type="button"
                        className={cn(
                          "opt-abo__plan",
                          active && "opt-abo__plan--active",
                        )}
                        onClick={() => setSelectedPlanId(plan.id)}
                        aria-pressed={active}
                      >
                        <span className="opt-abo__plan-name">{plan.name}</span>
                        <span className="opt-abo__plan-price">
                          {formatMoney(plan.priceCents, plan.currency)}
                          <small> / {durationLabel(plan.durationDays)}</small>
                        </span>
                        {plan.description ? (
                          <span className="opt-abo__plan-desc">
                            {plan.description}
                          </span>
                        ) : null}
                        {active ? (
                          <span className="opt-abo__plan-check" aria-hidden>
                            <Check size={14} strokeWidth={3} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="opt-abo__perks">
              <p>
                <Check size={16} aria-hidden /> Tous les magazines publiés
              </p>
              <p>
                <Check size={16} aria-hidden /> Lecture multi-appareils
              </p>
              <p>
                <Check size={16} aria-hidden /> Activation immédiate après paiement
              </p>
            </div>

            <div className="opt-abo__channels" role="radiogroup" aria-label="Moyen de paiement">
              <button
                type="button"
                role="radio"
                aria-checked={channel === "stripe"}
                className={cn(
                  "opt-abo__channel",
                  channel === "stripe" && "is-active",
                )}
                onClick={() => setChannel("stripe")}
                disabled={Boolean(flexPendingId || stripePay)}
              >
                <CreditCard size={18} aria-hidden />
                Carte bancaire
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={channel === "flexpaie"}
                className={cn(
                  "opt-abo__channel",
                  channel === "flexpaie" && "is-active",
                )}
                onClick={() => setChannel("flexpaie")}
                disabled={Boolean(flexPendingId || stripePay)}
              >
                <Smartphone size={18} aria-hidden />
                Mobile Money
              </button>
            </div>

            {channel === "flexpaie" ? (
              <label className="opt-abo__phone">
                <span>Numéro Mobile Money (RDC)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="2438XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy || Boolean(flexPendingId || stripePay)}
                  autoComplete="tel"
                />
              </label>
            ) : null}

            <div className="opt-abo__cta-row">
              {!authLoading && user ? (
                <button
                  type="button"
                  className="opt-abo__cta"
                  disabled={
                    busy || !selected || Boolean(flexPendingId || stripePay)
                  }
                  onClick={() => void startCheckout()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="opt-abo__spin" size={18} aria-hidden />
                      Préparation…
                    </>
                  ) : (
                    "Je m’abonne"
                  )}
                </button>
              ) : (
                <>
                  <Link
                    href={`/connexion?next=${encodeURIComponent("/abonnement")}`}
                    className="opt-abo__cta"
                  >
                    Se connecter pour s’abonner
                  </Link>
                  <Link href="/inscription" className="opt-abo__cta-ghost">
                    Créer un compte
                  </Link>
                </>
              )}
            </div>

            <p className="opt-abo__secure">
              Paiement sécurisé · carte bancaire ou Mobile Money
            </p>
            <ul className="opt-abo__pay-icons" aria-label="Moyens de paiement">
              <li aria-label="Visa">
                <i className="fab fa-cc-visa" aria-hidden />
              </li>
              <li aria-label="Mastercard">
                <i className="fab fa-cc-mastercard" aria-hidden />
              </li>
              <li aria-label="American Express">
                <i className="fab fa-cc-amex" aria-hidden />
              </li>
              <li aria-label="Discover">
                <i className="fab fa-cc-discover" aria-hidden />
              </li>
              <li aria-label="Diners Club">
                <i className="fab fa-cc-diners-club" aria-hidden />
              </li>
              <li aria-label="JCB">
                <i className="fab fa-cc-jcb" aria-hidden />
              </li>
              <li aria-label="Mobile Money">
                <i className="fas fa-mobile-alt" aria-hidden />
              </li>
              <li aria-label="Portefeuille">
                <i className="fas fa-wallet" aria-hidden />
              </li>
            </ul>
          </div>

          <aside className="opt-abo__cover-panel">
            <p className="opt-abo__cover-label">Votre nouveau numéro</p>
            {cover ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover.coverUrl}
                  alt={cover.title}
                  className="opt-abo__cover"
                />
                <h2>{cover.title}</h2>
                <p>Déjà disponible en kiosque numérique</p>
              </>
            ) : null}
          </aside>
        </div>
      </main>

      <Link href="/" className="opt-abo__home" title="Accueil" aria-label="Accueil">
        <Home size={22} strokeWidth={2} aria-hidden />
      </Link>

      {stripePay && selected && user ? (
        <StripePaymentModal
          paymentId={stripePay.paymentId}
          clientSecret={stripePay.clientSecret}
          publishableKey={stripePay.publishableKey}
          amountValue={formatMoney(selected.priceCents, selected.currency)}
          planName={selected.name}
          customerName={user.name}
          customerEmail={user.email}
          customerPhone={user.phone}
          onClose={() => setStripePay(null)}
          onSuccess={onStripeSuccess}
        />
      ) : null}

      {flexPendingId ? (
        <div
          className="opt-abo-wait"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opt-abo-wait-title"
        >
          <button
            type="button"
            className="opt-abo-wait__backdrop"
            aria-label="Fermer"
            onClick={cancelFlexWait}
          />
          <div className="opt-abo-wait__panel">
            {flexStatus === "SUCCESS" ? (
              <Check
                className="opt-abo-wait__spinner"
                size={36}
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <Loader2
                className="opt-abo__spin opt-abo-wait__spinner"
                size={36}
                aria-hidden
              />
            )}
            <h2 id="opt-abo-wait-title">
              {flexStatus === "SUCCESS"
                ? "Paiement confirmé"
                : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                  ? "Paiement non abouti"
                  : "En attente de validation sur votre téléphone"}
            </h2>
            <p>
              {flexStatus === "SUCCESS"
                ? "Votre abonnement est activé. Redirection…"
                : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                  ? "La transaction Mobile Money a échoué ou a été annulée."
                  : "Confirmez via USSD ou la notification. Cette fenêtre reste ouverte jusqu’à confirmation."}
            </p>
            <p className="opt-abo-wait__status" aria-live="polite">
              Statut :{" "}
              <strong>
                {flexStatus === "SUCCESS"
                  ? "Confirmé"
                  : flexStatus === "FAILED"
                    ? "Échoué"
                    : flexStatus === "CANCELLED"
                      ? "Annulé"
                      : "En attente"}
              </strong>
            </p>
            {flexStatus === "PENDING" || !flexStatus ? (
              <button
                type="button"
                className="opt-abo__cta-ghost"
                onClick={cancelFlexWait}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
      <SiteFooter />
    </>
  );
}

export default function AbonnementClient({
  initialPlans,
  initialCover,
}: {
  initialPlans: PublicPlan[];
  initialCover: {
    title: string;
    coverUrl: string;
    issueNumber: string | null;
  } | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="opt-abo">
          <div className="opt-abo__bg" aria-hidden />
          <p className="opt-abo__muted" style={{ padding: "4rem 1.5rem" }}>
            Chargement…
          </p>
        </div>
      }
    >
      <AbonnementInner
        initialPlans={initialPlans}
        initialCover={initialCover}
      />
    </Suspense>
  );
}

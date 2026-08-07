"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
  type PublicMagazineDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import "../abonnement/abonnement.css";

const StripePaymentModal = dynamic(
  () =>
    import("../abonnement/stripe-payment-modal").then(
      (m) => m.StripePaymentModal,
    ),
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

function AchatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const magazineId = searchParams.get("magazine")?.trim() || null;

  const [magazine, setMagazine] = useState<PublicMagazineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [canRead, setCanRead] = useState(false);
  const [channel, setChannel] = useState<PayChannel>("stripe");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [stripePay, setStripePay] = useState<StripePaySession | null>(null);
  const [flexPendingId, setFlexPendingId] = useState<string | null>(null);
  const [flexStatus, setFlexStatus] = useState<
    "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED" | null
  >(null);

  const nextPath = magazineId
    ? `/achat?magazine=${encodeURIComponent(magazineId)}`
    : "/achat";
  const priceCents = magazine?.priceCents ?? null;
  const currency = magazine?.currency || "USD";
  const canBuy =
    magazine?.accessType !== "FREE" &&
    typeof priceCents === "number" &&
    priceCents > 0;

  useEffect(() => {
    if (!magazineId) {
      router.replace("/kiosque");
      return;
    }

    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const detail = await magazinesPublicApi.get(magazineId);
        if (!alive) return;
        setMagazine(detail);
      } catch (err) {
        if (!alive) return;
        toast.error(
          err instanceof Error ? err.message : "Magazine introuvable",
        );
        router.replace("/kiosque");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [magazineId, router]);

  useEffect(() => {
    if (authLoading || !user || !magazineId) {
      setCanRead(false);
      return;
    }
    let alive = true;
    void magazinesPublicApi
      .read(magazineId)
      .then((session) => {
        if (!alive) return;
        setCanRead(Boolean(session.canRead));
      })
      .catch(() => {
        if (alive) setCanRead(false);
      });
    return () => {
      alive = false;
    };
  }, [authLoading, user, magazineId]);

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
          toast.success("Paiement confirmé — numéro acheté");
          router.push(`/achat/retour?payment=${paymentId}`);
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

  async function startCheckout() {
    if (!magazineId || !magazine) return;
    if (!user) {
      router.push(`/connexion?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (!canBuy) {
      toast.error("Ce numéro n’est pas disponible à l’achat");
      return;
    }
    setBusy(true);
    try {
      if (channel === "stripe") {
        const res = await paymentsApi.createStripePurchase(magazineId);
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
      const res = await paymentsApi.createFlexpaiePurchase(
        magazineId,
        phone.trim(),
      );
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
    toast.success("Paiement confirmé — numéro acheté");
    router.push(`/achat/retour?payment=${paymentId}`);
  }

  const issueLabel = magazine?.issueNumber
    ? `N° ${magazine.issueNumber}`
    : null;

  return (
    <>
      <div className="opt-abo">
        <div className="opt-abo__bg" aria-hidden />

        <header className="opt-abo__top">
          <Link
            href="/"
            className="opt-abo__brand"
            aria-label="Opt1mum — Accueil"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/legacy/img/kiosque1.png" alt="" />
          </Link>
          <p className="opt-abo__top-tag">Achat d’un numéro</p>
        </header>

        <main className="opt-abo__main">
          <section className="opt-abo__hero">
            <h1>Acheter ce numéro</h1>
            <p className="opt-abo__lead">
              Accès immédiat à ce magazine uniquement — sans abonnement.
            </p>
          </section>

          <div className="opt-abo__grid">
            <div className="opt-abo__offer">
              {loading ? (
                <p className="opt-abo__muted">
                  <Loader2 className="opt-abo__spin" size={18} aria-hidden />
                  Chargement du numéro…
                </p>
              ) : !magazine ? (
                <p className="opt-abo__muted">Magazine introuvable.</p>
              ) : canRead ? (
                <>
                  <p className="opt-abo__lead" style={{ margin: 0 }}>
                    Vous avez déjà accès à ce numéro.
                  </p>
                  <div className="opt-abo__cta-row">
                    <Link
                      href={`/lecture/${encodeURIComponent(magazine.id)}`}
                      className="opt-abo__cta"
                    >
                      Lire maintenant
                    </Link>
                    <Link
                      href={`/kiosque?magazine=${encodeURIComponent(magazine.id)}`}
                      className="opt-abo__cta-ghost"
                    >
                      Retour au kiosque
                    </Link>
                  </div>
                </>
              ) : !canBuy ? (
                <>
                  <p className="opt-abo__muted">
                    Ce numéro n’est pas proposé à l’achat unitaire.
                  </p>
                  <div className="opt-abo__cta-row">
                    <Link href="/abonnement" className="opt-abo__cta">
                      Voir l’abonnement
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="opt-abo__plans" role="list">
                    <div
                      className="opt-abo__plan opt-abo__plan--active"
                      role="listitem"
                    >
                      <span className="opt-abo__plan-name">
                        {magazine.title}
                        {issueLabel ? ` · ${issueLabel}` : ""}
                      </span>
                      <span className="opt-abo__plan-price">
                        {formatMoney(priceCents!, currency)}
                        <small> · accès permanent</small>
                      </span>
                      <span className="opt-abo__plan-check" aria-hidden>
                        <Check size={14} strokeWidth={3} />
                      </span>
                    </div>
                  </div>

                  <div className="opt-abo__perks">
                    <p>
                      <Check size={16} aria-hidden /> Lecture de ce numéro
                      uniquement
                    </p>
                    <p>
                      <Check size={16} aria-hidden /> Activation immédiate après
                      paiement
                    </p>
                    <p>
                      <Check size={16} aria-hidden /> Conservé dans Mes achats
                    </p>
                  </div>

                  <div
                    className="opt-abo__channels"
                    role="radiogroup"
                    aria-label="Moyen de paiement"
                  >
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
                        disabled={busy || Boolean(flexPendingId || stripePay)}
                        onClick={() => void startCheckout()}
                      >
                        {busy ? (
                          <>
                            <Loader2
                              className="opt-abo__spin"
                              size={18}
                              aria-hidden
                            />
                            Préparation…
                          </>
                        ) : (
                          `Acheter · ${formatMoney(priceCents!, currency)}`
                        )}
                      </button>
                    ) : (
                      <>
                        <Link
                          href={`/connexion?next=${encodeURIComponent(nextPath)}`}
                          className="opt-abo__cta"
                        >
                          Se connecter pour acheter
                        </Link>
                        <Link
                          href={`/inscription?next=${encodeURIComponent(nextPath)}`}
                          className="opt-abo__cta-ghost"
                        >
                          Créer un compte
                        </Link>
                      </>
                    )}
                  </div>

                  <p className="opt-abo__secure">
                    Paiement sécurisé · carte bancaire ou Mobile Money
                  </p>
                  <p className="opt-abo__muted" style={{ marginTop: "0.75rem" }}>
                    Préférez un accès illimité ?{" "}
                    <Link href="/abonnement">Voir l’abonnement</Link>
                  </p>
                </>
              )}
            </div>

            <aside className="opt-abo__cover-panel">
              <p className="opt-abo__cover-label">Numéro sélectionné</p>
              {magazine?.coverUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={magazine.coverUrl}
                    alt={magazine.title}
                    className="opt-abo__cover"
                  />
                  <h2>{magazine.title}</h2>
                  <p>
                    {issueLabel
                      ? `${issueLabel} · kiosque numérique`
                      : "Kiosque numérique"}
                  </p>
                </>
              ) : magazine ? (
                <>
                  <h2>{magazine.title}</h2>
                  <p>{issueLabel || "Kiosque numérique"}</p>
                </>
              ) : null}
            </aside>
          </div>
        </main>

        <Link
          href="/kiosque"
          className="opt-abo__home"
          title="Kiosque"
          aria-label="Kiosque"
        >
          <Home size={22} strokeWidth={2} aria-hidden />
        </Link>

        {stripePay && magazine && user && priceCents != null ? (
          <StripePaymentModal
            paymentId={stripePay.paymentId}
            clientSecret={stripePay.clientSecret}
            publishableKey={stripePay.publishableKey}
            amountValue={formatMoney(priceCents, currency)}
            planName={magazine.title}
            customerName={user.name}
            customerEmail={user.email}
            customerPhone={user.phone}
            returnPath="/achat/retour"
            headNote="Règlement sécurisé de votre numéro Opt1mum."
            onClose={() => setStripePay(null)}
            onSuccess={onStripeSuccess}
          />
        ) : null}

        {flexPendingId ? (
          <div
            className="opt-abo-wait"
            role="dialog"
            aria-modal="true"
            aria-labelledby="opt-achat-wait-title"
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
              <h2 id="opt-achat-wait-title">
                {flexStatus === "SUCCESS"
                  ? "Paiement confirmé"
                  : flexStatus === "FAILED" || flexStatus === "CANCELLED"
                    ? "Paiement non abouti"
                    : "En attente de validation sur votre téléphone"}
              </h2>
              <p>
                {flexStatus === "SUCCESS"
                  ? "Votre numéro est débloqué. Redirection…"
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

export default function AchatClient() {
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
      <AchatInner />
    </Suspense>
  );
}

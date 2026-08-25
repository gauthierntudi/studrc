"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { paymentsApi, type PublicPayment } from "@/lib/api";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import "../abonnement.css";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function RetourInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const paymentId = params.get("payment");
  const sessionId = params.get("session_id");
  const paymentIntentId = params.get("payment_intent");

  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "pending" | "fail">(
    "loading",
  );

  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) {
      router.replace("/");
      return;
    }
    if (authLoading) return;
    if (!user) {
      router.replace(
        `/connexion?next=${encodeURIComponent(
          `/abonnement/retour?${params.toString()}`,
        )}`,
      );
      return;
    }
    if (!paymentId) {
      setError("Référence de paiement manquante");
      setPhase("fail");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        let p: PublicPayment;
        if (paymentIntentId) {
          p = await paymentsApi.confirmStripe(paymentId, { paymentIntentId });
        } else if (sessionId) {
          p = await paymentsApi.confirmStripe(paymentId, { sessionId });
        } else {
          p = await paymentsApi.get(paymentId);
        }
        if (cancelled) return;
        setPayment(p);
        if (p.status === "SUCCESS") setPhase("ok");
        else if (p.status === "PENDING") setPhase("pending");
        else setPhase("fail");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de confirmation");
        setPhase("fail");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, paymentId, sessionId, paymentIntentId, router, params]);

  // Poll si encore pending (webhook lent)
  useEffect(() => {
    if (phase !== "pending" || !paymentId) return;
    const id = window.setInterval(() => {
      void paymentsApi.get(paymentId).then((p) => {
        setPayment(p);
        if (p.status === "SUCCESS") setPhase("ok");
        if (p.status === "FAILED" || p.status === "CANCELLED") setPhase("fail");
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [phase, paymentId]);

  if (!SUBSCRIPTIONS_ENABLED) return null;

  return (
    <div className="opt-abo">
      <div className="opt-abo__bg" aria-hidden />
      <main className="opt-abo__main" style={{ maxWidth: 520 }}>
        <section className="opt-abo__offer" style={{ textAlign: "center" }}>
          {phase === "loading" ? (
            <p className="opt-abo__muted">
              <Loader2 className="opt-abo__spin" size={20} aria-hidden />
              Confirmation du paiement…
            </p>
          ) : null}

          {phase === "ok" ? (
            <>
              <CheckCircle2
                size={48}
                color="#0565ab"
                strokeWidth={1.75}
                aria-hidden
              />
              <h1 style={{ fontFamily: "var(--abo-display)", marginTop: "0.75rem" }}>
                Abonnement activé
              </h1>
              <p className="opt-abo__lead" style={{ marginTop: "0.5rem" }}>
                {payment?.plan
                  ? `${payment.plan.name} · ${formatMoney(payment.amountCents, payment.currency)}`
                  : "Votre accès numérique est prêt."}
              </p>
              <div className="opt-abo__cta-row" style={{ justifyContent: "center" }}>
                <Link href="/magazines" className="opt-abo__cta">
                  Lire mes magazines
                </Link>
                <Link href="/" className="opt-abo__cta-ghost">
                  Accueil
                </Link>
              </div>
            </>
          ) : null}

          {phase === "pending" ? (
            <>
              <Loader2 className="opt-abo__spin" size={40} aria-hidden />
              <h1 style={{ fontFamily: "var(--abo-display)", marginTop: "0.75rem" }}>
                Paiement en cours
              </h1>
              <p className="opt-abo__lead">
                Nous finalisons la confirmation. Cette page se met à jour
                automatiquement.
              </p>
            </>
          ) : null}

          {phase === "fail" ? (
            <>
              <XCircle size={48} color="#d63026" strokeWidth={1.75} aria-hidden />
              <h1 style={{ fontFamily: "var(--abo-display)", marginTop: "0.75rem" }}>
                Paiement non confirmé
              </h1>
              <p className="opt-abo__lead">
                {error || "Le paiement n’a pas abouti. Vous pouvez réessayer."}
              </p>
              <div className="opt-abo__cta-row" style={{ justifyContent: "center" }}>
                <Link href="/abonnement" className="opt-abo__cta">
                  Réessayer
                </Link>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default function AbonnementRetourPage() {
  return (
    <Suspense
      fallback={
        <div className="opt-abo">
          <div className="opt-abo__bg" aria-hidden />
          <p className="opt-abo__muted" style={{ padding: "4rem" }}>
            Chargement…
          </p>
        </div>
      }
    >
      <RetourInner />
    </Suspense>
  );
}

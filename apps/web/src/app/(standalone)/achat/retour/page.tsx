"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { paymentsApi, type PublicPayment } from "@/lib/api";
import "../../kiosque/kiosque.css";
import "./achat-retour.css";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function providerLabel(provider: PublicPayment["provider"]): string {
  if (provider === "STRIPE") return "Carte bancaire";
  if (provider === "FLEXPAIE") return "Mobile Money";
  return "Paiement";
}

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

const DEFAULT_THEME = { bgColor: "#00132b", accentColor: "#0565ab" };

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
    if (authLoading) return;
    if (!user) {
      router.replace(
        `/connexion?next=${encodeURIComponent(
          `/achat/retour?${params.toString()}`,
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

  const magazineId = payment?.magazineId ?? payment?.magazine?.id ?? null;
  const magazineTitle = payment?.magazine?.title ?? null;
  const issueNumber = payment?.magazine?.issueNumber ?? null;
  const coverUrl = payment?.magazine?.coverUrl ?? null;
  const theme = payment?.magazine?.theme ?? DEFAULT_THEME;
  const priceLabel = payment
    ? formatMoney(payment.amountCents, payment.currency)
    : null;
  const retryHref = magazineId
    ? `/achat?magazine=${encodeURIComponent(magazineId)}`
    : "/kiosque";
  const lectureHref = magazineId
    ? `/lecture/${encodeURIComponent(magazineId)}`
    : null;
  const kiosqueHref = magazineId
    ? `/kiosque?magazine=${encodeURIComponent(magazineId)}`
    : "/kiosque";

  const themeStyle = {
    background: theme.bgColor,
    ["--kq-bg" as string]: theme.bgColor,
    ["--kq-accent" as string]: theme.accentColor,
    ["--kq-on-accent" as string]: contrastOn(theme.accentColor),
  } as CSSProperties;

  return (
    <>
      <SiteHeader />
      <div className="opt-kq opt-achat-retour" style={themeStyle}>
        <main className="opt-kq__main">
          {phase === "loading" || phase === "pending" ? (
            <div className="opt-kq__loading" aria-live="polite">
              <Loader2 className="opt-achat-retour__spin" size={28} aria-hidden />
              <p>
                {phase === "pending"
                  ? "Paiement en cours — confirmation automatique…"
                  : "Confirmation du paiement…"}
              </p>
            </div>
          ) : null}

          {phase === "fail" ? (
            <section className="opt-kq__hero opt-achat-retour__fail">
              <div className="opt-kq__body">
                <span className="opt-achat-retour__icon is-fail" aria-hidden>
                  <XCircle size={32} strokeWidth={1.75} />
                </span>
                <p className="opt-kq__eyebrow">Paiement</p>
                <h1 className="opt-kq__title">Paiement non confirmé</h1>
                <p className="opt-kq__desc">
                  {error ||
                    "Le paiement n’a pas abouti. Vous pouvez réessayer."}
                </p>
                <div className="opt-kq__actions">
                  <Link href={retryHref} className="opt-kq__btn opt-kq__btn--primary">
                    Réessayer
                  </Link>
                  <Link href="/kiosque" className="opt-kq__btn opt-kq__btn--ghost">
                    Retour au kiosque
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "ok" && payment ? (
            <section
              className="opt-kq__hero"
              aria-labelledby="achat-retour-title"
            >
              <div className="opt-kq__cover">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt={
                      magazineTitle
                        ? `Couverture — ${magazineTitle}`
                        : "Couverture du magazine"
                    }
                  />
                ) : (
                  <div className="opt-achat-retour__cover-empty" aria-hidden>
                    <BookOpen size={40} strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="opt-kq__body">
                <p className="opt-kq__eyebrow">
                  <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden />
                  Achat confirmé
                </p>
                <h1 id="achat-retour-title" className="opt-kq__title">
                  Votre numéro est prêt
                </h1>
                <p className="opt-achat-retour__lead">
                  Paiement validé — vous pouvez commencer la lecture tout de
                  suite.
                </p>
                {magazineTitle ? (
                  <p className="opt-achat-retour__mag-title">{magazineTitle}</p>
                ) : null}

                <div className="opt-kq__meta">
                  {issueNumber ? (
                    <span className="opt-kq__chip opt-kq__chip--accent">
                      N° {issueNumber}
                    </span>
                  ) : null}
                  <span className="opt-kq__chip">Déjà acheté</span>
                  {priceLabel ? (
                    <span className="opt-kq__chip">{priceLabel}</span>
                  ) : null}
                </div>

                <p className="opt-kq__desc">
                  Accès immédiat à la lecture numérique — ce numéro est conservé
                  dans Mes achats.
                </p>

                <ul className="opt-achat-retour__facts" aria-label="Détails du paiement">
                  <li>
                    <span>Moyen</span>
                    <strong>{providerLabel(payment.provider)}</strong>
                  </li>
                  <li>
                    <span>Date</span>
                    <strong>{formatDate(payment.updatedAt)}</strong>
                  </li>
                </ul>

                <div className="opt-kq__actions">
                  {lectureHref ? (
                    <Link
                      href={lectureHref}
                      className="opt-kq__btn opt-kq__btn--primary"
                    >
                      <BookOpen size={16} strokeWidth={2.25} aria-hidden />
                      Lire ce numéro
                    </Link>
                  ) : null}
                  <Link
                    href="/mes-achats"
                    className="opt-kq__btn opt-kq__btn--secondary"
                  >
                    <ShoppingBag size={16} strokeWidth={2.25} aria-hidden />
                    Mes achats
                  </Link>
                  <Link
                    href={kiosqueHref}
                    className="opt-kq__btn opt-kq__btn--ghost"
                  >
                    Kiosque
                  </Link>
                </div>

                <p className="opt-kq__note">
                  Votre achat est actif immédiatement. Vous pouvez relire ce
                  numéro à tout moment depuis Mes achats.
                </p>
              </div>
            </section>
          ) : null}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}

export default function AchatRetourPage() {
  return (
    <Suspense
      fallback={
        <div className="opt-kq opt-achat-retour" style={{ background: "#00132b" }}>
          <div className="opt-kq__loading">
            <p>Chargement…</p>
          </div>
        </div>
      }
    >
      <RetourInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AuthPanel } from "@/components/site/auth-panel";
import { authApi } from "@/lib/api";

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Confirmation en cours…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Ce lien est incomplet. Demandez un nouvel e-mail de confirmation.");
      return;
    }

    let cancelled = false;
    void authApi
      .verifyEmail(token)
      .then(async (res) => {
        if (cancelled) return;
        setStatus("ok");
        setMessage(res.message || "Adresse confirmée.");
        await refreshUser();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "Impossible de confirmer cette adresse.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshUser]);

  const title =
    status === "ok"
      ? "Adresse confirmée"
      : status === "error"
        ? "Lien invalide"
        : "Confirmation e-mail";
  const subtitle =
    status === "ok"
      ? "Votre compte est prêt. Connectez-vous pour continuer."
      : status === "error"
        ? "Le lien a expiré ou n’est plus valable."
        : "Nous vérifions votre lien…";

  return (
    <AuthPanel
      title={title}
      subtitle={subtitle}
      badge="Se connecter"
      badgeHref="/connexion"
      footer={
        <>
          Retour à{" "}
          <Link href="/">l&apos;accueil</Link>
        </>
      }
    >
      <div
        className={`opt-auth-status opt-auth-status--${status}`}
        role="status"
        aria-live="polite"
      >
        <span className="opt-auth-status__icon" aria-hidden>
          {status === "loading" ? (
            <Loader2 size={22} strokeWidth={2.2} className="opt-auth-status__spin" />
          ) : status === "ok" ? (
            <Check size={22} strokeWidth={2.4} />
          ) : (
            <CircleAlert size={22} strokeWidth={2.2} />
          )}
        </span>
        <p className="opt-auth-status__text">{message}</p>
      </div>

      {status === "ok" ? (
        <Link href="/connexion" className="auth-submit">
          Se connecter
        </Link>
      ) : null}

      {status === "error" ? (
        <div className="opt-auth-status__actions">
          <Link href="/connexion" className="auth-submit">
            Se connecter
          </Link>
          <p className="opt-auth-status__hint">
            Déjà inscrit ? Connectez-vous, puis renvoyez l’e-mail de confirmation
            depuis la bannière du site.
          </p>
        </div>
      ) : null}
    </AuthPanel>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel
          title="Confirmation e-mail"
          subtitle="Nous vérifions votre lien…"
          badge="Se connecter"
          badgeHref="/connexion"
          footer={
            <>
              Retour à <Link href="/">l&apos;accueil</Link>
            </>
          }
        >
          <div className="opt-auth-status opt-auth-status--loading" role="status">
            <span className="opt-auth-status__icon" aria-hidden>
              <Loader2 size={22} strokeWidth={2.2} className="opt-auth-status__spin" />
            </span>
            <p className="opt-auth-status__text">Chargement…</p>
          </div>
        </AuthPanel>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

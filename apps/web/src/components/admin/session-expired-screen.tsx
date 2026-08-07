"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Home,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminBrandLogo } from "@/components/admin/admin-brand-logo";

const ADMIN_BG = "/legacy/img/abonnement.jpg";
const CLIENT_BG = "/legacy/img/abonnement.jpg";

type SessionExpiredScreenProps = {
  variant?: "client" | "admin";
  title?: string;
  description?: string;
  loginHref?: string;
  loginLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
  backgroundSrc?: string;
  /** Tente de renouveler la session (cookies) avant de forcer le login */
  onRetry?: () => Promise<void>;
};

export function SessionExpiredScreen({
  variant = "client",
  title = "Session expirée",
  description = "Pour protéger votre compte, votre session a été fermée. Reconnectez-vous pour continuer en toute sécurité.",
  loginHref,
  loginLabel = "Se reconnecter",
  homeHref,
  homeLabel,
  className,
  backgroundSrc,
  onRetry,
}: SessionExpiredScreenProps) {
  const isAdmin = variant === "admin";
  const resolvedLoginHref =
    loginHref ?? (isAdmin ? "/admin/connexion" : "/connexion");
  const resolvedHomeHref = homeHref ?? "/";
  const resolvedHomeLabel =
    homeLabel ?? (isAdmin ? "Retour au site" : "Retour à l'accueil");
  const bgSrc = backgroundSrc ?? (isAdmin ? ADMIN_BG : CLIENT_BG);
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className={cn(
        "session-expired",
        isAdmin && "session-expired--admin",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="session-expired__atmosphere" aria-hidden>
        <Image
          src={bgSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="session-expired__bg-img"
        />
        <div className="session-expired__overlay" />
      </div>

      <div className="session-expired__card">
        <AdminBrandLogo
          variant="black"
          href={resolvedLoginHref}
          width={148}
          height={36}
          className="session-expired__logo"
        />

        <p className="session-expired__eyebrow">
          {isAdmin ? "Console staff" : "Espace abonné"}
        </p>
        <h1 className="session-expired__title">{title}</h1>
        <p className="session-expired__text">{description}</p>

        <div className="session-expired__actions">
          <Link
            href={resolvedLoginHref}
            className="session-expired__btn session-expired__btn--primary"
          >
            {loginLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </Link>

          {onRetry ? (
            <button
              type="button"
              className="session-expired__btn session-expired__btn--dark"
              onClick={() => void handleRetry()}
              disabled={retrying}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  retrying && "session-expired__spin",
                )}
                strokeWidth={2}
                aria-hidden
              />
              {retrying ? "Vérification…" : "Réessayer la session"}
            </button>
          ) : null}

          <Link
            href={resolvedHomeHref}
            className="session-expired__btn session-expired__btn--ghost"
          >
            <Home className="h-4 w-4" strokeWidth={2} aria-hidden />
            {resolvedHomeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarX2,
  CreditCard,
  RotateCcw,
  Star,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import "@/components/site/account-shell.css";
import { libraryApi, type LibraryResponse } from "@/lib/api";
import "./mon-abonnement.css";

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusCopy(status: LibraryResponse["status"]) {
  switch (status) {
    case "active":
      return {
        badge: "Actif",
        badgeClass: "opt-account__badge--ok",
        title: "Abonnement actif",
        Icon: CalendarCheck2,
        cta: "Prolonger",
        CtaIcon: RotateCcw,
      };
    case "expired":
      return {
        badge: "Expiré",
        badgeClass: "opt-account__badge--fail",
        title: "Abonnement expiré",
        Icon: CalendarX2,
        cta: "Prolonger",
        CtaIcon: RotateCcw,
      };
    case "pending":
      return {
        badge: "En attente",
        badgeClass: "opt-account__badge--pending",
        title: "Paiement non finalisé",
        Icon: CreditCard,
        cta: "S’abonner",
        CtaIcon: ArrowRight,
      };
    default:
      return {
        badge: "Aucun",
        badgeClass: "opt-account__badge--muted",
        title: "Aucun abonnement",
        Icon: Star,
        cta: "S’abonner",
        CtaIcon: ArrowRight,
      };
  }
}

export default function MonAbonnementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(
        `/connexion?next=${encodeURIComponent("/mon-abonnement")}`,
      );
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    libraryApi
      .me()
      .then((data) => {
        if (!cancelled) setLibrary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger votre abonnement",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user || loading) {
    return (
      <section className="opt-account opt-account--loading" aria-busy="true">
        <p>Chargement…</p>
      </section>
    );
  }

  const status = library?.status ?? "none";
  const copy = statusCopy(status);
  const expiresLabel = formatDate(library?.expiresAt ?? null);
  const Icon = copy.Icon;
  const CtaIcon = copy.CtaIcon;

  return (
    <section className="opt-account" aria-label="Mon abonnement">
      <div className="opt-account__container">
        <AccountTabs />

        <header className="opt-account__hero">
          <h1>Abonnement</h1>
          <p>Consultez le statut de votre formule et renouvelez si besoin.</p>
        </header>

        {error ? (
          <div className="opt-account__empty">
            <h2>Erreur</h2>
            <p>{error}</p>
          </div>
        ) : (
          <article className="opt-sub-card">
            <div className="opt-sub-card__top">
              <div className="opt-sub-card__icon" aria-hidden>
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="opt-sub-card__heading">
                <h2>{copy.title}</h2>
                <span className={`opt-account__badge ${copy.badgeClass}`}>
                  {copy.badge}
                </span>
              </div>
            </div>

            <dl className="opt-sub-card__meta">
              <div>
                <dt>Formule</dt>
                <dd>{library?.planName || "—"}</dd>
              </div>
              <div>
                <dt>
                  {status === "active"
                    ? "Valide jusqu’au"
                    : status === "expired"
                      ? "Expiré le"
                      : "Échéance"}
                </dt>
                <dd>{expiresLabel || "—"}</dd>
              </div>
            </dl>

            <p className="opt-sub-card__hint">
              {status === "active"
                ? "Vous avez accès à tous les magazines numériques. Prolongez pour garder l’accès sans interruption."
                : status === "expired"
                  ? "Votre accès lecture est suspendu. Prolongez votre abonnement pour le rétablir immédiatement."
                  : status === "pending"
                    ? "Un paiement est encore en cours ou incomplet. Finalisez pour activer votre accès."
                    : "Souscrivez à une formule pour lire tous les magazines Opt1mum sans limite."}
            </p>

            <Link href="/abonnement" className="opt-sub-card__cta">
              <CtaIcon size={16} strokeWidth={2.25} aria-hidden />
              {copy.cta}
            </Link>
          </article>
        )}
      </div>
    </section>
  );
}

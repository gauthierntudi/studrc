"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, ShoppingBag } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import "@/components/site/account-shell.css";
import { libraryApi, type PurchaseHistoryItem } from "@/lib/api";
import "./mes-achats.css";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default function MesAchatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/connexion?next=${encodeURIComponent("/mes-achats")}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    libraryApi
      .purchases()
      .then((res) => {
        if (!cancelled) setPurchases(res.purchases);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger vos achats",
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

  return (
    <section className="opt-account" aria-label="Mes achats">
      <div className="opt-account__container">
        <AccountTabs />

        <header className="opt-account__hero">
          <h1>
            Mes achats
            {purchases.length > 0 ? (
              <span className="opt-purchases__count" aria-label={`${purchases.length} achats`}>
                {purchases.length}
              </span>
            ) : null}
          </h1>
          <p>Magazines achetés à l&apos;unité, hors abonnement.</p>
        </header>

        {error ? (
          <div className="opt-account__empty">
            <h2>Erreur</h2>
            <p>{error}</p>
          </div>
        ) : null}

        {!error && purchases.length === 0 ? (
          <div className="opt-account__empty">
            <ShoppingBag size={28} strokeWidth={1.75} aria-hidden />
            <h2 style={{ marginTop: "0.85rem" }}>Aucun achat</h2>
            <p>
              Les magazines achetés à l&apos;unité apparaîtront ici. Vous pouvez
              aussi vous abonner pour un accès illimité.
            </p>
            <p style={{ marginTop: "1rem" }}>
              <Link
                href="/kiosque"
                style={{
                  color: "var(--opt-teal)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Parcourir le kiosque
              </Link>
            </p>
          </div>
        ) : null}

        {purchases.length > 0 ? (
          <ul className="opt-purchases">
            {purchases.map((p) => {
              const href = p.magazine.readPath ?? "/kiosque";
              return (
                <li key={p.id}>
                  <Link href={href} className="opt-purchases__row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="opt-purchases__cover"
                      src={
                        p.magazine.coverUrl || "/legacy/covers/1591457791.jpg"
                      }
                      alt=""
                    />
                    <div className="opt-purchases__body">
                      <h3>{p.magazine.title}</h3>
                      <p className="opt-purchases__meta">
                        {p.magazine.issueNumber
                          ? `#${p.magazine.issueNumber} · `
                          : null}
                        Acheté le {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <p className="opt-purchases__price">
                      {formatMoney(p.amountCents, p.currency)}
                    </p>
                    <span className="opt-purchases__action">
                      <BookOpen size={13} strokeWidth={2.25} aria-hidden />
                      {p.magazine.readPath ? "Lire" : "Acheté"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AdminBarChart,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import {
  adminDashboardApi,
  type AdminDashboardStats,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PURPOSE_LABEL: Record<string, string> = {
  SUBSCRIPTION: "Abonnement",
  PURCHASE: "Achat magazine",
};

const PURPOSE_COLOR: Record<string, string> = {
  SUBSCRIPTION: "#02d0d1",
  PURCHASE: "#5b7cfa",
};

function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminHomePage() {
  const { admin } = useAdminAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    void adminDashboardApi
      .stats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const cards = [
    {
      label: "Abonnés",
      value: stats ? formatCount(stats.subscribersCount) : "—",
      color: "teal" as const,
    },
    {
      label: "Abonnements actifs",
      value: stats ? formatCount(stats.activeSubscriptions) : "—",
      color: "blue" as const,
    },
    {
      label: "Magazines",
      value: stats
        ? `${formatCount(stats.publishedMagazines)}/${formatCount(stats.magazinesCount)}`
        : "—",
      color: "violet" as const,
    },
    {
      label: "Paiements OK",
      value: stats ? formatCount(stats.successPayments) : "—",
      color: "green" as const,
    },
    {
      label: "En attente",
      value: stats ? formatCount(stats.pendingPayments) : "—",
      color: "gold" as const,
    },
    {
      label: "Volume (14 j)",
      value: stats ? formatMoney(stats.volume14Cents) : "—",
      color: "coral" as const,
    },
  ];

  const volumePoints = useMemo(
    () =>
      (stats?.charts.volumeByDay ?? []).map((d) => ({
        label: d.date.slice(8),
        value: Math.round((d.volumeCents / 100) * 100) / 100,
        count: d.count,
      })),
    [stats],
  );

  const purposeSlices = useMemo(
    () =>
      (stats?.charts.purposeBreakdown ?? []).map((p) => ({
        label: PURPOSE_LABEL[p.purpose] ?? p.purpose,
        value: p.count,
        color: PURPOSE_COLOR[p.purpose] ?? "#8899aa",
      })),
    [stats],
  );

  const recentPayments = stats?.recentPayments ?? [];
  const recentSubscribers = stats?.recentSubscribers ?? [];

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Pilotage OPT1MUM — abonnés, magazines et paiements
            {admin?.name ? ` · ${admin.name}` : ""}.
          </p>
        </div>
        <Link href="/admin/abonnes" className="admin-dash__cta">
          Abonnés
        </Link>
      </header>

      <section
        className="admin-dash__kpis-row"
        aria-label="Statistiques admin"
        style={{ ["--kpi-count" as string]: String(cards.length) }}
      >
        {cards.map((card) => (
          <article
            key={card.label}
            className={cn(
              "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
              `admin-dash__kpi-vivid--${card.color}`,
            )}
          >
            <p className="snow-dash__kpi-label">{card.label}</p>
            <p className="snow-dash__kpi-value">{card.value}</p>
          </article>
        ))}
      </section>

      <div className="admin-dash__grid">
        <AdminBarChart
          title="Volume payé (14 jours)"
          points={volumePoints}
          color="#02d0d1"
          currency="USD"
        />
        <AdminDonutChart
          title="Répartition des paiements"
          slices={purposeSlices}
          unitLabel="paiements (14 j)"
        />
      </div>

      <div className="admin-dash__grid admin-dash__grid--feeds">
        <section className="admin-dash__panel">
          <div className="admin-dash__panel-head">
            <h2>Derniers paiements</h2>
            <Link href="/admin/paiements" className="admin-dash__panel-link">
              Voir l’historique
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="admin-dash__feed-empty">Aucun paiement réussi.</p>
          ) : (
            <ul className="admin-dash__feed">
              {recentPayments.map((p) => (
                <li key={p.id}>
                  <div className="admin-dash__feed-item">
                    <span className="admin-dash__feed-main">
                      <strong>
                        {PURPOSE_LABEL[p.purpose] ?? p.purpose}
                      </strong>
                      <span>
                        {p.subscriberName || p.subscriberEmail} · {p.provider}
                      </span>
                    </span>
                    <span className="admin-dash__feed-meta">
                      <strong>{formatMoney(p.amountCents, p.currency)}</strong>
                      <span>{formatWhen(p.createdAt)}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-dash__panel">
          <div className="admin-dash__panel-head">
            <h2>Nouveaux abonnés</h2>
            <Link href="/admin/abonnes" className="admin-dash__panel-link">
              Tout voir
            </Link>
          </div>
          {recentSubscribers.length === 0 ? (
            <p className="admin-dash__feed-empty">Aucun abonné.</p>
          ) : (
            <ul className="admin-dash__feed">
              {recentSubscribers.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/abonnes?q=${encodeURIComponent(s.email)}`}
                    className="admin-dash__feed-item"
                  >
                    <span className="admin-dash__feed-main">
                      <strong>{s.name}</strong>
                      <span>{s.email}</span>
                    </span>
                    <span className="admin-dash__feed-meta">
                      <span>
                        {s.isActive ? "actif" : "inactif"} ·{" "}
                        {formatWhen(s.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

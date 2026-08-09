"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import {
  adminMonitoringApi,
  type MonitoringCheckStatus,
  type MonitoringSnapshot,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function statusLabel(status: MonitoringCheckStatus): string {
  switch (status) {
    case "up":
      return "OK";
    case "down":
      return "Down";
    case "degraded":
      return "Dégradé";
    default:
      return "Inconnu";
  }
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

export default function AdminMonitoringPage() {
  const { admin } = useAdminAuth();
  const [snap, setSnap] = useState<MonitoringSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerting, setAlerting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const isSuper = admin?.role === "SUPERADMIN";

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminMonitoringApi.get();
      setSnap(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger le monitoring",
      );
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [isSuper, load]);

  async function triggerAlert() {
    setAlerting(true);
    setAlertMsg(null);
    try {
      const res = await adminMonitoringApi.triggerAlert();
      setAlertMsg(
        res.sent
          ? "Alerte envoyée aux superadmins"
          : `Pas d’envoi (${res.reason})`,
      );
    } catch (err) {
      setAlertMsg(
        err instanceof Error ? err.message : "Échec envoi alerte",
      );
    } finally {
      setAlerting(false);
    }
  }

  if (!isSuper) {
    return (
      <header className="admin-dash__header">
        <div>
          <h1>Monitoring</h1>
          <p>Réservé aux superadmins.</p>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Monitoring</h1>
          <p>
            API, web, nginx, R2, worker pages — superadmins only
            {snap ? ` · ${formatWhen(snap.checkedAt)}` : null}
          </p>
        </div>
        <div className="admin-mon__actions">
          <button
            type="button"
            className="admin-dash__btn"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
            Actualiser
          </button>
          <button
            type="button"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={alerting || !snap?.alertsEnabled}
            onClick={() => void triggerAlert()}
            title={
              snap?.alertsEnabled
                ? "Évaluer et envoyer si incident (cooldown 1 h)"
                : "Alertes désactivées (MONITORING_ALERTS)"
            }
          >
            Tester alerte email
          </button>
        </div>
      </header>

      {error ? (
        <p className="admin-dash__muted" style={{ color: "#b42318" }}>
          {error}
        </p>
      ) : null}
      {alertMsg ? <p className="admin-dash__muted">{alertMsg}</p> : null}

      {loading && !snap ? (
        <p className="admin-dash__muted">Chargement…</p>
      ) : snap ? (
        <>
          <div
            className={cn(
              "admin-mon__overall",
              `admin-mon__overall--${snap.overall}`,
            )}
          >
            <Activity className="h-5 w-5" strokeWidth={2} aria-hidden />
            <div>
              <strong>État global : {statusLabel(snap.overall)}</strong>
              <span>
                Alertes email : {snap.alertsEnabled ? "activées" : "off"}
              </span>
            </div>
          </div>

          <section className="admin-mon__grid" aria-label="Services">
            {snap.services.map((s) => (
              <article
                key={s.id}
                className={cn("admin-mon__card", `admin-mon__card--${s.status}`)}
              >
                <header>
                  <span
                    className={cn(
                      "admin-mon__dot",
                      `admin-mon__dot--${s.status}`,
                    )}
                    aria-hidden
                  />
                  <h2>{s.label}</h2>
                  <em>{statusLabel(s.status)}</em>
                </header>
                <p>
                  {s.latencyMs != null ? `${s.latencyMs} ms` : "—"}
                  {s.detail ? ` · ${s.detail}` : null}
                </p>
              </article>
            ))}
          </section>

          <section className="admin-mon__section" aria-label="Pipeline pages">
            <h2>Pipeline pages WebP</h2>
            <div className="admin-mon__stats">
              <div>
                <strong>{snap.pages.ready}</strong>
                <span>READY</span>
              </div>
              <div>
                <strong>{snap.pages.processing}</strong>
                <span>PROCESSING</span>
              </div>
              <div>
                <strong>{snap.pages.pending}</strong>
                <span>PENDING</span>
              </div>
              <div>
                <strong>{snap.pages.failed}</strong>
                <span>FAILED</span>
              </div>
            </div>

            <div className="admin-mon__queues">
              <p>
                Queue urgent — waiting {snap.pages.queues.urgent.waiting ?? 0} ·
                active {snap.pages.queues.urgent.active ?? 0} · failed{" "}
                {snap.pages.queues.urgent.failed ?? 0}
              </p>
              <p>
                Queue bulk — waiting {snap.pages.queues.bulk.waiting ?? 0} ·
                active {snap.pages.queues.bulk.active ?? 0} · failed{" "}
                {snap.pages.queues.bulk.failed ?? 0}
              </p>
            </div>

            {snap.pages.stuck.length > 0 ? (
              <div className="admin-mon__table-wrap">
                <h3>PROCESSING bloqués (&gt;15 min)</h3>
                <table className="admin-dash__table">
                  <thead>
                    <tr>
                      <th>Magazine</th>
                      <th>Pages</th>
                      <th>Maj</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {snap.pages.stuck.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.title}</strong>
                        </td>
                        <td>{m.generatedPageCount}</td>
                        <td>{formatWhen(m.updatedAt)}</td>
                        <td>
                          <Link
                            href={`/admin/magazines?modal=edit&id=${m.id}`}
                            className="admin-dash__btn"
                          >
                            Ouvrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-dash__muted">Aucun PROCESSING bloqué.</p>
            )}

            {snap.pages.recentFailed.length > 0 ? (
              <div className="admin-mon__table-wrap">
                <h3>Échecs récents</h3>
                <table className="admin-dash__table">
                  <thead>
                    <tr>
                      <th>Magazine</th>
                      <th>Erreur</th>
                      <th>Maj</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {snap.pages.recentFailed.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.title}</strong>
                        </td>
                        <td className="admin-dash__muted">
                          {m.pagesError || "—"}
                        </td>
                        <td>{formatWhen(m.updatedAt)}</td>
                        <td>
                          <Link
                            href={`/admin/magazines?modal=edit&id=${m.id}`}
                            className="admin-dash__btn"
                          >
                            Ouvrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}

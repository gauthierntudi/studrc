"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminActivityApi,
  type AdminActivityItem,
} from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";

const TAKE = 10;

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function actorName(row: AdminActivityItem): string {
  return (
    row.admin?.name ||
    row.subscriber?.name ||
    row.admin?.email ||
    row.subscriber?.email ||
    (row.actorType === "SYSTEM" ? "Système" : row.actorType)
  );
}

function actorMeta(row: AdminActivityItem): string | null {
  if (row.admin?.role) return row.admin.role;
  if (row.subscriber?.email) return row.subscriber.email;
  return null;
}

function actorAvatarUrl(row: AdminActivityItem): string | null {
  if (row.actorType === "ADMIN") return row.admin?.avatarUrl ?? null;
  if (row.actorType === "SUBSCRIBER") return row.subscriber?.avatarUrl ?? null;
  return null;
}

function ActorAvatar({
  avatarUrl,
  size = "md",
}: {
  avatarUrl: string | null;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={
        size === "lg" ? "admin-sub__avatar admin-sub__avatar--lg" : "admin-sub__avatar"
      }
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(avatarUrl)}
        alt=""
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = avatarLocalFallback(avatarUrl);
        }}
      />
    </span>
  );
}

function ActorCell({ row }: { row: AdminActivityItem }) {
  const meta = actorMeta(row);
  const kind =
    row.actorType === "SUBSCRIBER"
      ? "Abonné"
      : row.actorType === "ADMIN"
        ? "Staff"
        : row.actorType === "SYSTEM"
          ? "Système"
          : null;
  return (
    <div className="admin-sub__user">
      <ActorAvatar avatarUrl={actorAvatarUrl(row)} />
      <div className="admin-sub__user-meta">
        <strong>{actorName(row)}</strong>
        <span className="admin-activity__actor-line">
          {kind ? (
            <span
              className={
                row.actorType === "SUBSCRIBER"
                  ? "admin-activity__actor-badge admin-activity__actor-badge--sub"
                  : row.actorType === "ADMIN"
                    ? "admin-activity__actor-badge admin-activity__actor-badge--staff"
                    : "admin-activity__actor-badge admin-activity__actor-badge--system"
              }
            >
              {kind}
            </span>
          ) : null}
          {meta && meta !== kind ? (
            <span className="admin-dash__muted">{meta}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export default function AdminActivitiesPage() {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [actorType, setActorType] = useState("");
  const [detail, setDetail] = useState<AdminActivityItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminActivityApi.list({
        take: TAKE,
        skip,
        q: q || undefined,
        actorType: actorType || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [skip, q, actorType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    try {
      setDetail(await adminActivityApi.get(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Détail introuvable");
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Logs activités</h1>
          <p>
            Journal des actions staff, abonnés et tâches système / arrière-plan (
            {total} entrée{total > 1 ? "s" : ""}).
          </p>
        </div>
      </header>

      <div className="admin-dash__filters">
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setSkip(0);
              setQ(e.target.value);
            }}
            placeholder="action, email, cible…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Acteur</span>
          <select
            value={actorType}
            onChange={(e) => {
              setSkip(0);
              setActorType(e.target.value);
            }}
            aria-label="Type d’acteur"
          >
            <option value="">Tous</option>
            <option value="ADMIN">Staff</option>
            <option value="SUBSCRIBER">Abonnés</option>
            <option value="SYSTEM">Système</option>
          </select>
        </label>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={() => void load()}
        >
          Filtrer
        </button>
      </div>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Acteur</th>
              <th>Action</th>
              <th>Cible</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Aucune activité.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="admin-dash__table-row--click"
                  onClick={() => void openDetail(row.id)}
                >
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <ActorCell row={row} />
                  </td>
                  <td>{row.actionLabel}</td>
                  <td className="admin-dash__mono">
                    {[row.entity, row.entityId].filter(Boolean).join(" · ") ||
                      "—"}
                  </td>
                  <td className="admin-dash__muted">{row.ip || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        total={total}
        take={TAKE}
        skip={skip}
        onSkipChange={setSkip}
      />

      <AdminModal
        open={Boolean(detail) || loadingDetail}
        title="Détail de l’activité"
        onClose={() => setDetail(null)}
      >
        {loadingDetail && !detail ? (
          <p className="admin-dash__muted">Chargement…</p>
        ) : detail ? (
          <div className="admin-activity-detail">
            <div className="admin-activity-detail__row">
              <span>Date</span>
              <strong>{formatWhen(detail.createdAt)}</strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>Acteur</span>
              <div className="admin-sub__user admin-sub__user--detail">
                <ActorAvatar avatarUrl={actorAvatarUrl(detail)} size="lg" />
                <div className="admin-sub__user-meta">
                  <strong>{actorName(detail)}</strong>
                  <span className="admin-activity__actor-line">
                    <span
                      className={
                        detail.actorType === "SUBSCRIBER"
                          ? "admin-activity__actor-badge admin-activity__actor-badge--sub"
                          : detail.actorType === "ADMIN"
                            ? "admin-activity__actor-badge admin-activity__actor-badge--staff"
                            : "admin-activity__actor-badge"
                      }
                    >
                      {detail.actorType === "SUBSCRIBER"
                        ? "Abonné"
                        : detail.actorType === "ADMIN"
                          ? "Staff"
                          : detail.actorType === "SYSTEM"
                            ? "Système"
                            : detail.actorType}
                    </span>
                    {actorMeta(detail) ? (
                      <span className="admin-dash__muted">
                        {actorMeta(detail)}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
            <div className="admin-activity-detail__row">
              <span>Action</span>
              <strong>{detail.actionLabel}</strong>
              <code>{detail.action}</code>
            </div>
            <div className="admin-activity-detail__row">
              <span>Cible</span>
              <strong>
                {[detail.entity, detail.entityId].filter(Boolean).join(" · ") ||
                  "—"}
              </strong>
            </div>
            <div className="admin-activity-detail__row">
              <span>IP</span>
              <strong>{detail.ip || "—"}</strong>
            </div>
            {detail.meta != null ? (
              <div className="admin-activity-detail__row">
                <span>Métadonnées</span>
                <pre>{JSON.stringify(detail.meta, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

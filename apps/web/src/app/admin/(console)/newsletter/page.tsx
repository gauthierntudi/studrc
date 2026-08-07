"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Power, PowerOff } from "lucide-react";
import { toast } from "react-toastify";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminNewsletterApi,
  type AdminNewsletterItem,
} from "@/lib/api";

const TAKE = 15;

const AVATAR_PALETTE = [
  { bg: "#02d0d1", fg: "#041512" },
  { bg: "#5b7cfa", fg: "#ffffff" },
  { bg: "#f97366", fg: "#ffffff" },
  { bg: "#10b981", fg: "#ffffff" },
  { bg: "#f59e0b", fg: "#1a1408" },
  { bg: "#8b5cf6", fg: "#ffffff" },
  { bg: "#ec4899", fg: "#ffffff" },
  { bg: "#06b6d4", fg: "#041512" },
] as const;

function avatarTone(seed: string): (typeof AVATAR_PALETTE)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

function emailInitials(email: string): string {
  const local = email.split("@")[0]?.trim() || "?";
  const parts = local.split(/[._+\-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function NewsletterAvatar({ email }: { email: string }) {
  const seed = email.trim().toLowerCase();
  const tone = avatarTone(seed || "?");
  return (
    <span
      className="admin-sub__avatar"
      style={{ background: tone.bg, color: tone.fg }}
      aria-hidden
    >
      <span className="admin-sub__avatar-fallback">{emailInitials(email)}</span>
    </span>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminNewsletterPage() {
  const [items, setItems] = useState<AdminNewsletterItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "1" | "0">("1");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminNewsletterApi.list({
        q: q || undefined,
        active: activeFilter || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setActiveCount(res.summary.active);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement newsletter",
      );
    } finally {
      setLoading(false);
    }
  }, [q, activeFilter, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  async function toggleActive(row: AdminNewsletterItem) {
    setBusyId(row.id);
    try {
      await adminNewsletterApi.setActive(row.id, !row.isActive);
      toast.success(
        row.isActive ? "Inscription désactivée" : "Inscription réactivée",
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de mettre à jour",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <header className="admin-dash__header">
        <div>
          <h1>Newsletter</h1>
          <p className="admin-dash__muted">
            Inscriptions collectées via le formulaire de l’accueil —{" "}
            <strong>{activeCount}</strong> actives
          </p>
        </div>
      </header>

      <form className="admin-dash__filters" onSubmit={onSearch}>
        <label className="admin-dash__field">
          <span>E-mail</span>
          <input
            type="search"
            placeholder="Rechercher…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as "" | "1" | "0");
              setSkip(0);
            }}
          >
            <option value="1">Actives</option>
            <option value="0">Désactivées</option>
            <option value="">Toutes</option>
          </select>
        </label>
        <button
          type="submit"
          className="admin-dash__btn admin-dash__btn--primary"
        >
          Filtrer
        </button>
      </form>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Source</th>
              <th>Statut</th>
              <th>Inscrit le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Aucune inscription pour ce filtre.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="admin-sub__user">
                      <NewsletterAvatar email={row.email} />
                      <div className="admin-sub__user-meta">
                        <strong>{row.email}</strong>
                      </div>
                    </div>
                  </td>
                  <td className="admin-dash__muted">{row.source || "—"}</td>
                  <td>
                    <span
                      className={
                        row.isActive
                          ? "admin-mag__badge"
                          : "admin-mag__badge admin-sub__badge--pending"
                      }
                    >
                      {row.isActive ? "Active" : "Désactivée"}
                    </span>
                  </td>
                  <td className="admin-dash__muted">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className={
                          row.isActive
                            ? "admin-dash__icon-action admin-dash__icon-action--disable"
                            : "admin-dash__icon-action admin-dash__icon-action--enable"
                        }
                        title={row.isActive ? "Désactiver" : "Réactiver"}
                        aria-label={
                          row.isActive
                            ? `Désactiver ${row.email}`
                            : `Réactiver ${row.email}`
                        }
                        disabled={busyId === row.id}
                        onClick={() => void toggleActive(row)}
                      >
                        {row.isActive ? (
                          <PowerOff className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Power className="h-4 w-4" strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </td>
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
    </div>
  );
}

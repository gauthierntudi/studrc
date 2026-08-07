"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import {
  adminStaffApi,
  type AdminRoleName,
  type AdminStaffMember,
  type AdminStaffSummary,
} from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const TAKE = 10;

const ROLE_OPTIONS: { value: AdminRoleName; label: string; hint: string }[] = [
  {
    value: "SUPERADMIN",
    label: "Superadmin",
    hint: "Accès total",
  },
  {
    value: "ADMIN",
    label: "Admin",
    hint: "Gestion opérationnelle",
  },
  {
    value: "EDITOR",
    label: "Éditeur",
    hint: "Magazines & contenus",
  },
  {
    value: "REDACTEUR",
    label: "Rédacteur",
    hint: "Actualités",
  },
];

const emptyCreate = {
  email: "",
  name: "",
  password: "",
  role: "EDITOR" as AdminRoleName,
  title: "",
};

const emptyEdit = {
  name: "",
  email: "",
  avatarUrl: null as string | null,
  role: "EDITOR" as AdminRoleName,
  title: "",
  isActive: true,
  password: "",
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function StaffAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  return (
    <span className="admin-sub__avatar" aria-hidden>
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

export default function AdminStaffPage() {
  const { admin } = useAdminAuth();
  const [items, setItems] = useState<AdminStaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminStaffSummary | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingSuspend, setPendingSuspend] =
    useState<AdminStaffMember | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState(emptyEdit);

  const canManage =
    admin?.role === "SUPERADMIN" || admin?.role === "ADMIN";

  const load = useCallback(async () => {
    try {
      const res = await adminStaffApi.list({
        q,
        active: active || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [q, active, skip]);

  useEffect(() => {
    if (!canManage) return;
    void load();
  }, [canManage, load]);

  if (!canManage) {
    return (
      <header className="admin-dash__header">
        <div>
          <h1>Accès réservé</h1>
          <p>La gestion du staff est réservée aux rôles SUPERADMIN et ADMIN.</p>
        </div>
      </header>
    );
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminStaffApi.create({
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
        title: form.title || undefined,
      });
      toast.success(`Agent créé : ${form.email}`);
      setForm(emptyCreate);
      setCreateOpen(false);
      if (skip !== 0) setSkip(0);
      else await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec création");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await adminStaffApi.update(editId, {
        name: edit.name,
        role: edit.role,
        title: edit.title || undefined,
        isActive: edit.isActive,
        password: edit.password || undefined,
      });
      toast.success("Agent mis à jour");
      setEditOpen(false);
      setEditId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspend(row: AdminStaffMember) {
    if (row.isActive) {
      setPendingSuspend(row);
      return;
    }
    setSaving(true);
    try {
      await adminStaffApi.update(row.id, { isActive: true });
      toast.success(`${row.name} réactivé`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec réactivation");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSuspend() {
    if (!pendingSuspend) return;
    setSaving(true);
    try {
      await adminStaffApi.update(pendingSuspend.id, { isActive: false });
      toast.success(`${pendingSuspend.name} suspendu`);
      setPendingSuspend(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec suspension");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Staff</h1>
          <p>
            Comptes opérateurs ({total} résultat{total > 1 ? "s" : ""}
            {summary ? ` · ${summary.total} au total` : ""}).
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__cta"
          onClick={() => {
            setForm(emptyCreate);
            setCreateOpen(true);
          }}
        >
          Nouvel agent
        </button>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques staff"
          style={{ ["--kpi-count" as string]: "3" }}
        >
          {(
            [
              {
                key: "total",
                label: "Total",
                value: formatCount(summary.total),
                color: "teal" as const,
                selected: !active,
                onSelect: () => {
                  setSkip(0);
                  setActive("");
                },
              },
              {
                key: "active",
                label: "Actifs",
                value: formatCount(summary.active),
                color: "green" as const,
                selected: active === "true",
                onSelect: () => {
                  setSkip(0);
                  setActive("true");
                },
              },
              {
                key: "suspended",
                label: "Suspendus",
                value: formatCount(summary.suspended),
                color: "gold" as const,
                selected: active === "false",
                onSelect: () => {
                  setSkip(0);
                  setActive("false");
                },
              },
            ] as const
          ).map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
              aria-pressed={card.selected}
              className={cn(
                "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
                `admin-dash__kpi-vivid--${card.color}`,
                card.selected && "admin-dash__kpi-vivid--active",
              )}
              onClick={card.onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  card.onSelect();
                }
              }}
            >
              <p className="snow-dash__kpi-label">{card.label}</p>
              <p className="snow-dash__kpi-value">{card.value}</p>
            </article>
          ))}
        </section>
      ) : null}

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
            placeholder="email, nom, titre…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={active}
            onChange={(e) => {
              setSkip(0);
              setActive(e.target.value);
            }}
          >
            <option value="">Tous</option>
            <option value="true">Actif</option>
            <option value="false">Suspendu</option>
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
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Aucun agent.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="admin-sub__user">
                      <StaffAvatar avatarUrl={a.avatarUrl} />
                      <div className="admin-sub__user-meta">
                        <strong>{a.name}</strong>
                        {a.title ? (
                          <span className="admin-dash__muted">{a.title}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>{a.email}</td>
                  <td>{a.role}</td>
                  <td>
                    <span
                      className={
                        a.isActive
                          ? "admin-mag__badge admin-mag__badge--on"
                          : "admin-mag__badge admin-mag__badge--off"
                      }
                    >
                      {a.isActive ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        title="Modifier"
                        aria-label={`Modifier ${a.name}`}
                        disabled={saving}
                        onClick={() => {
                          setEditId(a.id);
                          setEdit({
                            name: a.name,
                            email: a.email,
                            avatarUrl: a.avatarUrl,
                            role: a.role as AdminRoleName,
                            title: a.title ?? "",
                            isActive: a.isActive,
                            password: "",
                          });
                          setEditOpen(true);
                        }}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "admin-dash__icon-action",
                          a.isActive
                            ? "admin-dash__icon-action--disable"
                            : "admin-dash__icon-action--enable",
                        )}
                        title={a.isActive ? "Suspendre" : "Réactiver"}
                        aria-label={
                          a.isActive
                            ? `Suspendre ${a.name}`
                            : `Réactiver ${a.name}`
                        }
                        disabled={saving || a.id === admin?.id}
                        onClick={() => void toggleSuspend(a)}
                      >
                        {a.isActive ? (
                          <Ban size={16} strokeWidth={2} />
                        ) : (
                          <ShieldCheck size={16} strokeWidth={2} />
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

      <AdminModal
        open={createOpen}
        title="Nouvel agent"
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
      >
        <form
          className="admin-staff-form"
          onSubmit={(e) => void createStaff(e)}
        >
          <section className="admin-staff-form__section">
            <header className="admin-staff-form__section-head">
              <h3>Identité</h3>
            </header>
            <div className="admin-staff-form__grid">
              <label className="admin-dash__field">
                <span>Nom complet</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex. Marie Kabongo"
                  autoComplete="name"
                />
              </label>
              <label className="admin-dash__field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="agent@opt1mum.com"
                  autoComplete="email"
                />
              </label>
              <label className="admin-dash__field admin-staff-form__full">
                <span>Titre</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Rédacteur en chef"
                />
              </label>
            </div>
          </section>

          <section className="admin-staff-form__section">
            <header className="admin-staff-form__section-head">
              <h3>Accès</h3>
            </header>
            <div className="admin-staff-form__grid">
              <label className="admin-dash__field">
                <span>Rôle</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as AdminRoleName,
                    })
                  }
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.hint}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-dash__field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                />
              </label>
            </div>
          </section>

          <div className="admin-staff-form__actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={saving}
            >
              {saving ? "Création…" : "Créer l’agent"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={editOpen}
        title="Modifier l’agent"
        onClose={() => {
          if (!saving) setEditOpen(false);
        }}
      >
        <form
          className="admin-staff-form"
          onSubmit={(e) => void saveEdit(e)}
        >
          <div className="admin-staff-form__identity">
            <StaffAvatar avatarUrl={edit.avatarUrl} />
            <div className="admin-staff-form__identity-meta">
              <strong>{edit.name || "Agent"}</strong>
              <span>{edit.email}</span>
            </div>
            <span
              className={
                edit.isActive
                  ? "admin-mag__badge admin-mag__badge--on"
                  : "admin-mag__badge admin-mag__badge--off"
              }
            >
              {edit.isActive ? "Actif" : "Suspendu"}
            </span>
          </div>

          <section className="admin-staff-form__section">
            <header className="admin-staff-form__section-head">
              <h3>Identité</h3>
            </header>
            <div className="admin-staff-form__grid">
              <label className="admin-dash__field">
                <span>Nom complet</span>
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  placeholder="Ex. Marie Kabongo"
                />
              </label>
              <label className="admin-dash__field">
                <span>Titre</span>
                <input
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  placeholder="Ex. Rédacteur en chef"
                />
              </label>
            </div>
          </section>

          <section className="admin-staff-form__section">
            <header className="admin-staff-form__section-head">
              <h3>Accès</h3>
            </header>
            <label className="admin-dash__field">
              <span>Rôle</span>
              <select
                value={edit.role}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    role: e.target.value as AdminRoleName,
                  })
                }
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label} — {r.hint}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-staff-form__status" role="group" aria-label="Statut">
              <span className="admin-staff-form__status-label">Statut</span>
              <div className="admin-staff-form__status-toggle">
                <button
                  type="button"
                  className={cn(
                    "admin-staff-form__status-btn",
                    edit.isActive && "is-active",
                  )}
                  disabled={saving || editId === admin?.id}
                  onClick={() => setEdit({ ...edit, isActive: true })}
                >
                  Actif
                </button>
                <button
                  type="button"
                  className={cn(
                    "admin-staff-form__status-btn",
                    !edit.isActive && "is-suspended",
                  )}
                  disabled={saving || editId === admin?.id}
                  onClick={() => setEdit({ ...edit, isActive: false })}
                >
                  Suspendu
                </button>
              </div>
            </div>
          </section>

          <section className="admin-staff-form__section">
            <header className="admin-staff-form__section-head">
              <h3>Sécurité</h3>
            </header>
            <label className="admin-dash__field">
              <span>Nouveau mot de passe</span>
              <input
                type="password"
                minLength={8}
                value={edit.password}
                onChange={(e) =>
                  setEdit({ ...edit, password: e.target.value })
                }
                placeholder="Optionnel — 8 caractères min."
                autoComplete="new-password"
              />
            </label>
          </section>

          <div className="admin-staff-form__actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </AdminModal>
      <AdminModal
        open={Boolean(pendingSuspend)}
        title="Suspendre l’agent"
        onClose={() => {
          if (!saving) setPendingSuspend(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Ban size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            L’agent ne pourra plus se connecter à la console.
          </p>
          {pendingSuspend ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Agent</span>
              <strong className="admin-delete-confirm__title">
                {pendingSuspend.name}
              </strong>
              <span className="admin-delete-confirm__slug">
                {pendingSuspend.email}
              </span>
            </div>
          ) : null}
          <div className="admin-delete-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={saving}
              onClick={() => setPendingSuspend(null)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--danger-vivid"
              disabled={saving}
              onClick={() => void confirmSuspend()}
            >
              <Ban className="h-4 w-4" strokeWidth={2} aria-hidden />
              {saving ? "Suspension…" : "Suspendre"}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}

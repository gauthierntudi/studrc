"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  AdminSponsorForm,
  type AdminSponsorFormValues,
} from "@/components/admin/admin-sponsor-form";
import { adminSponsorsApi, type AdminSponsor } from "@/lib/api";

const TAKE = 15;

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function AdminSponsorsPage() {
  const [items, setItems] = useState<AdminSponsor[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminSponsor | null | "new">(null);
  const [pendingDelete, setPendingDelete] = useState<AdminSponsor | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminSponsorsApi.list({
        q: q || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement sponsors",
      );
    } finally {
      setLoading(false);
    }
  }, [q, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSkip(0);
    setQ(qDraft.trim());
  }

  async function saveSponsor(values: AdminSponsorFormValues) {
    setSaving(true);
    try {
      if (editing === "new") {
        const created = await adminSponsorsApi.create({
          name: values.name,
          url: values.url,
        });
        if (values.logoFile) {
          await adminSponsorsApi.uploadLogo(created.id, values.logoFile);
        }
        toast.success("Sponsor ajouté");
      } else if (editing) {
        const nameChanged = values.name !== editing.name;
        const urlChanged = (values.url ?? null) !== (editing.url ?? null);
        if (nameChanged || urlChanged) {
          await adminSponsorsApi.update(editing.id, {
            name: values.name,
            url: values.url,
          });
        }
        if (values.logoFile) {
          await adminSponsorsApi.uploadLogo(editing.id, values.logoFile);
        }
        if (!nameChanged && !urlChanged && !values.logoFile) {
          setEditing(null);
          return;
        }
        toast.success("Sponsor mis à jour");
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminSponsorsApi.remove(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Sponsor supprimé");
      if (items.length <= 1 && skip > 0) {
        setSkip(Math.max(0, skip - TAKE));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec suppression",
      );
    } finally {
      setSaving(false);
    }
  }

  const formOpen = editing !== null;

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Sponsors</h1>
          <p>
            Logos partenaires réutilisables sur les articles ({total}{" "}
            sponsor{total > 1 ? "s" : ""}).
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={16} aria-hidden /> Nouveau sponsor
        </button>
      </header>

      <form className="admin-dash__filters" onSubmit={onSearch}>
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            type="search"
            placeholder="Nom ou lien…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={() => {
            setSkip(0);
            setQ(qDraft.trim());
          }}
        >
          Filtrer
        </button>
      </form>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Lien</th>
              <th>Articles</th>
              <th>Ajouté</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-dash__muted">
                  Aucun sponsor.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="admin-sub__user">
                      <span
                        className="admin-mag__thumb admin-mag__thumb--square"
                        aria-hidden
                      >
                        {row.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.logoUrl} alt="" />
                        ) : (
                          <span className="admin-mag__thumb-empty">—</span>
                        )}
                      </span>
                      <div className="admin-sub__user-meta">
                        <strong>{row.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-sponsor-page__link"
                      >
                        {row.url.replace(/^https?:\/\//i, "")}
                      </a>
                    ) : (
                      <span className="admin-dash__muted">—</span>
                    )}
                  </td>
                  <td>{row.articlesCount ?? 0}</td>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <div className="admin-dash__row-actions">
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        aria-label="Modifier"
                        title="Modifier"
                        onClick={() => setEditing(row)}
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--delete"
                        disabled={saving}
                        aria-label="Supprimer"
                        title="Supprimer"
                        onClick={() => setPendingDelete(row)}
                      >
                        <Trash2 size={16} strokeWidth={2} />
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
        open={formOpen}
        title={editing === "new" ? "Nouveau sponsor" : "Modifier le sponsor"}
        onClose={() => {
          if (!saving) setEditing(null);
        }}
      >
        {formOpen ? (
          <AdminSponsorForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            saving={saving}
            onCancel={() => {
              if (!saving) setEditing(null);
            }}
            onSubmit={saveSponsor}
          />
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(pendingDelete)}
        title="Supprimer le sponsor"
        onClose={() => {
          if (!saving) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            Cette action est <strong>définitive</strong>. Les articles liés
            n’auront plus de sponsor.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Sponsor</span>
              <strong className="admin-delete-confirm__title">
                {pendingDelete.name}
              </strong>
              {(pendingDelete.articlesCount ?? 0) > 0 ? (
                <span className="admin-delete-confirm__slug">
                  Lié à {pendingDelete.articlesCount} article
                  {(pendingDelete.articlesCount ?? 0) > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="admin-delete-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={saving}
              onClick={() => setPendingDelete(null)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--danger-vivid"
              disabled={saving}
              onClick={() => void confirmRemove()}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              {saving ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}

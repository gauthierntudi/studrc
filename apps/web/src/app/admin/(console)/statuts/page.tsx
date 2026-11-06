"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "react-toastify";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  AdminStatusForm,
  type AdminStatusFormValues,
} from "@/components/admin/admin-status-form";
import {
  adminStatusesApi,
  type AdminStatus,
  type AdminStatusInput,
} from "@/lib/api";

const TAKE = 15;

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function remaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.round(h / 24)} j`;
  if (h >= 1) return `${h} h`;
  return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

function StateBadge({ row }: { row: AdminStatus }) {
  if (row.state === "draft") {
    return <span className="admin-mag__badge">Brouillon</span>;
  }
  if (row.state === "expired") {
    return (
      <span className="admin-mag__badge admin-sub__badge--expired">Expiré</span>
    );
  }
  return (
    <span className="admin-mag__badge admin-mag__badge--on">
      En ligne · {remaining(row.expiresAt)}
    </span>
  );
}

function Thumb({ row }: { row: AdminStatus }) {
  const src =
    row.mediaType === "IMAGE"
      ? row.mediaUrl
      : row.mediaType === "VIDEO"
        ? row.posterUrl
        : row.article?.coverUrl;
  return (
    <span className="admin-status-thumb" aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : row.article ? (
        <FileText size={18} />
      ) : (
        <Type size={18} />
      )}
      {row.mediaType === "VIDEO" ? (
        <span className="admin-status-thumb__play">
          <Play size={12} fill="currentColor" />
        </span>
      ) : null}
    </span>
  );
}

function kindLabel(row: AdminStatus): string {
  if (row.mediaType === "VIDEO") return "Vidéo";
  if (row.mediaType === "IMAGE") return "Image";
  if (row.article) return "Article";
  return "Texte";
}

export default function AdminStatusesPage() {
  const [items, setItems] = useState<AdminStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminStatus | null | "new">(null);
  const [pendingDelete, setPendingDelete] = useState<AdminStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminStatusesApi.list({
        state: state || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur chargement statuts",
      );
    } finally {
      setLoading(false);
    }
  }, [state, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadMedia(id: string, values: AdminStatusFormValues) {
    if (!values.mediaFile) return;
    setProgress(0);
    const isVideo =
      values.mediaFile.type.startsWith("video/") ||
      /\.(mp4|mov|m4v)$/i.test(values.mediaFile.name);
    if (isVideo) {
      await adminStatusesApi.uploadVideo(id, values.mediaFile, {
        onProgress: setProgress,
      });
      if (values.posterFile) {
        await adminStatusesApi.uploadPoster(id, values.posterFile).catch(() => {
          toast.warn("Miniature vidéo non générée");
        });
      }
    } else {
      await adminStatusesApi.uploadImage(id, values.mediaFile, setProgress);
    }
  }

  async function saveStatus(values: AdminStatusFormValues) {
    setSaving(true);
    try {
      if (editing === "new") {
        const needsUpload = Boolean(values.mediaFile);
        const created = await adminStatusesApi.create({
          caption: values.caption,
          articleId: values.articleId,
          ttlHours: values.ttlHours ?? 24,
          durationSec: values.durationSec,
          imageFit: values.imageFit,
          isPublished: needsUpload ? false : values.publish,
        });
        await uploadMedia(created.id, values);
        if (needsUpload && values.publish) {
          await adminStatusesApi.update(created.id, { isPublished: true });
        }
        toast.success(values.publish ? "Statut publié" : "Brouillon enregistré");
      } else if (editing) {
        const publishing = values.publish && !editing.isPublished;
        const patch: AdminStatusInput = {
          caption: values.caption,
          articleId: values.articleId,
          durationSec: values.durationSec,
          imageFit: values.imageFit,
        };
        if (values.clearMedia && !values.mediaFile) patch.clearMedia = true;
        if (values.ttlHours && !publishing) patch.ttlHours = values.ttlHours;
        if (!values.publish && editing.isPublished) patch.isPublished = false;
        await adminStatusesApi.update(editing.id, patch);
        await uploadMedia(editing.id, values);
        if (publishing) {
          await adminStatusesApi.update(editing.id, {
            isPublished: true,
            ...(values.ttlHours ? { ttlHours: values.ttlHours } : {}),
          });
        }
        toast.success("Statut mis à jour");
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer",
      );
      await load();
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function quickUpdate(row: AdminStatus, input: AdminStatusInput, ok: string) {
    setSaving(true);
    try {
      await adminStatusesApi.update(row.id, input);
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminStatusesApi.remove(pendingDelete.id);
      setPendingDelete(null);
      toast.success("Statut supprimé");
      if (items.length <= 1 && skip > 0) {
        setSkip(Math.max(0, skip - TAKE));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec suppression");
    } finally {
      setSaving(false);
    }
  }

  const formOpen = editing !== null;

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Statuts</h1>
          <p>
            Stories éphémères affichées en bulles sur l’app mobile ({total}{" "}
            statut{total > 1 ? "s" : ""}).
          </p>
        </div>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={16} aria-hidden /> Nouveau statut
        </button>
      </header>

      <div className="admin-dash__filters">
        <label className="admin-dash__field admin-status-page__filter">
          <span>État</span>
          <select
            value={state}
            onChange={(e) => {
              setSkip(0);
              setState(e.target.value);
            }}
          >
            <option value="">Tous</option>
            <option value="active">En ligne</option>
            <option value="draft">Brouillons</option>
            <option value="expired">Expirés</option>
          </select>
        </label>
      </div>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Statut</th>
              <th>État</th>
              <th>Vues</th>
              <th>Publié</th>
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
                  Aucun statut.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="admin-sub__user">
                      <Thumb row={row} />
                      <div className="admin-sub__user-meta">
                        <strong className="admin-status-page__caption">
                          {row.caption || row.article?.title || "—"}
                        </strong>
                        <span className="admin-dash__muted">
                          {kindLabel(row)}
                          {row.article && (row.caption || row.mediaType)
                            ? ` · ${row.article.title}`
                            : ""}
                          {row.author ? ` · ${row.author.name}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StateBadge row={row} />
                  </td>
                  <td>{row.viewCount}</td>
                  <td>
                    {row.publishedAt ? formatWhen(row.publishedAt) : "—"}
                  </td>
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
                      {row.state === "expired" ? (
                        <button
                          type="button"
                          className="admin-dash__icon-action"
                          disabled={saving}
                          aria-label="Relancer 24 h"
                          title="Relancer 24 h"
                          onClick={() =>
                            void quickUpdate(row, { ttlHours: 24 }, "Statut relancé pour 24 h")
                          }
                        >
                          <RotateCcw size={16} strokeWidth={2} />
                        </button>
                      ) : row.isPublished ? (
                        <button
                          type="button"
                          className="admin-dash__icon-action"
                          disabled={saving}
                          aria-label="Masquer"
                          title="Masquer de l’app"
                          onClick={() =>
                            void quickUpdate(row, { isPublished: false }, "Statut masqué")
                          }
                        >
                          <EyeOff size={16} strokeWidth={2} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-dash__icon-action"
                          disabled={saving}
                          aria-label="Publier"
                          title="Publier"
                          onClick={() =>
                            void quickUpdate(row, { isPublished: true }, "Statut publié")
                          }
                        >
                          <Eye size={16} strokeWidth={2} />
                        </button>
                      )}
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
        wide
        title={editing === "new" ? "Nouveau statut" : "Modifier le statut"}
        onClose={() => {
          if (!saving) setEditing(null);
        }}
      >
        {formOpen ? (
          <AdminStatusForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            saving={saving}
            progress={progress}
            onCancel={() => {
              if (!saving) setEditing(null);
            }}
            onSubmit={saveStatus}
          />
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(pendingDelete)}
        title="Supprimer le statut"
        onClose={() => {
          if (!saving) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            Cette action est <strong>définitive</strong> : le statut et son
            média seront supprimés.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Statut</span>
              <strong className="admin-delete-confirm__title">
                {pendingDelete.caption ||
                  pendingDelete.article?.title ||
                  kindLabel(pendingDelete)}
              </strong>
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

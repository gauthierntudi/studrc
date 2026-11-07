"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FileText,
  Layers,
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
  statusLabel,
  type AdminStatusFormValues,
  type StatusSlideDraft,
} from "@/components/admin/admin-status-form";
import {
  adminStatusesApi,
  type AdminStatus,
  type AdminStatusInput,
  type AdminStatusSlide,
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
  const first = row.slides[0];
  const src =
    first?.mediaType === "IMAGE"
      ? first.mediaUrl
      : first?.mediaType === "VIDEO"
        ? first.posterUrl
        : first?.article?.coverUrl;
  return (
    <span className="admin-status-thumb" aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : first?.article ? (
        <FileText size={18} />
      ) : (
        <Type size={18} />
      )}
      {first?.mediaType === "VIDEO" ? (
        <span className="admin-status-thumb__play">
          <Play size={12} fill="currentColor" />
        </span>
      ) : null}
      {row.slides.length > 1 ? (
        <span className="admin-status-thumb__count">{row.slides.length}</span>
      ) : null}
    </span>
  );
}

function slideKind(slide: AdminStatusSlide | undefined): string {
  if (slide?.mediaType === "VIDEO") return "Vidéo";
  if (slide?.mediaType === "IMAGE") return "Image";
  if (slide?.article) return "Article";
  return "Texte";
}

function kindLabel(row: AdminStatus): string {
  if (row.slides.length > 1) return `${row.slides.length} diapos`;
  return slideKind(row.slides[0]);
}

/** Articles liés (dédoublonnés) pour la ligne de liste. */
function linkedArticles(row: AdminStatus): string[] {
  return [
    ...new Set(
      row.slides
        .map((s) => s.article?.title)
        .filter((t): t is string => Boolean(t)),
    ),
  ];
}

function slideFields(slide: StatusSlideDraft) {
  return {
    caption: slide.caption.trim() || null,
    articleId: slide.article?.id ?? null,
    durationSec: slide.durationSec,
    imageFit: slide.imageFit,
  };
}

function slideChanged(slide: StatusSlideDraft, original?: AdminStatusSlide) {
  if (!original) return true;
  const next = slideFields(slide);
  return (
    slide.clearMedia ||
    next.caption !== (original.caption?.trim() || null) ||
    next.articleId !== original.articleId ||
    next.durationSec !== original.durationSec ||
    next.imageFit !== original.imageFit
  );
}

export default function AdminStatusesPage() {
  const [items, setItems] = useState<AdminStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [state, setState] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminStatus | null | "new">(null);
  const [pendingDelete, setPendingDelete] = useState<AdminStatus | null>(null);
  const [merging, setMerging] = useState<AdminStatus | null>(null);
  const [mergeTargets, setMergeTargets] = useState<AdminStatus[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");

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

  async function uploadSlideMedia(
    slideId: string,
    slide: StatusSlideDraft,
    label: string,
  ) {
    const file = slide.mediaFile;
    if (!file) return;
    const report = (pct: number) => setProgress(`${label} · envoi ${pct}%`);
    report(0);
    if (slide.preview?.type === "VIDEO") {
      await adminStatusesApi.uploadSlideVideo(slideId, file, {
        onProgress: report,
      });
      if (slide.posterFile) {
        await adminStatusesApi
          .uploadSlidePoster(slideId, slide.posterFile)
          .catch(() => {
            toast.warn("Miniature vidéo non générée");
          });
      }
    } else {
      await adminStatusesApi.uploadSlideImage(slideId, file, report);
    }
  }

  /**
   * Enregistre les diapos d’un statut : créations / modifications / médias,
   * puis suppressions et ordre final.
   */
  async function persistSlides(
    statusId: string,
    values: AdminStatusFormValues,
    original: AdminStatus | null,
  ) {
    const byId = new Map(original?.slides.map((s) => [s.id, s]) ?? []);
    const ids: string[] = [];
    for (const [i, slide] of values.slides.entries()) {
      const label = `Diapo ${i + 1}/${values.slides.length}`;
      setProgress(label);
      let id = slide.id;
      if (!id) {
        id = (await adminStatusesApi.createSlide(statusId, slideFields(slide))).id;
      } else if (slideChanged(slide, byId.get(id))) {
        await adminStatusesApi.updateSlide(id, {
          ...slideFields(slide),
          ...(slide.clearMedia && !slide.mediaFile ? { clearMedia: true } : {}),
        });
      }
      await uploadSlideMedia(id, slide, label);
      ids.push(id);
    }
    for (const id of values.removedSlideIds) {
      await adminStatusesApi.removeSlide(id);
    }
    if (original) {
      const current = original.slides
        .map((s) => s.id)
        .filter((id) => !values.removedSlideIds.includes(id));
      const added = ids.filter((id) => !byId.has(id));
      const serverOrder = [...current, ...added];
      if (ids.join() !== serverOrder.join()) {
        await adminStatusesApi.reorderSlides(statusId, ids);
      }
    }
  }

  async function saveStatus(values: AdminStatusFormValues) {
    setSaving(true);
    try {
      if (editing === "new" && values.targetId) {
        // Ajout de diapos à un statut existant
        await persistSlides(values.targetId, values, null);
        toast.success(
          `${values.slides.length} diapo${values.slides.length > 1 ? "s" : ""} ajoutée${values.slides.length > 1 ? "s" : ""} au statut`,
        );
      } else if (editing === "new") {
        const created = await adminStatusesApi.create({
          title: values.title || null,
          ttlHours: values.ttlHours ?? 24,
        });
        await persistSlides(created.id, values, null);
        if (values.publish) {
          await adminStatusesApi.update(created.id, { isPublished: true });
        }
        toast.success(values.publish ? "Statut publié" : "Brouillon enregistré");
      } else if (editing) {
        const publishing = values.publish && !editing.isPublished;
        if (!values.publish && editing.isPublished) {
          await adminStatusesApi.update(editing.id, { isPublished: false });
        }
        await persistSlides(editing.id, values, editing);
        const patch: AdminStatusInput = {};
        if (publishing) patch.isPublished = true;
        if (values.ttlHours) patch.ttlHours = values.ttlHours;
        if (values.title !== (editing.title ?? "")) {
          patch.title = values.title || null;
        }
        if (Object.keys(patch).length) {
          await adminStatusesApi.update(editing.id, patch);
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

  async function openMerge(row: AdminStatus) {
    setMerging(row);
    setMergeTarget("");
    setMergeTargets([]);
    try {
      const res = await adminStatusesApi.list({ take: 50 });
      setMergeTargets(
        res.items.filter((s) => s.id !== row.id && s.state !== "expired"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur chargement");
    }
  }

  async function confirmMerge() {
    if (!merging || !mergeTarget) return;
    setSaving(true);
    try {
      await adminStatusesApi.merge(merging.id, mergeTarget);
      toast.success("Statuts regroupés");
      setMerging(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du regroupement");
    } finally {
      setSaving(false);
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

  async function move(row: AdminStatus, direction: "up" | "down") {
    setSaving(true);
    try {
      await adminStatusesApi.move(row.id, direction);
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
  /** Filtre « En ligne » : liste dans l’ordre de l’app, réordonnable */
  const ordering = state === "active";

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
            <option value="active">En ligne</option>
            <option value="">Tous</option>
            <option value="draft">Brouillons</option>
            <option value="expired">Expirés</option>
          </select>
        </label>
        <p className="admin-dash__muted admin-status-page__hint">
          {ordering
            ? "Ordre des bulles dans l’app : utilisez les flèches pour le modifier. Les nouveaux statuts arrivent en tête."
            : "Filtrez sur « En ligne » pour définir l’ordre d’affichage dans l’app."}
        </p>
      </div>

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              {ordering ? <th>Ordre</th> : null}
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
                <td colSpan={ordering ? 6 : 5} className="admin-dash__muted">
                  Chargement…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={ordering ? 6 : 5} className="admin-dash__muted">
                  Aucun statut.
                </td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr key={row.id}>
                  {ordering ? (
                    <td>
                      <div className="admin-status-page__order">
                        <strong>{skip + i + 1}</strong>
                        <button
                          type="button"
                          className="admin-dash__icon-action"
                          disabled={saving || skip + i === 0}
                          aria-label="Monter"
                          title="Afficher plus tôt"
                          onClick={() => void move(row, "up")}
                        >
                          <ArrowUp size={15} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className="admin-dash__icon-action"
                          disabled={saving || skip + i >= total - 1}
                          aria-label="Descendre"
                          title="Afficher plus tard"
                          onClick={() => void move(row, "down")}
                        >
                          <ArrowDown size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                  <td>
                    <div className="admin-sub__user">
                      <Thumb row={row} />
                      <div className="admin-sub__user-meta">
                        <strong className="admin-status-page__caption">
                          {statusLabel(row)}
                        </strong>
                        <span className="admin-dash__muted">
                          {kindLabel(row)}
                          {linkedArticles(row).length
                            ? ` · ${linkedArticles(row).join(", ")}`
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
                        className="admin-dash__icon-action"
                        disabled={saving}
                        aria-label="Regrouper avec…"
                        title="Regrouper avec un autre statut"
                        onClick={() => void openMerge(row)}
                      >
                        <Layers size={16} strokeWidth={2} />
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
            Cette action est <strong>définitive</strong> : le statut, ses
            diapos et leurs médias seront supprimés.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Statut</span>
              <strong className="admin-delete-confirm__title">
                {statusLabel(pendingDelete)}
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

      <AdminModal
        open={Boolean(merging)}
        title="Regrouper avec un autre statut"
        onClose={() => {
          if (!saving) setMerging(null);
        }}
      >
        {merging ? (
          <div className="admin-status-merge">
            <div className="admin-status-merge__source">
              <Thumb row={merging} />
              <div className="admin-status-merge__meta">
                <span className="admin-status-merge__label">À regrouper</span>
                <strong className="admin-status-merge__title">
                  {statusLabel(merging)}
                </strong>
                <span className="admin-dash__muted">
                  {merging.slides.length} diapo
                  {merging.slides.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="admin-status-merge__arrow" aria-hidden>
              <ArrowDown size={16} strokeWidth={2.2} />
            </div>

            <div className="admin-status-merge__pick">
              <span className="admin-status-merge__label">Regrouper dans</span>
              {mergeTargets.length === 0 ? (
                <p className="admin-dash__muted admin-status-merge__empty">
                  Aucun autre statut en ligne ou en brouillon.
                </p>
              ) : (
                <div
                  className="admin-status-merge__list"
                  role="radiogroup"
                  aria-label="Statut de destination"
                >
                  {mergeTargets.map((t) => {
                    const selected = mergeTarget === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={saving}
                        className={`admin-status-merge__option${selected ? " is-selected" : ""}`}
                        onClick={() => setMergeTarget(t.id)}
                      >
                        <Thumb row={t} />
                        <span className="admin-status-merge__meta">
                          <span className="admin-status-merge__title">
                            {statusLabel(t)}
                          </span>
                          <span className="admin-dash__muted">
                            {t.slides.length} diapo
                            {t.slides.length > 1 ? "s" : ""} ·{" "}
                            {t.state === "draft" ? "Brouillon" : "En ligne"}
                          </span>
                        </span>
                        <span className="admin-status-merge__radio" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="admin-status-merge__note">
              Les diapos passeront à la suite du statut choisi, qui garde sa
              visibilité et sa place dans les bulles. Ce statut-ci disparaîtra.
            </p>

            <div className="admin-sponsor-form__actions">
              <button
                type="button"
                className="admin-dash__btn"
                disabled={saving}
                onClick={() => setMerging(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="admin-dash__btn admin-dash__btn--primary"
                disabled={saving || !mergeTarget}
                onClick={() => void confirmMerge()}
              >
                <Layers size={16} aria-hidden />
                {saving ? "Regroupement…" : "Regrouper"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminModal>
    </>
  );
}

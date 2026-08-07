"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Alert } from "@/components/ui/alert";
import {
  ARTICLE_CATEGORIES,
  adminArticlesApi,
  type AdminArticle,
  type AdminArticleSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TAKE = 10;

function categoryLabel(value: string | null): string {
  if (!value) return "—";
  const found = ARTICLE_CATEGORIES.find((c) => c.value === value);
  return found?.label ?? value;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminArticleSummary | null>(null);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [published, setPublished] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminArticle | null>(
    null,
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminArticlesApi.list({
        q,
        published: published || undefined,
        category: category || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [q, published, category, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePublish(row: AdminArticle) {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await adminArticlesApi.update(row.id, {
        isPublished: !row.isPublished,
      });
      setOk(row.isPublished ? "Repassée en brouillon" : "Actualité publiée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec publication");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await adminArticlesApi.remove(row.id);
      setPendingDelete(null);
      setOk("Actualité supprimée");
      if (items.length <= 1 && skip > 0) {
        setSkip(Math.max(0, skip - TAKE));
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec suppression");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Actualités</h1>
          <p>
            Articles éditoriaux ({total} résultat{total > 1 ? "s" : ""}
            {summary ? ` · ${summary.total} au total` : ""}).
          </p>
        </div>
        <Link
          href="/admin/actualites/nouveau"
          className="admin-dash__btn admin-dash__btn--primary"
        >
          <Plus size={16} aria-hidden /> Nouvelle actualité
        </Link>
      </header>

      {summary ? (
        <section
          className="admin-dash__kpis-row"
          aria-label="Statistiques actualités"
          style={{ ["--kpi-count" as string]: "3" }}
        >
          {(
            [
              {
                key: "total",
                label: "Total",
                value: formatCount(summary.total),
                color: "teal" as const,
                active: !published && !category,
                onSelect: () => {
                  setSkip(0);
                  setPublished("");
                  setCategory("");
                },
              },
              {
                key: "published",
                label: "Publiés",
                value: formatCount(summary.published),
                color: "green" as const,
                active: published === "true" && !category,
                onSelect: () => {
                  setSkip(0);
                  setPublished("true");
                  setCategory("");
                },
              },
              {
                key: "drafts",
                label: "Brouillons",
                value: formatCount(summary.drafts),
                color: "gold" as const,
                active: published === "false" && !category,
                onSelect: () => {
                  setSkip(0);
                  setPublished("false");
                  setCategory("");
                },
              },
            ] as const
          ).map((card) => (
            <article
              key={card.key}
              role="button"
              tabIndex={0}
              aria-pressed={card.active}
              className={cn(
                "snow-dash__kpi admin-dash__kpi-compact admin-dash__kpi-vivid",
                `admin-dash__kpi-vivid--${card.color}`,
                card.active && "admin-dash__kpi-vivid--active",
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
            placeholder="titre, slug, extrait…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={published}
            onChange={(e) => {
              setSkip(0);
              setPublished(e.target.value);
            }}
          >
            <option value="">Tous</option>
            <option value="true">Publié</option>
            <option value="false">Brouillon</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Rubrique</span>
          <select
            value={category}
            onChange={(e) => {
              setSkip(0);
              setCategory(e.target.value);
            }}
          >
            <option value="">Toutes</option>
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
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

      {error ? <Alert variant="error">{error}</Alert> : null}
      {ok ? <Alert variant="success">{ok}</Alert> : null}

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Rubrique</th>
              <th>Statut</th>
              <th>Vues</th>
              <th>Publié</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-dash__muted">
                  Aucune actualité.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  className="admin-dash__table-row--click"
                  onClick={() =>
                    router.push(`/admin/actualites/${row.id}/modifier`)
                  }
                >
                  <td>
                    <div className="admin-sub__user">
                      <span
                        className="admin-mag__thumb admin-mag__thumb--landscape"
                        aria-hidden
                      >
                        {row.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.coverUrl} alt="" />
                        ) : (
                          <span className="admin-mag__thumb-empty">—</span>
                        )}
                      </span>
                      <div className="admin-sub__user-meta">
                        <strong>{row.title}</strong>
                        <span className="admin-dash__muted">/{row.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>{categoryLabel(row.category)}</td>
                  <td>
                    <div className="admin-dash__status-stack">
                      <span
                        className={
                          row.isPublished
                            ? "admin-mag__badge admin-mag__badge--on"
                            : "admin-mag__badge admin-sub__badge--pending"
                        }
                      >
                        {row.isPublished ? "Publié" : "Brouillon"}
                      </span>
                      {row.isFeatured ? (
                        <span className="admin-mag__badge admin-mag__badge--featured">
                          À la une
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatCount(row.viewCount)}</td>
                  <td>{formatWhen(row.publishedAt)}</td>
                  <td>
                    <div
                      className="admin-dash__row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/admin/actualites/${row.id}/modifier`}
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        aria-label="Modifier"
                        title="Modifier"
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </Link>
                      <button
                        type="button"
                        className={
                          row.isPublished
                            ? "admin-dash__icon-action admin-dash__icon-action--unpublish"
                            : "admin-dash__icon-action admin-dash__icon-action--publish"
                        }
                        disabled={saving}
                        aria-label={
                          row.isPublished ? "Dépublier" : "Publier"
                        }
                        title={row.isPublished ? "Dépublier" : "Publier"}
                        onClick={() => void togglePublish(row)}
                      >
                        {row.isPublished ? (
                          <EyeOff size={16} strokeWidth={2} />
                        ) : (
                          <Eye size={16} strokeWidth={2} />
                        )}
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
        open={Boolean(pendingDelete)}
        title="Supprimer l’actualité"
        onClose={() => {
          if (!saving) setPendingDelete(null);
        }}
      >
        <div className="admin-delete-confirm">
          <div className="admin-delete-confirm__icon" aria-hidden>
            <Trash2 size={22} strokeWidth={2} />
          </div>
          <p className="admin-delete-confirm__lead">
            Cette action est <strong>définitive</strong> et ne peut pas être
            annulée.
          </p>
          {pendingDelete ? (
            <div className="admin-delete-confirm__target">
              <span className="admin-delete-confirm__label">Article</span>
              <strong className="admin-delete-confirm__title">
                {pendingDelete.title}
              </strong>
              <span className="admin-delete-confirm__slug">
                /{pendingDelete.slug}
              </span>
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminRichEditor } from "@/components/admin/admin-rich-editor";
import {
  ARTICLE_CATEGORIES,
  adminArticlesApi,
  adminMagazinesApi,
  type AdminArticle,
  type AdminMagazine,
} from "@/lib/api";

const MAG_FALLBACK_COVER = "/legacy/covers/1591457791.jpg";

function normalizeMagQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
type FormBlock = {
  key: string;
  id?: string;
  title: string;
  content: string;
  coverCaption: string;
  coverFile: File | null;
  coverPreview: string | null;
};

type ArticleForm = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverCaption: string;
  isPublished: boolean;
  isFeatured: boolean;
  magazineId: string;
  blocks: FormBlock[];
};

function newBlock(partial?: Partial<FormBlock>): FormBlock {
  return {
    key: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    content: "",
    coverCaption: "",
    coverFile: null,
    coverPreview: null,
    ...partial,
  };
}

function emptyForm(): ArticleForm {
  return {
    title: "",
    slug: "",
    excerpt: "",
    category: "",
    coverCaption: "",
    isPublished: false,
    isFeatured: false,
    magazineId: "",
    blocks: [newBlock()],
  };
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function fromArticle(a: AdminArticle): ArticleForm {
  const blocks =
    a.blocks?.length > 0
      ? a.blocks.map((b) =>
          newBlock({
            id: b.id ?? undefined,
            title: b.title ?? "",
            content: b.content ?? "",
            coverCaption: b.coverCaption ?? "",
            coverPreview: b.coverUrl,
          }),
        )
      : a.content?.trim()
        ? [newBlock({ content: a.content })]
        : [newBlock()];

  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt ?? "",
    category: a.category ?? "",
    coverCaption: a.coverCaption ?? "",
    isPublished: a.isPublished,
    isFeatured: Boolean(a.isFeatured),
    magazineId: a.magazineId ?? "",
    blocks,
  };
}

function toPayload(form: ArticleForm) {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim() || null,
    category: form.category.trim() || null,
    coverCaption: form.coverCaption.trim() || null,
    isPublished: form.isPublished,
    isFeatured: form.isFeatured,
    magazineId: form.magazineId.trim() || null,
    blocks: form.blocks.map((b, i) => ({
      id: b.id,
      title: b.title.trim() || null,
      coverCaption: b.coverCaption.trim() || null,
      content: b.content,
      position: i,
    })),
  };
}

type AdminArticleFormProps = {
  mode: "create" | "edit";
  articleId?: string;
};

export function AdminArticleForm({ mode, articleId }: AdminArticleFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [magazines, setMagazines] = useState<AdminMagazine[]>([]);
  const [magPickerOpen, setMagPickerOpen] = useState(false);
  const [magSearch, setMagSearch] = useState("");
  const magPickerRef = useRef<HTMLDivElement>(null);
  const magSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!magPickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!magPickerRef.current?.contains(e.target as Node)) {
        setMagPickerOpen(false);
        setMagSearch("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMagPickerOpen(false);
        setMagSearch("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => magSearchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [magPickerOpen]);

  useEffect(() => {
    let cancelled = false;
    void adminMagazinesApi
      .list({ take: 100 })
      .then((res) => {
        if (!cancelled) setMagazines(res.items);
      })
      .catch(() => {
        if (!cancelled) setMagazines([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !articleId) return;
    let cancelled = false;
    setLoading(true);
    void adminArticlesApi
      .get(articleId)
      .then((row) => {
        if (cancelled) return;
        setForm(fromArticle(row));
        setSlugTouched(true);
        setCoverFile(null);
        setCoverPreview(row.coverUrl);
        if (row.magazine) {
          const linked = row.magazine;
          setMagazines((prev) => {
            if (prev.some((m) => m.id === linked.id)) return prev;
            return [
              {
                id: linked.id,
                legacyId: null,
                title: linked.title,
                issueNumber: linked.issueNumber,
                description: null,
                accessType: "PAID",
                priceCents: null,
                currency: "USD",
                theme: { bgColor: "#0d203d", accentColor: "#02d0d1" },
                coverKey: null,
                coverUrl: linked.coverUrl,
                pdfKey: null,
                previewKey: null,
                downloadKey: null,
                pagesStatus: "PENDING",
                pagesCount: null,
                pagesError: null,
                generatedPageCount: 0,
                viewCount: 0,
                isPublished: linked.isPublished,
                isActive: linked.isActive,
                publishedAt: linked.publishedAt,
                createdAt: "",
                updatedAt: "",
              },
              ...prev,
            ];
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "Actualité introuvable",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, articleId]);

  function updateBlock(key: string, patch: Partial<FormBlock>) {
    setForm((f) => ({
      ...f,
      blocks: f.blocks.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    }));
  }

  function addBlock(afterIndex?: number) {
    setForm((f) => {
      const block = newBlock();
      if (afterIndex == null || afterIndex < 0) {
        return { ...f, blocks: [...f.blocks, block] };
      }
      const blocks = [...f.blocks];
      blocks.splice(Math.min(afterIndex + 1, blocks.length), 0, block);
      return { ...f, blocks };
    });
  }

  function removeBlock(key: string) {
    setForm((f) => ({
      ...f,
      blocks:
        f.blocks.length <= 1
          ? f.blocks
          : f.blocks.filter((b) => b.key !== key),
    }));
  }

  function moveBlock(key: string, dir: -1 | 1) {
    setForm((f) => {
      const idx = f.blocks.findIndex((b) => b.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= f.blocks.length) return f;
      const blocks = [...f.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(next, 0, item!);
      return { ...f, blocks };
    });
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    if (!form.excerpt.trim()) {
      toast.error("Le chapeau est obligatoire");
      return;
    }
    if (!form.blocks.some((b) => b.content.trim())) {
      toast.error("Ajoutez au moins une sous-description");
      return;
    }

    setSaving(true);
    try {
      const pendingCovers = form.blocks.map((b) => b.coverFile);
      const payload = toPayload(form);
      let saved: AdminArticle;
      if (isEdit && articleId) {
        saved = await adminArticlesApi.update(articleId, payload);
      } else {
        saved = await adminArticlesApi.create(payload);
      }
      if (coverFile) {
        saved = await adminArticlesApi.uploadCover(saved.id, coverFile);
      }
      for (let i = 0; i < pendingCovers.length; i++) {
        const file = pendingCovers[i];
        const blockId = saved.blocks[i]?.id;
        if (file && blockId) {
          saved = await adminArticlesApi.uploadBlockCover(
            saved.id,
            blockId,
            file,
          );
        }
      }

      setForm(fromArticle(saved));
      setSlugTouched(true);
      setCoverFile(null);
      setCoverPreview(saved.coverUrl);
      toast.success(
        isEdit ? "Actualité mise à jour" : "Actualité créée",
      );

      if (!isEdit) {
        router.replace(`/admin/actualites/${saved.id}/modifier`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec enregistrement",
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedMagazine =
    magazines.find((m) => m.id === form.magazineId) ?? null;

  const magQuery = normalizeMagQuery(magSearch);
  const filteredMagazines = magQuery
    ? magazines.filter((m) => {
        const hay = normalizeMagQuery(
          `${m.title} ${m.issueNumber ?? ""} ${m.isPublished ? "" : "brouillon"}`,
        );
        return hay.includes(magQuery);
      })
    : magazines;

  return (
    <div className="admin-article-page">
      <header className="admin-dash__header">
        <div>
          <Link
            href="/admin/actualites"
            className="admin-article-page__back"
          >
            <ArrowLeft size={16} aria-hidden />
            Retour aux actualités
          </Link>
          <h1>{isEdit ? "Modifier l’actualité" : "Nouvelle actualité"}</h1>
          <p>
            {isEdit
              ? "Mettez à jour l’en-tête et les sections de l’article."
              : "Renseignez l’en-tête, puis ajoutez autant de sections que nécessaire."}
          </p>
        </div>
        <div className="admin-article-page__header-actions">
          <Link
            href="/admin/actualites"
            className="admin-dash__btn"
            aria-disabled={saving}
          >
            Annuler
          </Link>
          <button
            type="button"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={saving || loading}
            onClick={() => void save()}
          >
            {saving
              ? "Enregistrement…"
              : isEdit
                ? "Enregistrer"
                : "Créer"}
          </button>
        </div>
      </header>

      {loading ? (
        <p className="admin-dash__muted">Chargement…</p>
      ) : (
        <div className="admin-article__blocks admin-article__blocks--page">
          <section
            className="admin-article__block"
            aria-labelledby="article-meta"
          >
            <div className="admin-article__block-head">
              <h2 id="article-meta" className="admin-article__block-title">
                Article
              </h2>
              <p className="admin-article__block-hint">
                Titre principal, chapeau et couverture
              </p>
            </div>
            <div className="admin-dash__form">
              <label className="admin-dash__field">
                <span>Titre</span>
                <textarea
                  rows={2}
                  value={form.title}
                  disabled={saving}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({
                      ...f,
                      title,
                      slug: slugTouched ? f.slug : slugify(title),
                    }));
                  }}
                  placeholder="Titre de l’article"
                />
              </label>
              <label className="admin-dash__field">
                <span>Chapeau</span>
                <textarea
                  rows={3}
                  value={form.excerpt}
                  disabled={saving}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, excerpt: e.target.value }))
                  }
                  placeholder="Accroche affichée sous le titre"
                />
              </label>
              <label className="admin-dash__field">
                <span>Slug</span>
                <input
                  value={form.slug}
                  disabled={saving}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({
                      ...f,
                      slug: slugify(e.target.value),
                    }));
                  }}
                  placeholder="genere-automatiquement"
                />
              </label>
                <div className="admin-dash__form-grid">
                  <label className="admin-dash__field">
                    <span>Rubrique</span>
                    <select
                      value={form.category}
                      disabled={saving}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      <option value="">Sans rubrique</option>
                      {ARTICLE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-dash__field">
                    <span>Publication</span>
                    <select
                      value={form.isPublished ? "1" : "0"}
                      disabled={saving}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isPublished: e.target.value === "1",
                        }))
                      }
                    >
                      <option value="0">Brouillon</option>
                      <option value="1">Publié</option>
                    </select>
                  </label>
                </div>
                <div className="admin-dash__field">
                  <span>Magazine lié (kiosque)</span>
                  <div className="admin-mag-picker" ref={magPickerRef}>
                    <button
                      type="button"
                      className="admin-mag-picker__trigger"
                      disabled={saving}
                      aria-haspopup="listbox"
                      aria-expanded={magPickerOpen}
                      onClick={() =>
                        setMagPickerOpen((o) => {
                          if (o) setMagSearch("");
                          return !o;
                        })
                      }
                    >
                      {selectedMagazine ? (
                        <>
                          <span className="admin-mag-picker__cover">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                selectedMagazine.coverUrl || MAG_FALLBACK_COVER
                              }
                              alt=""
                            />
                          </span>
                          <span className="admin-mag-picker__label">
                            <strong>{selectedMagazine.title}</strong>
                            {selectedMagazine.issueNumber ? (
                              <em>N° {selectedMagazine.issueNumber}</em>
                            ) : null}
                          </span>
                        </>
                      ) : (
                        <span className="admin-mag-picker__placeholder">
                          Aucun magazine
                        </span>
                      )}
                      <ChevronDown
                        size={16}
                        strokeWidth={2.25}
                        className="admin-mag-picker__chevron"
                        aria-hidden
                      />
                    </button>
                    {magPickerOpen ? (
                      <div className="admin-mag-picker__panel">
                        <div className="admin-mag-picker__search">
                          <Search
                            size={15}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                          <input
                            ref={magSearchRef}
                            type="search"
                            value={magSearch}
                            placeholder="Rechercher un magazine…"
                            aria-label="Rechercher un magazine"
                            onChange={(e) => setMagSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <ul
                          className="admin-mag-picker__list"
                          role="listbox"
                          aria-label="Choisir un magazine"
                        >
                          {!magQuery ? (
                            <li role="option" aria-selected={!form.magazineId}>
                              <button
                                type="button"
                                className={`admin-mag-picker__option${
                                  !form.magazineId ? " is-selected" : ""
                                }`}
                                onClick={() => {
                                  setForm((f) => ({ ...f, magazineId: "" }));
                                  setMagPickerOpen(false);
                                  setMagSearch("");
                                }}
                              >
                                <span className="admin-mag-picker__cover admin-mag-picker__cover--empty" />
                                <span className="admin-mag-picker__label">
                                  <strong>Aucun magazine</strong>
                                </span>
                                {!form.magazineId ? (
                                  <Check
                                    size={16}
                                    strokeWidth={2.5}
                                    className="admin-mag-picker__check"
                                    aria-hidden
                                  />
                                ) : null}
                              </button>
                            </li>
                          ) : null}
                          {filteredMagazines.length === 0 ? (
                            <li className="admin-mag-picker__empty">
                              Aucun résultat
                            </li>
                          ) : (
                            filteredMagazines.map((m) => {
                              const selected = form.magazineId === m.id;
                              return (
                                <li
                                  key={m.id}
                                  role="option"
                                  aria-selected={selected}
                                >
                                  <button
                                    type="button"
                                    className={`admin-mag-picker__option${
                                      selected ? " is-selected" : ""
                                    }`}
                                    onClick={() => {
                                      setForm((f) => ({
                                        ...f,
                                        magazineId: m.id,
                                      }));
                                      setMagPickerOpen(false);
                                      setMagSearch("");
                                    }}
                                  >
                                    <span className="admin-mag-picker__cover">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={m.coverUrl || MAG_FALLBACK_COVER}
                                        alt=""
                                      />
                                    </span>
                                    <span className="admin-mag-picker__label">
                                      <strong>{m.title}</strong>
                                      <em>
                                        {m.issueNumber
                                          ? `N° ${m.issueNumber}`
                                          : null}
                                        {!m.isPublished
                                          ? `${m.issueNumber ? " · " : ""}brouillon`
                                          : null}
                                      </em>
                                    </span>
                                    {selected ? (
                                      <Check
                                        size={16}
                                        strokeWidth={2.5}
                                        className="admin-mag-picker__check"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <span className="admin-dash__switch-hint">
                    Affiché sur l’article avec un accès direct au kiosque
                  </span>
                </div>
                <label className="admin-dash__switch">
                  <span className="admin-dash__switch-meta">
                    <span className="admin-dash__switch-label">À la une</span>
                    <span className="admin-dash__switch-hint">
                      Mettre en avant sur la page d’accueil
                    </span>
                  </span>
                  <span className="admin-dash__switch-control">
                    <input
                      type="checkbox"
                      className="admin-dash__switch-input"
                      checked={form.isFeatured}
                      disabled={saving}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isFeatured: e.target.checked,
                        }))
                      }
                    />
                    <span className="admin-dash__switch-track" aria-hidden />
                  </span>
                </label>
                <AdminDropzone
                variant="image"
                accept="image/jpeg,image/png,image/webp"
                label="Cover principale"
                hint="Glisser-déposer ou cliquer · JPG, PNG, WEBP · max 5 Mo"
                fileName={coverFile?.name ?? (coverPreview ? "cover" : null)}
                previewUrl={coverPreview}
                onFile={(file) => {
                  setCoverFile(file);
                  if (file) setCoverPreview(URL.createObjectURL(file));
                }}
              />
              <label className="admin-dash__field">
                <span>Légende de la cover</span>
                <input
                  value={form.coverCaption}
                  disabled={saving}
                  maxLength={500}
                  placeholder="Optionnel — affichée sous la photo"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, coverCaption: e.target.value }))
                  }
                />
              </label>
            </div>
          </section>

          <div className="admin-article__sections-head">
            <div>
              <h2 className="admin-article__block-title">Sections</h2>
              <p className="admin-article__block-hint">
                Sous-titre · sous-cover · sous-description (éditeur riche)
              </p>
            </div>
            <button
              type="button"
              className="admin-dash__btn"
              disabled={saving}
              onClick={() => addBlock()}
            >
              <Plus size={16} aria-hidden />
              Ajouter une section
            </button>
          </div>

          {form.blocks.map((block, index) => (
            <div key={block.key} className="admin-article__block-wrap">
            <section
              className="admin-article__block"
              aria-labelledby={`article-section-${block.key}`}
            >
              <div className="admin-article__block-head">
                <h2
                  id={`article-section-${block.key}`}
                  className="admin-article__block-title"
                >
                  Section {index + 1}
                </h2>
                <div className="admin-article__block-actions">
                  <button
                    type="button"
                    className="admin-dash__icon-btn"
                    disabled={saving || index === 0}
                    aria-label="Monter"
                    title="Monter"
                    onClick={() => moveBlock(block.key, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-dash__icon-btn"
                    disabled={saving || index === form.blocks.length - 1}
                    aria-label="Descendre"
                    title="Descendre"
                    onClick={() => moveBlock(block.key, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-dash__icon-btn"
                    disabled={saving}
                    aria-label="Ajouter une section après"
                    title="Ajouter une section après"
                    onClick={() => addBlock(index)}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-dash__icon-btn"
                    disabled={saving || form.blocks.length <= 1}
                    aria-label="Supprimer la section"
                    title="Supprimer"
                    onClick={() => removeBlock(block.key)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="admin-dash__form">
                <label className="admin-dash__field">
                  <span>Sous-titre</span>
                  <input
                    value={block.title}
                    disabled={saving}
                    onChange={(e) =>
                      updateBlock(block.key, { title: e.target.value })
                    }
                    placeholder="Optionnel"
                  />
                </label>
                <AdminDropzone
                  variant="image"
                  accept="image/jpeg,image/png,image/webp"
                  label="Sous-cover"
                  hint="Image de section · optionnelle"
                  fileName={
                    block.coverFile?.name ??
                    (block.coverPreview ? "cover" : null)
                  }
                  previewUrl={block.coverPreview}
                  onFile={(file) => {
                    updateBlock(block.key, {
                      coverFile: file,
                      coverPreview: file ? URL.createObjectURL(file) : null,
                    });
                  }}
                />
                <label className="admin-dash__field">
                  <span>Légende</span>
                  <input
                    value={block.coverCaption}
                    disabled={saving}
                    maxLength={500}
                    placeholder="Optionnel — affichée sous la photo"
                    onChange={(e) =>
                      updateBlock(block.key, {
                        coverCaption: e.target.value,
                      })
                    }
                  />
                </label>
                <div className="admin-dash__field">
                  <span>Sous-description</span>
                  <AdminRichEditor
                    key={`${articleId ?? "new"}-${block.key}`}
                    value={block.content}
                    disabled={saving}
                    placeholder="Rédigez la sous-description…"
                    onChange={(html) =>
                      updateBlock(block.key, { content: html })
                    }
                  />
                </div>
              </div>
            </section>
            <button
              type="button"
              className="admin-article__add-between"
              disabled={saving}
              onClick={() => addBlock(index)}
            >
              <Plus size={15} strokeWidth={2} aria-hidden />
              Ajouter une section
            </button>
            </div>
          ))}

          <div className="admin-article-page__footer-actions">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving
                ? "Enregistrement…"
                : isEdit
                  ? "Enregistrer"
                  : "Créer"}
            </button>
            <Link href="/admin/actualites" className="admin-dash__btn">
              Annuler
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Play,
  Plus,
  Search,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import {
  adminArticlesApi,
  adminStatusesApi,
  type AdminArticle,
  type AdminStatus,
  type AdminStatusImageFit,
  type AdminStatusSlide,
} from "@/lib/api";

type LinkedArticle = {
  id: string;
  title: string;
  coverUrl: string | null;
};

type MediaPreview = { url: string; type: "IMAGE" | "VIDEO" };

/** Diapo en cours d’édition (existante ou nouvelle). */
export type StatusSlideDraft = {
  /** Clé locale stable (React) */
  key: string;
  /** Id serveur — null pour une nouvelle diapo */
  id: string | null;
  caption: string;
  article: LinkedArticle | null;
  durationSec: number;
  imageFit: AdminStatusImageFit;
  mediaFile: File | null;
  /** Miniature générée côté navigateur pour une vidéo */
  posterFile: File | null;
  preview: MediaPreview | null;
  /** Retire le média existant */
  clearMedia: boolean;
};

export type AdminStatusFormValues = {
  /** null = nouvelle bulle ; sinon id du statut auquel ajouter les diapos */
  targetId: string | null;
  ttlHours: number | null;
  publish: boolean;
  slides: StatusSlideDraft[];
  removedSlideIds: string[];
};

const TTL_OPTIONS = [
  { value: 6, label: "6 heures" },
  { value: 12, label: "12 heures" },
  { value: 24, label: "24 heures" },
  { value: 48, label: "48 heures" },
  { value: 72, label: "3 jours" },
  { value: 168, label: "7 jours" },
];

const MAX_SLIDES = 20;
const VIDEO_MAX_BYTES = 100_000_000;
const IMAGE_MAX_BYTES = 10_000_000;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

let keySeq = 0;
const newKey = () => `slide-${Date.now()}-${keySeq++}`;

function emptySlide(): StatusSlideDraft {
  return {
    key: newKey(),
    id: null,
    caption: "",
    article: null,
    durationSec: 6,
    imageFit: "COVER",
    mediaFile: null,
    posterFile: null,
    preview: null,
    clearMedia: false,
  };
}

function slideFromServer(slide: AdminStatusSlide): StatusSlideDraft {
  return {
    key: slide.id,
    id: slide.id,
    caption: slide.caption ?? "",
    article: slide.article
      ? {
          id: slide.article.id,
          title: slide.article.title,
          coverUrl: slide.article.coverUrl,
        }
      : null,
    durationSec: slide.durationSec,
    imageFit: slide.imageFit,
    mediaFile: null,
    posterFile: null,
    preview:
      slide.mediaUrl && slide.mediaType
        ? { url: slide.mediaUrl, type: slide.mediaType }
        : null,
    clearMedia: false,
  };
}

export function slideHasContent(slide: StatusSlideDraft) {
  return (
    Boolean(slide.preview) ||
    Boolean(slide.caption.trim()) ||
    Boolean(slide.article)
  );
}

/** Image affichée pour représenter une diapo (vignette, aperçu). */
function slideThumb(slide: StatusSlideDraft): string | null {
  if (slide.preview?.type === "IMAGE") return slide.preview.url;
  return slide.article?.coverUrl ?? null;
}

/** Libellé court d’un statut existant (sélecteur « Ajouter à »). */
export function statusLabel(status: AdminStatus): string {
  const first = status.slides[0];
  const text =
    status.slides.map((s) => s.caption?.trim()).find(Boolean) ||
    first?.article?.title ||
    (first?.mediaType === "VIDEO"
      ? "Vidéo"
      : first?.mediaType === "IMAGE"
        ? "Image"
        : "Statut sans contenu");
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function classifyFile(file: File): "IMAGE" | "VIDEO" | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/.test(name)) {
    return "VIDEO";
  }
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name)) {
    return "IMAGE";
  }
  return null;
}

/** Capture une image de la vidéo (≈ 0,5 s) pour la bulle mobile. */
async function captureVideoPoster(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return null;
    return new File([blob], "poster.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Vérifie un fichier et prépare son aperçu ; null si refusé. */
async function readMedia(
  file: File,
): Promise<Pick<StatusSlideDraft, "mediaFile" | "posterFile" | "preview"> | null> {
  const type = classifyFile(file);
  if (!type) {
    toast.error(`${file.name} : formats JPG, PNG, WEBP, MP4 ou MOV`);
    return null;
  }
  if (type === "VIDEO" && file.size > VIDEO_MAX_BYTES) {
    toast.error(`${file.name} : vidéo trop lourde (100 Mo max)`);
    return null;
  }
  if (type === "IMAGE" && file.size > IMAGE_MAX_BYTES) {
    toast.error(`${file.name} : image trop lourde (10 Mo max)`);
    return null;
  }
  return {
    mediaFile: file,
    posterFile: type === "VIDEO" ? await captureVideoPoster(file) : null,
    preview: { url: URL.createObjectURL(file), type },
  };
}

function ArticleSearch({
  value,
  disabled,
  onChange,
}: {
  value: LinkedArticle | null;
  disabled?: boolean;
  onChange: (article: LinkedArticle | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      void adminArticlesApi
        .list({ q: term, published: "true", take: 8 })
        .then((res) => {
          if (!cancelled) setResults(res.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  if (value) {
    return (
      <div className="admin-status-form__article">
        <span className="admin-status-form__article-thumb" aria-hidden>
          {value.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.coverUrl} alt="" />
          ) : (
            <FileText size={16} />
          )}
        </span>
        <strong>{value.title}</strong>
        <button
          type="button"
          className="admin-dash__icon-action"
          aria-label="Retirer l’article"
          title="Retirer l’article"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="admin-status-form__search">
      <div className="admin-status-form__search-input">
        <Search size={15} aria-hidden />
        <input
          type="search"
          value={q}
          placeholder="Rechercher un article publié…"
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q.trim().length >= 2 ? (
        <ul className="admin-status-form__results">
          {loading && results.length === 0 ? (
            <li className="admin-dash__muted">Recherche…</li>
          ) : results.length === 0 ? (
            <li className="admin-dash__muted">Aucun article publié trouvé.</li>
          ) : (
            results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ id: a.id, title: a.title, coverUrl: a.coverUrl });
                    setQ("");
                  }}
                >
                  <span className="admin-status-form__article-thumb" aria-hidden>
                    {a.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverUrl} alt="" />
                    ) : (
                      <FileText size={14} />
                    )}
                  </span>
                  <span>{a.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function AdminStatusForm({
  initial,
  saving,
  progress,
  onCancel,
  onSubmit,
}: {
  initial?: AdminStatus | null;
  saving: boolean;
  progress?: string | null;
  onCancel: () => void;
  onSubmit: (values: AdminStatusFormValues) => void | Promise<void>;
}) {
  const isEdit = Boolean(initial);
  const [slides, setSlides] = useState<StatusSlideDraft[]>(() =>
    initial?.slides.length
      ? initial.slides.map(slideFromServer)
      : [emptySlide()],
  );
  const [selectedKey, setSelectedKey] = useState(() => slides[0].key);
  const [removedSlideIds, setRemovedSlideIds] = useState<string[]>([]);
  const [ttlHours, setTtlHours] = useState<number | null>(isEdit ? null : 24);
  const [publish, setPublish] = useState(initial ? initial.isPublished : true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targets, setTargets] = useState<AdminStatus[]>([]);

  // Statuts existants auxquels ajouter des diapos (nouveau statut uniquement)
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    void adminStatusesApi
      .list({ take: 50 })
      .then((res) => {
        if (!cancelled) {
          setTargets(res.items.filter((s) => s.state !== "expired"));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  // Libère les aperçus locaux à la fermeture
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  useEffect(() => {
    return () => {
      for (const s of slidesRef.current) {
        if (s.preview?.url.startsWith("blob:")) URL.revokeObjectURL(s.preview.url);
      }
    };
  }, []);

  const index = Math.max(
    0,
    slides.findIndex((s) => s.key === selectedKey),
  );
  const slide = slides[index];
  const target = useMemo(
    () => targets.find((t) => t.id === targetId) ?? null,
    [targets, targetId],
  );
  const existingCount = target?.slides.length ?? 0;

  function patchSlide(key: string, patch: Partial<StatusSlideDraft>) {
    setSlides((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function revoke(preview: MediaPreview | null) {
    if (preview?.url.startsWith("blob:")) URL.revokeObjectURL(preview.url);
  }

  async function replaceMedia(file: File | null) {
    if (!file) return;
    const media = await readMedia(file);
    if (!media) return;
    revoke(slide.preview);
    patchSlide(slide.key, { ...media, clearMedia: false });
  }

  function removeMedia() {
    revoke(slide.preview);
    patchSlide(slide.key, {
      mediaFile: null,
      posterFile: null,
      preview: null,
      clearMedia: Boolean(slide.id),
    });
  }

  /** Plusieurs fichiers → une diapo par fichier, ajoutées à la suite. */
  async function addFiles(files: File[]) {
    const room = MAX_SLIDES - existingCount - slides.length;
    const reuseCurrent = !slideHasContent(slide) && !slide.id;
    const capacity = room + (reuseCurrent ? 1 : 0);
    if (capacity <= 0) {
      toast.error(`${MAX_SLIDES} diapos maximum par statut`);
      return;
    }
    if (files.length > capacity) {
      toast.warn(`Seuls ${capacity} fichier(s) ajoutés (${MAX_SLIDES} diapos max)`);
    }
    const drafts: StatusSlideDraft[] = [];
    for (const file of files.slice(0, capacity)) {
      const media = await readMedia(file);
      if (media) drafts.push({ ...emptySlide(), ...media });
    }
    if (!drafts.length) return;
    setSlides((prev) => {
      if (reuseCurrent) {
        const at = prev.findIndex((s) => s.key === slide.key);
        const next = [...prev];
        next.splice(at, 1, ...drafts);
        return next;
      }
      return [...prev, ...drafts];
    });
    setSelectedKey(drafts[0].key);
  }

  function addEmptySlide() {
    if (existingCount + slides.length >= MAX_SLIDES) {
      toast.error(`${MAX_SLIDES} diapos maximum par statut`);
      return;
    }
    const draft = emptySlide();
    setSlides((prev) => [...prev, draft]);
    setSelectedKey(draft.key);
  }

  function moveSlide(delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function deleteSlide() {
    if (slides.length <= 1) {
      // Dernière diapo : on la vide plutôt que de la retirer
      revoke(slide.preview);
      const fresh = emptySlide();
      if (slide.id) setRemovedSlideIds((ids) => [...ids, slide.id as string]);
      setSlides([fresh]);
      setSelectedKey(fresh.key);
      return;
    }
    revoke(slide.preview);
    if (slide.id) setRemovedSlideIds((ids) => [...ids, slide.id as string]);
    const next = slides.filter((s) => s.key !== slide.key);
    setSlides(next);
    setSelectedKey(next[Math.min(index, next.length - 1)].key);
  }

  function submit() {
    // Les nouvelles diapos vides sont ignorées
    const kept = slides.filter((s) => s.id || slideHasContent(s));
    const withContent = kept.filter(slideHasContent);
    if (targetId) {
      if (!withContent.length) {
        toast.error("Ajoutez au moins une diapo avec du contenu");
        return;
      }
    } else if (publish && !withContent.length) {
      toast.error("Ajoutez un média, un texte ou un article lié");
      return;
    }
    void onSubmit({
      targetId,
      ttlHours,
      publish,
      slides: kept,
      removedSlideIds,
    });
  }

  const showsImageDuration = slide.preview?.type !== "VIDEO";
  const bgUrl =
    slide.preview?.type === "IMAGE"
      ? slide.preview.url
      : !slide.preview
        ? slide.article?.coverUrl
        : null;
  const totalBars = existingCount + slides.length;

  return (
    <div className="admin-status-form">
      <div className="admin-status-form__grid">
        <div className="admin-status-form__fields">
          {!isEdit ? (
            <label className="admin-dash__field">
              <span>Bulle</span>
              <select
                value={targetId ?? ""}
                disabled={saving}
                onChange={(e) => setTargetId(e.target.value || null)}
              >
                <option value="">Nouvelle bulle</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    Ajouter à : {statusLabel(t)} ({t.slides.length} diapo
                    {t.slides.length > 1 ? "s" : ""}
                    {t.state === "draft" ? ", brouillon" : ""})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="admin-dash__field">
            <span>
              Diapos ({slides.length}
              {existingCount ? ` + ${existingCount} existantes` : ""})
            </span>
            <div className="admin-status-slides" role="list">
              {slides.map((s, i) => {
                const thumb = slideThumb(s);
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="listitem"
                    disabled={saving}
                    className={
                      s.key === slide.key
                        ? "admin-status-slides__item is-active"
                        : "admin-status-slides__item"
                    }
                    title={`Diapo ${i + 1}`}
                    onClick={() => setSelectedKey(s.key)}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" />
                    ) : s.preview?.type === "VIDEO" ? (
                      <Play size={16} aria-hidden />
                    ) : s.article ? (
                      <FileText size={16} aria-hidden />
                    ) : (
                      <Type size={16} aria-hidden />
                    )}
                    <span className="admin-status-slides__num">
                      {existingCount + i + 1}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="admin-status-slides__add"
                disabled={saving}
                title="Ajouter une diapo texte / article"
                aria-label="Ajouter une diapo"
                onClick={addEmptySlide}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <AdminDropzone
            accept={MEDIA_ACCEPT}
            variant="file"
            multiple
            label="Ajouter des images ou vidéos"
            hint="Plusieurs fichiers d’un coup : une diapo par fichier · JPG, PNG, WEBP (10 Mo) · MP4, MOV (100 Mo) · 9:16 conseillé"
            onFiles={(files) => void addFiles(files)}
          />

          <div className="admin-status-slide">
            <div className="admin-status-slide__head">
              <strong>
                Diapo {existingCount + index + 1} / {totalBars}
              </strong>
              <div className="admin-dash__row-actions">
                <button
                  type="button"
                  className="admin-dash__icon-action"
                  disabled={saving || index === 0}
                  aria-label="Déplacer avant"
                  title="Déplacer avant"
                  onClick={() => moveSlide(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="admin-dash__icon-action"
                  disabled={saving || index >= slides.length - 1}
                  aria-label="Déplacer après"
                  title="Déplacer après"
                  onClick={() => moveSlide(1)}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="admin-dash__icon-action admin-dash__icon-action--delete"
                  disabled={saving}
                  aria-label="Supprimer la diapo"
                  title="Supprimer la diapo"
                  onClick={deleteSlide}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <AdminDropzone
              key={slide.key}
              accept={MEDIA_ACCEPT}
              variant="file"
              label={slide.preview ? "Changer le média" : "Média de cette diapo (optionnel)"}
              hint="Image ou vidéo plein écran"
              fileName={slide.mediaFile?.name ?? null}
              onFile={(f) => void replaceMedia(f)}
            />
            {slide.preview ? (
              <button
                type="button"
                className="admin-dash__btn admin-status-form__remove"
                disabled={saving}
                onClick={removeMedia}
              >
                <X size={14} aria-hidden /> Retirer le média
              </button>
            ) : null}

            <label className="admin-dash__field">
              <span>Texte (optionnel)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={slide.caption}
                placeholder="Message affiché sur la diapo…"
                disabled={saving}
                onChange={(e) =>
                  patchSlide(slide.key, { caption: e.target.value })
                }
              />
            </label>

            <div className="admin-dash__field">
              <span>Article lié (bouton « Lire l’article »)</span>
              <ArticleSearch
                key={slide.key}
                value={slide.article}
                disabled={saving}
                onChange={(article) => patchSlide(slide.key, { article })}
              />
            </div>

            {showsImageDuration ? (
              <label className="admin-dash__field">
                <span>Durée d’affichage</span>
                <select
                  value={slide.durationSec}
                  disabled={saving}
                  onChange={(e) =>
                    patchSlide(slide.key, { durationSec: Number(e.target.value) })
                  }
                >
                  {[4, 5, 6, 8, 10, 12, 15].map((s) => (
                    <option key={s} value={s}>
                      {s} secondes
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {slide.preview?.type === "IMAGE" ? (
              <div className="admin-dash__field">
                <span>Style d’image</span>
                <div className="admin-status-form__fit" role="radiogroup">
                  {(
                    [
                      { value: "COVER", label: "Cover", hint: "Couvre tout l’écran" },
                      { value: "FIT", label: "Fit", hint: "Image entière, selon sa taille" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={slide.imageFit === o.value}
                      disabled={saving}
                      className={
                        slide.imageFit === o.value
                          ? "admin-status-form__fit-option is-active"
                          : "admin-status-form__fit-option"
                      }
                      onClick={() => patchSlide(slide.key, { imageFit: o.value })}
                    >
                      <strong>{o.label}</strong>
                      <small>{o.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {targetId ? (
            <p className="admin-dash__muted admin-status-form__note">
              Les diapos seront ajoutées à la suite de ce statut ; sa
              visibilité et sa publication ne changent pas.
            </p>
          ) : (
            <>
              <div className="admin-status-form__row">
                <label className="admin-dash__field">
                  <span>
                    {isEdit ? "Prolonger (dès maintenant)" : "Visible pendant"}
                  </span>
                  <select
                    value={ttlHours ?? ""}
                    disabled={saving}
                    onChange={(e) =>
                      setTtlHours(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    {isEdit ? <option value="">Ne pas modifier</option> : null}
                    {TTL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="admin-status-form__check">
                <input
                  type="checkbox"
                  checked={publish}
                  disabled={saving}
                  onChange={(e) => setPublish(e.target.checked)}
                />
                <span>
                  {isEdit ? "Publié sur l’app mobile" : "Publier immédiatement"}
                </span>
              </label>
            </>
          )}
        </div>

        <div className="admin-status-form__preview" aria-label="Aperçu mobile">
          <div className="admin-status-form__phone">
            <div className="admin-status-form__bars">
              {Array.from({ length: totalBars }, (_, i) => (
                <span
                  key={i}
                  className={i <= existingCount + index ? "is-done" : undefined}
                />
              ))}
            </div>
            {slide.preview?.type === "VIDEO" ? (
              <video
                key={slide.preview.url}
                src={slide.preview.url}
                muted
                autoPlay
                loop
                playsInline
                className="admin-status-form__media"
              />
            ) : bgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bgUrl}
                alt=""
                className={
                  slide.preview?.type === "IMAGE" && slide.imageFit === "FIT"
                    ? "admin-status-form__media is-fit"
                    : "admin-status-form__media"
                }
              />
            ) : null}
            <div className="admin-status-form__overlay">
              {!slide.preview && slide.article ? (
                <strong className="admin-status-form__title">
                  {slide.article.title}
                </strong>
              ) : null}
              {slide.caption.trim() ? <p>{slide.caption.trim()}</p> : null}
              {slide.article ? (
                <span className="admin-status-form__cta">Lire l’article</span>
              ) : null}
              {!slideHasContent(slide) ? (
                <p className="admin-status-form__empty">Aperçu de la diapo</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-sponsor-form__actions">
        {saving && progress ? (
          <span className="admin-dash__muted">{progress}</span>
        ) : null}
        <button
          type="button"
          className="admin-dash__btn"
          disabled={saving}
          onClick={onCancel}
        >
          Annuler
        </button>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          disabled={saving}
          onClick={submit}
        >
          {saving
            ? "Enregistrement…"
            : isEdit
              ? "Enregistrer"
              : targetId
                ? "Ajouter au statut"
                : publish
                  ? "Publier le statut"
                  : "Enregistrer en brouillon"}
        </button>
      </div>
    </div>
  );
}

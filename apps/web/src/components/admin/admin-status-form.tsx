"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import {
  adminArticlesApi,
  type AdminArticle,
  type AdminStatus,
  type AdminStatusImageFit,
} from "@/lib/api";

export type AdminStatusFormValues = {
  caption: string | null;
  articleId: string | null;
  ttlHours: number | null;
  durationSec: number;
  imageFit: AdminStatusImageFit;
  publish: boolean;
  mediaFile: File | null;
  /** Miniature générée côté navigateur pour une vidéo */
  posterFile: File | null;
  clearMedia: boolean;
};

type LinkedArticle = {
  id: string;
  title: string;
  coverUrl: string | null;
};

const TTL_OPTIONS = [
  { value: 6, label: "6 heures" },
  { value: 12, label: "12 heures" },
  { value: 24, label: "24 heures" },
  { value: 48, label: "48 heures" },
  { value: 72, label: "3 jours" },
  { value: 168, label: "7 jours" },
];

const VIDEO_MAX_BYTES = 100_000_000;
const IMAGE_MAX_BYTES = 10_000_000;

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
  progress?: number | null;
  onCancel: () => void;
  onSubmit: (values: AdminStatusFormValues) => void | Promise<void>;
}) {
  const isEdit = Boolean(initial);
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [article, setArticle] = useState<LinkedArticle | null>(
    initial?.article
      ? {
          id: initial.article.id,
          title: initial.article.title,
          coverUrl: initial.article.coverUrl,
        }
      : null,
  );
  const [ttlHours, setTtlHours] = useState<number | null>(isEdit ? null : 24);
  const [durationSec, setDurationSec] = useState(initial?.durationSec ?? 6);
  const [imageFit, setImageFit] = useState<AdminStatusImageFit>(
    initial?.imageFit ?? "COVER",
  );
  const [publish, setPublish] = useState(initial ? initial.isPublished : true);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [clearMedia, setClearMedia] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    type: "IMAGE" | "VIDEO";
  } | null>(
    initial?.mediaUrl && initial.mediaType
      ? { url: initial.mediaUrl, type: initial.mediaType }
      : null,
  );
  const previewRef = useRef(preview);
  previewRef.current = preview;

  useEffect(() => {
    return () => {
      const url = previewRef.current?.url;
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, []);

  function setLocalPreview(next: typeof preview) {
    setPreview((prev) => {
      if (prev?.url.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return next;
    });
  }

  async function pickMedia(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/.test(name);
    const isImage =
      file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name);
    if (!isVideo && !isImage) {
      toast.error("Formats : JPG, PNG, WEBP, MP4 ou MOV");
      return;
    }
    if (isVideo && file.size > VIDEO_MAX_BYTES) {
      toast.error("Vidéo trop lourde (100 Mo max)");
      return;
    }
    if (isImage && file.size > IMAGE_MAX_BYTES) {
      toast.error("Image trop lourde (10 Mo max)");
      return;
    }
    setMediaFile(file);
    setClearMedia(false);
    setLocalPreview({
      url: URL.createObjectURL(file),
      type: isVideo ? "VIDEO" : "IMAGE",
    });
    setPosterFile(isVideo ? await captureVideoPoster(file) : null);
  }

  function removeMedia() {
    setMediaFile(null);
    setPosterFile(null);
    setLocalPreview(null);
    if (initial?.mediaUrl) setClearMedia(true);
  }

  function submit() {
    const text = caption.trim();
    const hasMedia = Boolean(mediaFile) || (Boolean(initial?.mediaUrl) && !clearMedia);
    if (publish && !hasMedia && !text && !article) {
      toast.error("Ajoutez un média, un texte ou un article lié");
      return;
    }
    void onSubmit({
      caption: text || null,
      articleId: article?.id ?? null,
      ttlHours,
      durationSec,
      imageFit,
      publish,
      mediaFile,
      posterFile,
      clearMedia,
    });
  }

  const showsImageDuration =
    preview?.type !== "VIDEO";
  const bgUrl =
    preview?.type === "IMAGE" ? preview.url : !preview ? article?.coverUrl : null;

  return (
    <div className="admin-status-form">
      <div className="admin-status-form__grid">
        <div className="admin-status-form__fields">
          <AdminDropzone
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            variant="file"
            label={preview ? "Changer le média" : "Image ou vidéo (optionnel)"}
            hint="JPG, PNG, WEBP (10 Mo) · MP4, MOV (100 Mo) · format vertical 9:16 conseillé"
            fileName={mediaFile?.name ?? null}
            onFile={(f) => void pickMedia(f)}
          />
          {preview ? (
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
              value={caption}
              placeholder="Message affiché sur le statut…"
              disabled={saving}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>

          <div className="admin-dash__field">
            <span>Article lié (bouton « Lire l’article »)</span>
            <ArticleSearch
              value={article}
              disabled={saving}
              onChange={setArticle}
            />
          </div>

          <div className="admin-status-form__row">
            <label className="admin-dash__field">
              <span>{isEdit ? "Prolonger la visibilité" : "Visible pendant"}</span>
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
                    {isEdit ? `${o.label} à partir de maintenant` : o.label}
                  </option>
                ))}
              </select>
            </label>
            {showsImageDuration ? (
              <label className="admin-dash__field">
                <span>Durée d’affichage</span>
                <select
                  value={durationSec}
                  disabled={saving}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                >
                  {[4, 5, 6, 8, 10, 12, 15].map((s) => (
                    <option key={s} value={s}>
                      {s} secondes
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {preview?.type === "IMAGE" ? (
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
                    aria-checked={imageFit === o.value}
                    disabled={saving}
                    className={
                      imageFit === o.value
                        ? "admin-status-form__fit-option is-active"
                        : "admin-status-form__fit-option"
                    }
                    onClick={() => setImageFit(o.value)}
                  >
                    <strong>{o.label}</strong>
                    <small>{o.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
        </div>

        <div className="admin-status-form__preview" aria-label="Aperçu mobile">
          <div className="admin-status-form__phone">
            <div className="admin-status-form__bars">
              <span />
            </div>
            {preview?.type === "VIDEO" ? (
              <video
                src={preview.url}
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
                  preview?.type === "IMAGE" && imageFit === "FIT"
                    ? "admin-status-form__media is-fit"
                    : "admin-status-form__media"
                }
              />
            ) : null}
            <div className="admin-status-form__overlay">
              {!preview && article ? (
                <strong className="admin-status-form__title">
                  {article.title}
                </strong>
              ) : null}
              {caption.trim() ? <p>{caption.trim()}</p> : null}
              {article ? (
                <span className="admin-status-form__cta">Lire l’article</span>
              ) : null}
              {!preview && !article && !caption.trim() ? (
                <p className="admin-status-form__empty">Aperçu du statut</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-sponsor-form__actions">
        {saving && progress != null ? (
          <span className="admin-dash__muted">Envoi {progress}%</span>
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
              : publish
                ? "Publier le statut"
                : "Enregistrer en brouillon"}
        </button>
      </div>
    </div>
  );
}

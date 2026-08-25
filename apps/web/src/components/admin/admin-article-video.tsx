"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminProgressModal } from "@/components/admin/admin-progress-modal";
import {
  adminArticlesApi,
  type AdminArticle,
} from "@/lib/api";

const STATUS_LABEL: Record<
  NonNullable<AdminArticle["videoStatus"]>,
  string
> = {
  NONE: "Aucune vidéo",
  PENDING: "En file — transcodage HLS",
  PROCESSING: "Transcodage FFmpeg…",
  READY: "Prêt (HLS adaptatif)",
  FAILED: "Échec du transcodage",
};

type Props = {
  articleId: string | undefined;
  category: string;
  article: AdminArticle | null;
  pendingFile: File | null;
  onPick: (file: File | null) => void;
  onUpdated: (row: AdminArticle) => void;
  uploading?: boolean;
  uploadPercent?: number | null;
};

export function AdminArticleVideo({
  articleId,
  category,
  article,
  pendingFile,
  onPick,
  onUpdated,
  uploading = false,
  uploadPercent = null,
}: Props) {
  const [percent, setPercent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const status = article?.videoStatus ?? "NONE";
  const pending = status === "PENDING" || status === "PROCESSING";
  const progress = uploadPercent ?? percent;

  useEffect(() => {
    if (!articleId || !pending) return;
    let cancelled = false;
    const tick = () => {
      void adminArticlesApi
        .get(articleId)
        .then((row) => {
          if (!cancelled) onUpdated(row);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [articleId, pending, onUpdated]);

  async function onFile(file: File | null) {
    onPick(file);
    if (!file || !articleId) return;
    setBusy(true);
    setPercent(0);
    try {
      const row = await adminArticlesApi.uploadVideoDirect(articleId, file, {
        onProgress: setPercent,
      });
      onUpdated(row);
      onPick(null);
      toast.success("Vidéo envoyée — transcodage HLS en cours");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec upload vidéo");
    } finally {
      setBusy(false);
      setPercent(null);
    }
  }

  async function reprocess() {
    if (!articleId) return;
    setBusy(true);
    try {
      const row = await adminArticlesApi.reprocessVideo(articleId);
      onUpdated(row);
      toast.success("Transcodage relancé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec relance");
    } finally {
      setBusy(false);
    }
  }

  const fileLabel =
    progress != null
      ? `Upload ${progress} %`
      : pendingFile?.name ??
        (article?.videoSourceKey ? "source.mp4" : null);

  return (
    <div className="admin-article-video">
      <AdminDropzone
        variant="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
        label="Fichier vidéo"
        hint="MP4, MOV, WEBM · max 500 Mo · envoi direct R2 au moment de l’enregistrement"
        fileName={fileLabel}
        onFile={onFile}
      />
      <div className="admin-article-video__meta">
        <span
          className={
            status === "READY"
              ? "admin-mag__badge admin-mag__badge--on"
              : status === "FAILED"
                ? "admin-mag__badge admin-mag__badge--off"
                : "admin-mag__badge"
          }
        >
          {pendingFile && !articleId
            ? `Prête à envoyer · ${pendingFile.name}`
            : STATUS_LABEL[status]}
        </span>
        {article?.videoDurationSec ? (
          <span className="admin-dash__muted">
            {Math.floor(article.videoDurationSec / 60)} min{" "}
            {article.videoDurationSec % 60} s
          </span>
        ) : null}
        {articleId && article?.videoSourceKey && status !== "PROCESSING" ? (
          <button
            type="button"
            className="admin-dash__btn"
            disabled={busy || uploading}
            onClick={() => void reprocess()}
          >
            <RefreshCw size={14} aria-hidden />
            Retranscoder
          </button>
        ) : null}
      </div>
      {article?.videoError ? (
        <p className="admin-dash__muted">{article.videoError}</p>
      ) : null}
      {progress != null ? (
        <p className="admin-dash__muted">Envoi R2 : {progress} %</p>
      ) : null}
      <p className="admin-dash__muted" style={{ margin: 0 }}>
        {category === "stu-stories" ? "STU STORIES" : "STU TALK"} — HLS
        adaptatif (1080 / 720 / 480 / 360) via le CDN.
      </p>
      <AdminProgressModal
        open={busy && percent != null}
        title="Envoi de la vidéo"
        label={
          percent != null && percent < 100
            ? "Envoi direct vers le stockage…"
            : "Confirmation côté serveur…"
        }
        percent={percent ?? 0}
      />
    </div>
  );
}

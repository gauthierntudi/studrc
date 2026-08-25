"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Check, X, ZoomIn } from "lucide-react";
import { toast } from "react-toastify";
import "./avatar-cropper.css";

type ImageCropperProps = {
  imageSrc: string;
  open: boolean;
  busy?: boolean;
  aspect?: number;
  cropShape?: "rect" | "round";
  title?: string;
  description?: string;
  confirmLabel?: string;
  busyLabel?: string;
  filePrefix?: string;
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  wide?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

type Props = {
  imageSrc: string;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth: number,
  maxHeight: number,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const scale = Math.min(
    1,
    maxWidth / pixelCrop.width,
    maxHeight / pixelCrop.height,
  );
  const width = Math.max(1, Math.round(pixelCrop.width * scale));
  const height = Math.max(1, Math.round(pixelCrop.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Impossible de recadrer l’image"));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export function ImageCropper({
  imageSrc,
  open,
  busy = false,
  aspect = 1,
  cropShape = "rect",
  title = "Recadrer l’image",
  description = "Ajustez le cadrage avant de valider.",
  confirmLabel = "Valider",
  busyLabel = "Recadrage…",
  filePrefix = "image",
  maxWidth = 1920,
  maxHeight = 1080,
  maxBytes = 5_000_000,
  wide = false,
  onCancel,
  onConfirm,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || busy || saving) return;
    setSaving(true);
    try {
      let quality = 0.92;
      let blob = await getCroppedBlob(
        imageSrc,
        croppedAreaPixels,
        maxWidth,
        maxHeight,
        "image/jpeg",
        quality,
      );
      while (blob.size > maxBytes && quality > 0.45) {
        quality -= 0.1;
        blob = await getCroppedBlob(
          imageSrc,
          croppedAreaPixels,
          maxWidth,
          maxHeight,
          "image/jpeg",
          quality,
        );
      }
      if (blob.size > maxBytes) {
        const maxMo = Math.round((maxBytes / 1_000_000) * 10) / 10;
        toast.error(`L’image recadrée dépasse encore ${maxMo} Mo`);
        return;
      }
      const file = new File([blob], `${filePrefix}-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await onConfirm(file);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de recadrer l’image",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const locked = busy || saving;

  return (
    <div
      className="opt-crop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opt-crop-title"
    >
      <button
        type="button"
        className="opt-crop__backdrop"
        aria-label="Fermer"
        disabled={locked}
        onClick={onCancel}
      />
      <div className={`opt-crop__panel${wide ? " opt-crop__panel--wide" : ""}`}>
        <header className="opt-crop__header">
          <h2 id="opt-crop-title">{title}</h2>
          <p>{description}</p>
        </header>

        <div
          className={`opt-crop__stage${wide ? " opt-crop__stage--wide" : ""}`}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="opt-crop__zoom">
          <ZoomIn size={16} strokeWidth={2} aria-hidden />
          <label className="opt-crop__zoom-label" htmlFor="opt-crop-zoom">
            Zoom
          </label>
          <input
            id="opt-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={locked}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>

        <footer className="opt-crop__actions">
          <button
            type="button"
            className="opt-crop__btn opt-crop__btn--ghost"
            disabled={locked}
            onClick={onCancel}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Annuler
          </button>
          <button
            type="button"
            className="opt-crop__btn opt-crop__btn--primary"
            disabled={locked || !croppedAreaPixels}
            onClick={() => {
              void handleConfirm();
            }}
          >
            <Check size={16} strokeWidth={2} aria-hidden />
            {locked ? busyLabel : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function AvatarCropper({
  imageSrc,
  open,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ImageCropper
      imageSrc={imageSrc}
      open={open}
      busy={busy}
      aspect={1}
      cropShape="round"
      title="Recadrer la photo"
      description="Ajustez le cadrage — format carré pour votre profil."
      confirmLabel="Valider"
      busyLabel="Envoi…"
      filePrefix="avatar"
      maxWidth={800}
      maxHeight={800}
      maxBytes={1_000_000}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { ImageCropper } from "@/components/site/avatar-cropper";
import type { AdminSponsor } from "@/lib/api";

export type AdminSponsorFormValues = {
  name: string;
  url: string | null;
  logoFile: File | null;
};

export function AdminSponsorForm({
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  initial?: AdminSponsor | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: AdminSponsorFormValues) => void | Promise<void>;
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initial?.logoUrl ?? null,
  );
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const logoCropSrcRef = useRef<string | null>(null);
  logoPreviewRef.current = logoPreview;
  logoCropSrcRef.current = logoCropSrc;

  useEffect(() => {
    return () => {
      const preview = logoPreviewRef.current;
      const crop = logoCropSrcRef.current;
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      if (crop?.startsWith("blob:")) URL.revokeObjectURL(crop);
    };
  }, []);

  function closeLogoCropper() {
    setLogoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return null;
    });
  }

  function pickLogo(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const okType =
      ["png", "jpg", "jpeg", "webp"].includes(ext) ||
      file.type.startsWith("image/");
    if (!okType) {
      toast.error("Formats acceptés : JPG, PNG, WEBP");
      return;
    }
    if (file.size > 12_000_000) {
      toast.error("Image trop lourde (12 Mo max)");
      return;
    }
    setLogoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return URL.createObjectURL(file);
    });
  }

  function onLogoCropConfirm(file: File) {
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    closeLogoCropper();
  }

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Indiquez le nom du sponsor");
      return;
    }
    if (!isEdit && !logoFile) {
      toast.error("Ajoutez le logo du sponsor");
      return;
    }
    const link = url.trim();
    const normalizedUrl = link
      ? /^https?:\/\//i.test(link)
        ? link
        : `https://${link}`
      : null;
    void onSubmit({ name: trimmed, url: normalizedUrl, logoFile });
  }

  return (
    <>
      <div className="admin-sponsor-form">
        <label className="admin-dash__field">
          <span>Nom</span>
          <input
            type="text"
            value={name}
            maxLength={160}
            placeholder="Nom du partenaire"
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Lien (optionnel)</span>
          <input
            type="url"
            value={url}
            maxLength={500}
            placeholder="https://"
            disabled={saving}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <AdminDropzone
          accept="image/jpeg,image/png,image/webp"
          variant="image"
          thumbRatio="square"
          label={logoFile || logoPreview ? "Changer le logo" : "Logo"}
          hint="JPG, PNG ou WEBP · recadrage carré"
          fileName={logoFile?.name ?? null}
          previewUrl={logoPreview}
          onFile={pickLogo}
        />
        <div className="admin-sponsor-form__actions">
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
                : "Ajouter"}
          </button>
        </div>
      </div>
      <ImageCropper
        open={Boolean(logoCropSrc)}
        imageSrc={logoCropSrc ?? ""}
        aspect={1}
        cropShape="rect"
        title="Recadrer le logo"
        description="Ajustez le cadrage — le logo est toujours au format carré."
        confirmLabel="Valider"
        busyLabel="Recadrage…"
        filePrefix="sponsor-logo"
        output="auto"
        maxWidth={1024}
        maxHeight={1024}
        maxBytes={5_000_000}
        onCancel={closeLogoCropper}
        onConfirm={onLogoCropConfirm}
      />
    </>
  );
}

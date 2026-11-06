"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { ImageCropper } from "@/components/site/avatar-cropper";
import type { AdminAuthor } from "@/lib/api";

export type AdminAuthorFormValues = {
  name: string;
  title: string | null;
  photoFile: File | null;
};

export function AdminAuthorForm({
  initial,
  saving,
  onCancel,
  onSubmit,
}: {
  initial?: AdminAuthor | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: AdminAuthorFormValues) => void | Promise<void>;
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial?.avatarUrl ?? null,
  );
  const [photoCropSrc, setPhotoCropSrc] = useState<string | null>(null);
  const photoPreviewRef = useRef<string | null>(null);
  const photoCropSrcRef = useRef<string | null>(null);
  photoPreviewRef.current = photoPreview;
  photoCropSrcRef.current = photoCropSrc;

  useEffect(() => {
    return () => {
      const preview = photoPreviewRef.current;
      const crop = photoCropSrcRef.current;
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      if (crop?.startsWith("blob:")) URL.revokeObjectURL(crop);
    };
  }, []);

  function closePhotoCropper() {
    setPhotoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return null;
    });
  }

  function pickPhoto(file: File | null) {
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
    setPhotoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return URL.createObjectURL(file);
    });
  }

  function onPhotoCropConfirm(file: File) {
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    closePhotoCropper();
  }

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Indiquez le nom de l’auteur");
      return;
    }
    if (!isEdit && !photoFile) {
      toast.error("Ajoutez la photo de l’auteur");
      return;
    }
    void onSubmit({
      name: trimmed,
      title: title.trim() || null,
      photoFile,
    });
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
            placeholder="Prénom et nom"
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="admin-dash__field">
          <span>Fonction (optionnel)</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder="Journaliste, rédacteur…"
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <AdminDropzone
          accept="image/jpeg,image/png,image/webp"
          variant="image"
          thumbRatio="square"
          label={photoFile || photoPreview ? "Changer la photo" : "Photo"}
          hint="JPG, PNG ou WEBP · recadrage rond"
          fileName={photoFile?.name ?? null}
          previewUrl={photoPreview}
          onFile={pickPhoto}
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
        open={Boolean(photoCropSrc)}
        imageSrc={photoCropSrc ?? ""}
        aspect={1}
        cropShape="round"
        title="Recadrer la photo"
        description="Ajustez le cadrage — la photo auteur est ronde."
        confirmLabel="Valider"
        busyLabel="Recadrage…"
        filePrefix="author-avatar"
        output="auto"
        maxWidth={1024}
        maxHeight={1024}
        maxBytes={5_000_000}
        onCancel={closePhotoCropper}
        onConfirm={onPhotoCropConfirm}
      />
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { ImageCropper } from "@/components/site/avatar-cropper";
import {
  adminAuthorsApi,
  type AdminArticleAuthor,
  type AdminAuthor,
} from "@/lib/api";

function normalizeQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toListItem(a: AdminArticleAuthor): AdminAuthor {
  return {
    id: a.id,
    name: a.name,
    title: a.title,
    avatarKey: null,
    avatarUrl: a.avatarUrl,
    adminUserId: a.adminUserId,
    createdAt: "",
    updatedAt: "",
  };
}

export function AdminAuthorPicker({
  value,
  linked,
  currentAdminId,
  disabled,
  onChange,
}: {
  value: string;
  linked?: AdminArticleAuthor | null;
  currentAdminId?: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authors, setAuthors] = useState<AdminAuthor[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCropSrc, setPhotoCropSrc] = useState<string | null>(null);
  const photoPreviewRef = useRef<string | null>(null);
  const photoCropSrcRef = useRef<string | null>(null);
  photoPreviewRef.current = photoPreview;
  photoCropSrcRef.current = photoCropSrc;

  useEffect(() => {
    let cancelled = false;
    void adminAuthorsApi
      .list({ take: 200 })
      .then((res) => {
        if (!cancelled) setAuthors(res.items);
      })
      .catch(() => {
        if (!cancelled) setAuthors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!linked) return;
    setAuthors((prev) => {
      if (prev.some((a) => a.id === linked.id)) return prev;
      return [toListItem(linked), ...prev];
    });
  }, [linked]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value) return;
    if (!currentAdminId) return;
    const me = authors.find(
      (a) => a.adminUserId === currentAdminId || a.id === currentAdminId,
    );
    if (me) onChangeRef.current(me.id);
  }, [authors, value, currentAdminId]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (photoCropSrc) return;
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (photoCropSrc) {
        closePhotoCropper();
        return;
      }
      closePanel();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      if (!photoCropSrc) searchRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, photoCropSrc]);

  useEffect(() => {
    return () => {
      const preview = photoPreviewRef.current;
      const crop = photoCropSrcRef.current;
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      if (crop?.startsWith("blob:")) URL.revokeObjectURL(crop);
    };
  }, []);

  const selected = authors.find((a) => a.id === value) ?? null;
  const query = normalizeQuery(search);
  const filtered = query
    ? authors.filter(
        (a) =>
          normalizeQuery(a.name).includes(query) ||
          normalizeQuery(a.title ?? "").includes(query),
      )
    : authors;

  function closePanel() {
    setOpen(false);
    setSearch("");
    setCreating(false);
    resetCreate();
  }

  function closePhotoCropper() {
    setPhotoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return null;
    });
  }

  function resetCreate() {
    setName("");
    setTitle("");
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    closePhotoCropper();
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

  async function createAuthor() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Indiquez le nom de l’auteur");
      return;
    }

    setSaving(true);
    try {
      const created = await adminAuthorsApi.create({
        name: trimmed,
        title: title.trim() || null,
      });
      const saved = photoFile
        ? await adminAuthorsApi.uploadAvatar(created.id, photoFile)
        : created;
      setAuthors((prev) => {
        const next = prev.filter((a) => a.id !== saved.id);
        return [saved, ...next].sort((a, b) =>
          a.name.localeCompare(b.name, "fr"),
        );
      });
      onChange(saved.id);
      closePanel();
      toast.success("Auteur enregistré — réutilisable sur les prochains articles");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer l’auteur",
      );
    } finally {
      setSaving(false);
    }
  }

  function isYou(author: AdminAuthor) {
    if (!currentAdminId) return false;
    return (
      author.adminUserId === currentAdminId || author.id === currentAdminId
    );
  }

  return (
    <div className="admin-mag-picker admin-sponsor-picker admin-author-picker" ref={rootRef}>
      <button
        type="button"
        className="admin-mag-picker__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen((o) => {
            if (o) {
              setSearch("");
              setCreating(false);
              resetCreate();
            }
            return !o;
          })
        }
      >
        {selected ? (
          <>
            <span className="admin-author-picker__avatar">
              {selected.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.avatarUrl} alt="" />
              ) : null}
            </span>
            <span className="admin-mag-picker__label">
              <strong>
                {selected.name}
                {isYou(selected) ? " (vous)" : ""}
              </strong>
              {selected.title ? <em>{selected.title}</em> : null}
            </span>
          </>
        ) : (
          <span className="admin-mag-picker__placeholder">Vous-même</span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={2.25}
          className="admin-mag-picker__chevron"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="admin-mag-picker__panel admin-sponsor-picker__panel">
          {creating ? (
            <div className="admin-sponsor-picker__create">
              <p className="admin-sponsor-picker__create-title">
                Nouvel auteur
              </p>
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
                label="Photo"
                hint="JPG, PNG ou WEBP · recadrage rond"
                fileName={photoFile?.name ?? null}
                previewUrl={photoPreview}
                onFile={pickPhoto}
              />
              <div className="admin-sponsor-picker__actions">
                <button
                  type="button"
                  className="admin-dash__btn"
                  disabled={saving}
                  onClick={() => {
                    setCreating(false);
                    resetCreate();
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="admin-dash__btn admin-dash__btn--primary"
                  disabled={saving}
                  onClick={() => void createAuthor()}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="admin-mag-picker__search">
                <Search size={15} strokeWidth={2.25} aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  placeholder="Rechercher un auteur…"
                  aria-label="Rechercher un auteur"
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <button
                type="button"
                className="admin-sponsor-picker__new"
                onClick={() => setCreating(true)}
              >
                <Plus size={15} strokeWidth={2.4} aria-hidden />
                Nouvel auteur
              </button>
              <ul
                className="admin-mag-picker__list"
                role="listbox"
                aria-label="Choisir un auteur"
              >
                {filtered.length === 0 ? (
                  <li className="admin-mag-picker__empty">Aucun résultat</li>
                ) : (
                  filtered.map((a) => {
                    const selectedRow = value === a.id;
                    return (
                      <li
                        key={a.id}
                        role="option"
                        aria-selected={selectedRow}
                      >
                        <button
                          type="button"
                          className={`admin-mag-picker__option${
                            selectedRow ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            onChange(a.id);
                            closePanel();
                          }}
                        >
                          <span className="admin-author-picker__avatar">
                            {a.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.avatarUrl} alt="" />
                            ) : null}
                          </span>
                          <span className="admin-mag-picker__label">
                            <strong>
                              {a.name}
                              {isYou(a) ? " (vous)" : ""}
                            </strong>
                            {a.title ? <em>{a.title}</em> : null}
                          </span>
                          {selectedRow ? (
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
            </>
          )}
        </div>
      ) : null}
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
    </div>
  );
}

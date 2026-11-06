"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "react-toastify";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { ImageCropper } from "@/components/site/avatar-cropper";
import {
  adminSponsorsApi,
  type AdminArticleSponsor,
  type AdminSponsor,
} from "@/lib/api";

function normalizeQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toListItem(s: AdminArticleSponsor): AdminSponsor {
  return {
    id: s.id,
    name: s.name,
    logoKey: null,
    logoUrl: s.logoUrl,
    url: s.url,
    createdAt: "",
    updatedAt: "",
  };
}

export function AdminSponsorPicker({
  value,
  linked,
  disabled,
  onChange,
}: {
  value: string;
  linked?: AdminArticleSponsor | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sponsors, setSponsors] = useState<AdminSponsor[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const logoCropSrcRef = useRef<string | null>(null);
  logoPreviewRef.current = logoPreview;
  logoCropSrcRef.current = logoCropSrc;

  useEffect(() => {
    let cancelled = false;
    void adminSponsorsApi
      .list({ take: 200 })
      .then((res) => {
        if (!cancelled) setSponsors(res.items);
      })
      .catch(() => {
        if (!cancelled) setSponsors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!linked) return;
    setSponsors((prev) => {
      if (prev.some((s) => s.id === linked.id)) return prev;
      return [toListItem(linked), ...prev];
    });
  }, [linked]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (logoCropSrc) return;
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (logoCropSrc) {
        closeLogoCropper();
        return;
      }
      closePanel();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      if (!logoCropSrc) searchRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, logoCropSrc]);

  useEffect(() => {
    return () => {
      const preview = logoPreviewRef.current;
      const crop = logoCropSrcRef.current;
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      if (crop?.startsWith("blob:")) URL.revokeObjectURL(crop);
    };
  }, []);

  const selected = sponsors.find((s) => s.id === value) ?? null;
  const query = normalizeQuery(search);
  const filtered = query
    ? sponsors.filter((s) => normalizeQuery(s.name).includes(query))
    : sponsors;

  function closePanel() {
    setOpen(false);
    setSearch("");
    setCreating(false);
    resetCreate();
  }

  function closeLogoCropper() {
    setLogoCropSrc((src) => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
      return null;
    });
  }

  function resetCreate() {
    setName("");
    setUrl("");
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    closeLogoCropper();
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

  async function createSponsor() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Indiquez le nom du sponsor");
      return;
    }
    if (!logoFile) {
      toast.error("Ajoutez le logo du sponsor");
      return;
    }
    if (logoFile.size > 5_000_000) {
      toast.error("Le logo dépasse 5 Mo");
      return;
    }

    const link = url.trim();
    const normalizedUrl = link
      ? /^https?:\/\//i.test(link)
        ? link
        : `https://${link}`
      : null;

    setSaving(true);
    try {
      const created = await adminSponsorsApi.create({
        name: trimmed,
        url: normalizedUrl,
      });
      const withLogo = await adminSponsorsApi.uploadLogo(created.id, logoFile);
      setSponsors((prev) => {
        const next = prev.filter((s) => s.id !== withLogo.id);
        return [withLogo, ...next].sort((a, b) =>
          a.name.localeCompare(b.name, "fr"),
        );
      });
      onChange(withLogo.id);
      closePanel();
      toast.success("Sponsor enregistré — réutilisable sur les prochains articles");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible d’enregistrer le sponsor",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-mag-picker admin-sponsor-picker" ref={rootRef}>
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
            <span className="admin-sponsor-picker__logo">
              {selected.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.logoUrl} alt="" />
              ) : null}
            </span>
            <span className="admin-mag-picker__label">
              <strong>{selected.name}</strong>
            </span>
          </>
        ) : (
          <span className="admin-mag-picker__placeholder">Aucun sponsor</span>
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
                Nouveau sponsor
              </p>
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
                label="Logo"
                hint="JPG, PNG ou WEBP · recadrage carré"
                fileName={logoFile?.name ?? null}
                previewUrl={logoPreview}
                onFile={pickLogo}
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
                  onClick={() => void createSponsor()}
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
                  placeholder="Rechercher un sponsor…"
                  aria-label="Rechercher un sponsor"
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
                Nouveau sponsor
              </button>
              <ul
                className="admin-mag-picker__list"
                role="listbox"
                aria-label="Choisir un sponsor"
              >
                <li role="option" aria-selected={!value}>
                  <button
                    type="button"
                    className={`admin-mag-picker__option${!value ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange("");
                      closePanel();
                    }}
                  >
                    <span className="admin-sponsor-picker__logo admin-sponsor-picker__logo--empty" />
                    <span className="admin-mag-picker__label">
                      <strong>Aucun sponsor</strong>
                    </span>
                    {!value ? (
                      <Check
                        size={16}
                        strokeWidth={2.5}
                        className="admin-mag-picker__check"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
                {filtered.length === 0 ? (
                  <li className="admin-mag-picker__empty">Aucun résultat</li>
                ) : (
                  filtered.map((s) => {
                    const selectedRow = value === s.id;
                    return (
                      <li
                        key={s.id}
                        role="option"
                        aria-selected={selectedRow}
                      >
                        <button
                          type="button"
                          className={`admin-mag-picker__option${
                            selectedRow ? " is-selected" : ""
                          }`}
                          onClick={() => {
                            onChange(s.id);
                            closePanel();
                          }}
                        >
                          <span className="admin-sponsor-picker__logo">
                            {s.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.logoUrl} alt="" />
                            ) : null}
                          </span>
                          <span className="admin-mag-picker__label">
                            <strong>{s.name}</strong>
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
    </div>
  );
}

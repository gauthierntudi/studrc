"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Pencil,
  Power,
  PowerOff,
} from "lucide-react";
import { AdminDropzone } from "@/components/admin/admin-dropzone";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Alert } from "@/components/ui/alert";
import {
  adminMagazinesApi,
  type AdminMagazine,
  type MagazineAccessType,
} from "@/lib/api";
const TAKE = 10;
const DEFAULT_BG = "#0d203d";
const DEFAULT_ACCENT = "#02d0d1";

type MagForm = {
  title: string;
  description: string;
  issueNumber: string;
  accessType: MagazineAccessType;
  priceDollars: string;
  currency: string;
  bgColor: string;
  accentColor: string;
  isPublished: boolean;
};

const emptyForm = (): MagForm => ({
  title: "",
  description: "",
  issueNumber: "",
  accessType: "PAID",
  priceDollars: "",
  currency: "USD",
  bgColor: DEFAULT_BG,
  accentColor: DEFAULT_ACCENT,
  isPublished: false,
});

function normalizeHex(value: string, fallback: string): string {
  const v = value.trim().toLowerCase();
  let hex = v;
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) hex = `#${v}`;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) return fallback;
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

function dollarsToCents(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToDollars(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function toPayload(form: MagForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    issueNumber: form.issueNumber.trim() || null,
    accessType: form.accessType,
    priceCents:
      form.accessType === "FREE" ? null : dollarsToCents(form.priceDollars),
    currency: form.currency.trim().toUpperCase() || "USD",
    theme: {
      bgColor: normalizeHex(form.bgColor, DEFAULT_BG),
      accentColor: normalizeHex(form.accentColor, DEFAULT_ACCENT),
    },
    isPublished: form.isPublished,
  };
}

function fromMagazine(m: AdminMagazine): MagForm {
  return {
    title: m.title,
    description: m.description ?? "",
    issueNumber: m.issueNumber ?? "",
    accessType: m.accessType,
    priceDollars: centsToDollars(m.priceCents),
    currency: m.currency || "USD",
    bgColor: m.theme?.bgColor || DEFAULT_BG,
    accentColor: m.theme?.accentColor || DEFAULT_ACCENT,
    isPublished: m.isPublished,
  };
}

export default function AdminMagazinesPage() {
  return (
    <Suspense
      fallback={
        <header className="admin-dash__header">
          <div>
            <h1>Magazines</h1>
            <p>Chargement…</p>
          </div>
        </header>
      }
    >
      <AdminMagazinesPageInner />
    </Suspense>
  );
}

function AdminMagazinesPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modalParam = searchParams.get("modal");
  const modalId = searchParams.get("id");
  const createOpen = modalParam === "new";
  const editOpen = modalParam === "edit" && Boolean(modalId);

  const [items, setItems] = useState<AdminMagazine[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [published, setPublished] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MagForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [currentPdfLabel, setCurrentPdfLabel] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const restoredModalKey = useRef<string | null>(null);

  function setModalUrl(mode: "new" | "edit" | null, id?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!mode) {
      params.delete("modal");
      params.delete("id");
    } else if (mode === "new") {
      params.set("modal", "new");
      params.delete("id");
    } else {
      params.set("modal", "edit");
      if (id) params.set("id", id);
      else params.delete("id");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function closeModal() {
    if (saving) return;
    restoredModalKey.current = null;
    setForm(emptyForm());
    setEditId(null);
    resetMediaFields(null);
    setModalUrl(null);
  }

  function openCreate() {
    restoredModalKey.current = "new";
    setForm(emptyForm());
    setEditId(null);
    resetMediaFields(null);
    setModalUrl("new");
  }

  function openEdit(m: AdminMagazine) {
    restoredModalKey.current = `edit:${m.id}`;
    setEditId(m.id);
    setForm(fromMagazine(m));
    resetMediaFields(m);
    setModalUrl("edit", m.id);
  }

  function resetMediaFields(magazine?: AdminMagazine | null) {
    setCoverFile(null);
    setPdfFile(null);
    setCoverPreview(magazine?.coverUrl ?? null);
    setCurrentPdfLabel(
      magazine?.downloadKey || magazine?.pdfKey
        ? (magazine.downloadKey || magazine.pdfKey)
        : null,
    );
  }

  async function uploadPendingMedia(magazineId: string) {
    if (coverFile) {
      await adminMagazinesApi.uploadCover(magazineId, coverFile);
    }
    if (pdfFile) {
      setPdfProgress(0);
      try {
        await adminMagazinesApi.uploadPdfDirect(magazineId, pdfFile, {
          onProgress: setPdfProgress,
        });
      } finally {
        setPdfProgress(null);
      }
    }
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminMagazinesApi.list({
        q,
        published: published || undefined,
        active: activeFilter || undefined,
        take: TAKE,
        skip,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    }
  }, [q, published, activeFilter, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  // Restaure le modal depuis l’URL (survit au refresh).
  useEffect(() => {
    const key =
      modalParam === "new"
        ? "new"
        : modalParam === "edit" && modalId
          ? `edit:${modalId}`
          : null;

    if (!key) {
      restoredModalKey.current = null;
      setEditId(null);
      setModalLoading(false);
      return;
    }

    if (key === "new") {
      if (restoredModalKey.current === "new") return;
      restoredModalKey.current = "new";
      setEditId(null);
      setForm(emptyForm());
      resetMediaFields(null);
      setModalLoading(false);
      return;
    }

    // Déjà hydraté pour cet id (ex. clic Modifier) — ne pas recharger.
    // Ne pas court-circuiter si editId est encore null (refresh / Strict Mode).
    if (restoredModalKey.current === key && editId === modalId) {
      setModalLoading(false);
      return;
    }

    let cancelled = false;
    restoredModalKey.current = key;
    setModalLoading(true);

    void adminMagazinesApi
      .get(modalId!)
      .then((m) => {
        if (cancelled) return;
        setEditId(m.id);
        setForm(fromMagazine(m));
        resetMediaFields(m);
        setModalLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setModalLoading(false);
        setError(
          err instanceof Error ? err.message : "Magazine introuvable",
        );
        restoredModalKey.current = null;
        setModalUrl(null);
      });

    return () => {
      cancelled = true;
      // Laisse un re-run (Strict Mode) refetch si le 1er fetch n’a pas hydraté.
      if (restoredModalKey.current === key) {
        restoredModalKey.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on URL modal keys only
  }, [modalParam, modalId]);

  async function createMagazine(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const created = await adminMagazinesApi.create(toPayload(form));
      await uploadPendingMedia(created.id);
      setOk(`Magazine créé : ${created.title}`);
      setForm(emptyForm());
      resetMediaFields(null);
      restoredModalKey.current = null;
      setModalUrl(null);
      setSkip(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec création");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      await adminMagazinesApi.update(editId, toPayload(form));
      await uploadPendingMedia(editId);
      setOk("Magazine mis à jour");
      setEditId(null);
      resetMediaFields(null);
      restoredModalKey.current = null;
      setModalUrl(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(m: AdminMagazine) {
    setError(null);
    setOk(null);
    try {
      await adminMagazinesApi.update(m.id, { isPublished: !m.isPublished });
      setOk(
        m.isPublished
          ? `« ${m.title} » dépublié`
          : `« ${m.title} » publié`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec publication");
    }
  }

  async function toggleActive(m: AdminMagazine) {
    setError(null);
    setOk(null);
    try {
      await adminMagazinesApi.update(m.id, { isActive: !m.isActive });
      setOk(
        m.isActive
          ? `« ${m.title} » désactivé`
          : `« ${m.title} » réactivé`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec activation");
    }
  }

  function magazineFormFields(
    value: MagForm,
    onChange: (next: MagForm) => void,
  ) {
    return (
      <div className="admin-dash__form-grid">
        <label className="admin-dash__field">
          <span>Titre</span>
          <input
            required
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </label>
        <label className="admin-dash__field">
          <span>N° / édition</span>
          <input
            value={value.issueNumber}
            onChange={(e) =>
              onChange({ ...value, issueNumber: e.target.value })
            }
            placeholder="ex. 42"
          />
        </label>
        <label className="admin-dash__field admin-dash__field--full">
          <span>Description</span>
          <textarea
            rows={3}
            value={value.description}
            onChange={(e) =>
              onChange({ ...value, description: e.target.value })
            }
          />
        </label>
        <label className="admin-dash__field">
          <span>Accès</span>
          <select
            value={value.accessType}
            onChange={(e) =>
              onChange({
                ...value,
                accessType: e.target.value as MagazineAccessType,
              })
            }
          >
            <option value="PAID">Payant</option>
            <option value="FREE">Gratuit</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Prix ({value.currency || "USD"})</span>
          <input
            type="number"
            min={0}
            step="0.01"
            disabled={value.accessType === "FREE"}
            value={value.priceDollars}
            onChange={(e) =>
              onChange({ ...value, priceDollars: e.target.value })
            }
            placeholder="0"
          />
        </label>
        <label className="admin-dash__field">
          <span>Devise</span>
          <input
            value={value.currency}
            onChange={(e) => onChange({ ...value, currency: e.target.value })}
            maxLength={8}
          />
        </label>
        <label className="admin-dash__field">
          <span>Statut</span>
          <select
            value={value.isPublished ? "1" : "0"}
            onChange={(e) =>
              onChange({ ...value, isPublished: e.target.value === "1" })
            }
          >
            <option value="0">Brouillon</option>
            <option value="1">Publié</option>
          </select>
        </label>

        <div className="admin-dash__field">
          <span>Couleur de fond (kiosque)</span>
          <div className="admin-mag__color-row">
            <input
              type="color"
              aria-label="Couleur de fond"
              value={normalizeHex(value.bgColor, DEFAULT_BG)}
              onChange={(e) =>
                onChange({ ...value, bgColor: e.target.value })
              }
            />
            <input
              type="text"
              value={value.bgColor}
              onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
              onBlur={() =>
                onChange({
                  ...value,
                  bgColor: normalizeHex(value.bgColor, DEFAULT_BG),
                })
              }
              maxLength={7}
              placeholder={DEFAULT_BG}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="admin-dash__field">
          <span>Couleur d&apos;accent (kiosque)</span>
          <div className="admin-mag__color-row">
            <input
              type="color"
              aria-label="Couleur d'accent"
              value={normalizeHex(value.accentColor, DEFAULT_ACCENT)}
              onChange={(e) =>
                onChange({ ...value, accentColor: e.target.value })
              }
            />
            <input
              type="text"
              value={value.accentColor}
              onChange={(e) =>
                onChange({ ...value, accentColor: e.target.value })
              }
              onBlur={() =>
                onChange({
                  ...value,
                  accentColor: normalizeHex(value.accentColor, DEFAULT_ACCENT),
                })
              }
              maxLength={7}
              placeholder={DEFAULT_ACCENT}
              spellCheck={false}
            />
          </div>
        </div>

        <div
          className="admin-dash__field admin-dash__field--full"
          aria-hidden
        >
          <span>Aperçu thème kiosque</span>
          <div
            className="admin-mag__theme-preview"
            style={{
              background: normalizeHex(value.bgColor, DEFAULT_BG),
              color: normalizeHex(value.accentColor, DEFAULT_ACCENT),
            }}
          >
            <strong>Opt1mum</strong>
            <em style={{ color: "#fff" }}>Fond + accent</em>
          </div>
        </div>

        <div className="admin-dash__field admin-dash__field--media">
          <span>Couverture</span>
          <AdminDropzone
            variant="image"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            label="Couverture"
            hint="JPG / PNG / WEBP · max 5 Mo"
            previewUrl={coverPreview}
            fileName={
              coverFile
                ? `${coverFile.name} (${formatBytes(coverFile.size)})`
                : null
            }
            onFile={(file) => {
              setCoverFile(file);
              if (file) setCoverPreview(URL.createObjectURL(file));
            }}
          />
        </div>

        <div className="admin-dash__field admin-dash__field--media">
          <span>Fichier PDF</span>
          <AdminDropzone
            variant="file"
            accept="application/pdf,.pdf"
            label="PDF du magazine"
            hint="Upload direct R2 · max 350 Mo"
            fileName={
              pdfFile
                ? `${pdfFile.name} (${formatBytes(pdfFile.size)})`
                : currentPdfLabel
            }
            onFile={(file) => setPdfFile(file)}
          />
          {pdfProgress != null ? (
            <div
              className="admin-mag__upload-progress"
              role="progressbar"
              aria-valuenow={pdfProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression upload PDF"
            >
              <div
                className="admin-mag__upload-progress-bar"
                style={{ width: `${pdfProgress}%` }}
              />
              <span className="admin-mag__upload-progress-label">
                Upload R2… {pdfProgress}%
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Magazines</h1>
          <p>Gérer les numéros, tarifs et publication.</p>
        </div>
        <button
          type="button"
          className="admin-dash__cta"
          onClick={() => openCreate()}
        >
          Nouveau magazine
        </button>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {ok ? <Alert variant="success">{ok}</Alert> : null}

      <div className="admin-dash__filters">
        <label className="admin-dash__field">
          <span>Recherche</span>
          <input
            value={q}
            onChange={(e) => {
              setSkip(0);
              setQ(e.target.value);
            }}
            placeholder="titre, n°…"
          />
        </label>
        <label className="admin-dash__field">
          <span>Publication</span>
          <select
            value={published}
            onChange={(e) => {
              setSkip(0);
              setPublished(e.target.value);
            }}
          >
            <option value="">Tous</option>
            <option value="1">Publiés</option>
            <option value="0">Brouillons</option>
          </select>
        </label>
        <label className="admin-dash__field">
          <span>Activation</span>
          <select
            value={activeFilter}
            onChange={(e) => {
              setSkip(0);
              setActiveFilter(e.target.value);
            }}
          >
            <option value="">Tous</option>
            <option value="1">Actifs</option>
            <option value="0">Désactivés</option>
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

      <div className="admin-dash__table-wrap">
        <table className="admin-dash__table">
          <thead>
            <tr>
              <th>Couverture</th>
              <th>Titre</th>
              <th>Accès</th>
              <th>Statut</th>
              <th>Vues</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-dash__muted">
                  Aucun magazine.
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="admin-mag__thumb">
                      {m.coverUrl ? (
                        <Image
                          src={m.coverUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span aria-hidden>—</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <strong>{m.title}</strong>
                    {m.issueNumber ? (
                      <span
                        className="admin-dash__muted"
                        style={{ display: "block" }}
                      >
                        N° {m.issueNumber}
                      </span>
                    ) : null}
                    <span
                      className="admin-dash__muted"
                      style={{ display: "block", fontSize: "0.75rem" }}
                    >
                      {m.isPublished
                        ? `Publié ${formatWhen(m.publishedAt)}`
                        : `Créé ${formatWhen(m.createdAt)}`}
                    </span>
                  </td>
                  <td>
                    {m.accessType === "FREE"
                      ? "Gratuit"
                      : formatMoney(m.priceCents, m.currency)}
                  </td>
                  <td>
                    <div style={{ display: "grid", gap: "0.3rem" }}>
                      <span
                        className={
                          m.isPublished
                            ? "admin-mag__badge admin-mag__badge--on"
                            : "admin-mag__badge"
                        }
                      >
                        {m.isPublished ? "Publié" : "Brouillon"}
                      </span>
                      <span
                        className={
                          m.isActive
                            ? "admin-mag__badge admin-mag__badge--on"
                            : "admin-mag__badge admin-mag__badge--off"
                        }
                      >
                        {m.isActive ? "Actif" : "Désactivé"}
                      </span>
                    </div>
                  </td>
                  <td>{m.viewCount}</td>
                  <td>
                    <div className="admin-dash__actions">
                      <button
                        type="button"
                        className="admin-dash__icon-action admin-dash__icon-action--edit"
                        title="Modifier"
                        aria-label={`Modifier ${m.title}`}
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className={
                          m.isPublished
                            ? "admin-dash__icon-action admin-dash__icon-action--unpublish"
                            : "admin-dash__icon-action admin-dash__icon-action--publish"
                        }
                        title={m.isPublished ? "Dépublier" : "Publier"}
                        aria-label={
                          m.isPublished
                            ? `Dépublier ${m.title}`
                            : `Publier ${m.title}`
                        }
                        onClick={() => void togglePublish(m)}
                      >
                        {m.isPublished ? (
                          <EyeOff className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={2} />
                        )}
                      </button>
                      <button
                        type="button"
                        className={
                          m.isActive
                            ? "admin-dash__icon-action admin-dash__icon-action--disable"
                            : "admin-dash__icon-action admin-dash__icon-action--enable"
                        }
                        title={m.isActive ? "Désactiver" : "Réactiver"}
                        aria-label={
                          m.isActive
                            ? `Désactiver ${m.title}`
                            : `Réactiver ${m.title}`
                        }
                        onClick={() => void toggleActive(m)}
                      >
                        {m.isActive ? (
                          <PowerOff className="h-4 w-4" strokeWidth={2} />
                        ) : (
                          <Power className="h-4 w-4" strokeWidth={2} />
                        )}
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
        open={createOpen}
        title="Nouveau magazine"
        wide
        onClose={closeModal}
      >
        <form
          className="admin-dash__form"
          onSubmit={(e) => void createMagazine(e)}
        >
          {magazineFormFields(form, setForm)}
          <button
            type="submit"
            className="admin-dash__btn admin-dash__btn--primary admin-dash__btn--lg"
            disabled={saving}
          >
            {saving
              ? pdfProgress != null
                ? `Upload PDF… ${pdfProgress}%`
                : "Création…"
              : "Créer"}
          </button>
        </form>
      </AdminModal>

      <AdminModal
        open={editOpen}
        title="Modifier le magazine"
        wide
        onClose={closeModal}
      >
        {modalLoading && !editId ? (
          <p className="admin-dash__muted">Chargement du magazine…</p>
        ) : (
          <form className="admin-dash__form" onSubmit={(e) => void saveEdit(e)}>
            {magazineFormFields(form, setForm)}
            <button
              type="submit"
              className="admin-dash__btn admin-dash__btn--primary admin-dash__btn--lg"
              disabled={saving || !editId || modalLoading}
            >
              {saving
                ? pdfProgress != null
                  ? `Upload PDF… ${pdfProgress}%`
                  : "Enregistrement…"
                : "Enregistrer"}
            </button>
          </form>
        )}
      </AdminModal>
    </>
  );
}

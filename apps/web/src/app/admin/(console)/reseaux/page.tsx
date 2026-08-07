"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  adminSettingsApi,
  type SiteSocialLink,
  type SocialNetwork,
} from "@/lib/api";
import {
  SOCIAL_NETWORK_META,
  SocialNetworkIcon,
} from "@/lib/social-networks";
import { cn } from "@/lib/utils";

type DraftLink = SiteSocialLink;

const NETWORK_OPTIONS = Object.keys(SOCIAL_NETWORK_META) as SocialNetwork[];

function newId(network: SocialNetwork) {
  return `${network}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  try {
    const u = new URL(normalizeUrl(t));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function cloneLinks(links: DraftLink[]): DraftLink[] {
  return links.map((l) => ({ ...l }));
}

function sameLinks(a: DraftLink[], b: DraftLink[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const other = b[i]!;
    return (
      item.id === other.id &&
      item.network === other.network &&
      item.label === other.label &&
      item.url.trim() === other.url.trim()
    );
  });
}

export default function AdminReseauxPage() {
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [saved, setSaved] = useState<DraftLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addNetwork, setAddNetwork] = useState<SocialNetwork>("youtube");

  useEffect(() => {
    let cancelled = false;
    adminSettingsApi
      .getSocial()
      .then((res) => {
        if (cancelled) return;
        const next = cloneLinks(res.links);
        setLinks(next);
        setSaved(cloneLinks(next));
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Impossible de charger les liens",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => !sameLinks(links, saved), [links, saved]);
  const activeCount = links.filter((l) => l.url.trim()).length;
  const invalidIds = new Set(
    links.filter((l) => !isValidUrl(l.url)).map((l) => l.id),
  );

  function updateLink(id: string, patch: Partial<DraftLink>) {
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function addLink() {
    const meta = SOCIAL_NETWORK_META[addNetwork];
    const already = links.some((l) => l.network === addNetwork && addNetwork !== "other");
    if (already) {
      toast.info(`${meta.label} est déjà dans la liste`);
      return;
    }
    setLinks((prev) => [
      ...prev,
      {
        id: newId(addNetwork),
        network: addNetwork,
        label: meta.label,
        url: "",
      },
    ]);
  }

  function resetForm() {
    setLinks(cloneLinks(saved));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalidIds.size > 0) {
      toast.error("Corrigez les URLs invalides avant d’enregistrer");
      return;
    }
    if (links.some((l) => !l.url.trim())) {
      toast.error("Chaque réseau doit avoir une URL, ou retirez-le");
      return;
    }
    setSaving(true);
    try {
      const payload = links.map((l) => ({
        ...l,
        url: normalizeUrl(l.url),
        label:
          l.network === "other"
            ? l.label.trim() || "Lien"
            : SOCIAL_NETWORK_META[l.network].label,
      }));
      const res = await adminSettingsApi.updateSocial({ links: payload });
      const next = cloneLinks(res.links);
      setLinks(next);
      setSaved(cloneLinks(next));
      toast.success("Réseaux sociaux mis à jour");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Enregistrement impossible",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-social">
      <header className="admin-dash__header">
        <div>
          <h1>Réseaux sociaux</h1>
          <p className="admin-dash__muted">
            Liens du footer public — <strong>{activeCount}</strong> actif
            {activeCount > 1 ? "s" : ""}
            {dirty ? " · modifications non enregistrées" : ""}
          </p>
        </div>
        <div className="admin-dash__header-actions">
          {dirty ? (
            <button
              type="button"
              className="admin-dash__btn"
              disabled={loading || saving}
              onClick={resetForm}
            >
              Annuler
            </button>
          ) : null}
          <button
            type="submit"
            form="admin-social-form"
            className="admin-dash__btn admin-dash__btn--primary"
            disabled={
              loading || saving || !dirty || invalidIds.size > 0
            }
          >
            <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </header>

      <div className="admin-social__add">
        <label className="admin-dash__field">
          <span>Ajouter un réseau</span>
          <select
            value={addNetwork}
            disabled={loading || saving}
            onChange={(e) => setAddNetwork(e.target.value as SocialNetwork)}
          >
            {NETWORK_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {SOCIAL_NETWORK_META[n].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-dash__btn admin-dash__btn--primary"
          disabled={loading || saving}
          onClick={addLink}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Ajouter
        </button>
      </div>

      <div className="admin-social__layout">
        <form
          id="admin-social-form"
          className="admin-social__grid"
          onSubmit={onSubmit}
        >
          {loading ? (
            <p className="admin-dash__muted">Chargement…</p>
          ) : links.length === 0 ? (
            <div className="admin-social__empty">
              <p>Aucun réseau configuré.</p>
              <p className="admin-dash__muted">
                Ajoutez Facebook, YouTube, WhatsApp… via le sélecteur ci-dessus.
              </p>
            </div>
          ) : (
            links.map((link) => {
              const meta = SOCIAL_NETWORK_META[link.network];
              const active = Boolean(link.url.trim()) && !invalidIds.has(link.id);
              const invalid = invalidIds.has(link.id);
              const href = active ? normalizeUrl(link.url) : null;

              return (
                <article
                  key={link.id}
                  className={cn(
                    "admin-social__card",
                    active && "is-active",
                    invalid && "is-invalid",
                  )}
                >
                  <div className="admin-social__card-head">
                    <span
                      className="admin-social__icon"
                      style={{
                        background: `color-mix(in srgb, ${meta.tone} 16%, transparent)`,
                        color: meta.tone,
                      }}
                    >
                      <SocialNetworkIcon network={link.network} size={18} />
                    </span>
                    <div className="admin-social__card-meta">
                      <h2>
                        {link.network === "other"
                          ? link.label || meta.label
                          : meta.label}
                      </h2>
                      <span
                        className={cn(
                          "admin-social__badge",
                          active ? "is-on" : "is-off",
                        )}
                      >
                        {active ? (
                          <>
                            <Eye size={12} strokeWidth={2.25} aria-hidden />
                            Visible
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} strokeWidth={2.25} aria-hidden />
                            Incomplet
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {link.network === "other" ? (
                    <label className="admin-dash__field admin-social__field">
                      <span>Libellé</span>
                      <input
                        type="text"
                        value={link.label}
                        disabled={loading || saving}
                        placeholder="Nom du réseau"
                        onChange={(e) =>
                          updateLink(link.id, { label: e.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  <label className="admin-dash__field admin-social__field">
                    <span>URL du profil</span>
                    <input
                      type="text"
                      inputMode="url"
                      placeholder={meta.placeholder}
                      value={link.url}
                      disabled={loading || saving}
                      aria-invalid={invalid}
                      onChange={(e) =>
                        updateLink(link.id, { url: e.target.value })
                      }
                      onBlur={() => {
                        if (!link.url.trim() || !isValidUrl(link.url)) return;
                        updateLink(link.id, {
                          url: normalizeUrl(link.url),
                        });
                      }}
                    />
                  </label>

                  {invalid ? (
                    <p className="admin-social__error">URL invalide</p>
                  ) : (
                    <p className="admin-dash__muted admin-social__hint">
                      Affiché dans le footer tant que l’URL est renseignée
                    </p>
                  )}

                  <div className="admin-social__card-actions">
                    <button
                      type="button"
                      className="admin-dash__btn"
                      disabled={loading || saving}
                      onClick={() => removeLink(link.id)}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Retirer
                    </button>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-dash__btn"
                      >
                        <ExternalLink
                          className="h-4 w-4"
                          strokeWidth={2}
                          aria-hidden
                        />
                        Ouvrir
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </form>

        <aside className="admin-social__preview admin-profile__card">
          <div className="admin-profile__card-head">
            <span className="admin-profile__card-icon" aria-hidden>
              <Eye size={16} strokeWidth={2} />
            </span>
            <div>
              <h2>Aperçu footer</h2>
              <p>Rendu live des icônes telles qu’elles apparaîtront sur le site.</p>
            </div>
          </div>

          <div className="admin-social__preview-stage">
            {activeCount === 0 ? (
              <p className="admin-social__preview-empty">
                Aucun réseau actif — le bloc social sera masqué.
              </p>
            ) : (
              <ul className="admin-social__preview-list">
                {links
                  .filter((l) => l.url.trim() && isValidUrl(l.url))
                  .map((l) => (
                    <li key={l.id}>
                      <a
                        href={normalizeUrl(l.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={l.label}
                        style={{
                          ["--social-tone" as string]:
                            SOCIAL_NETWORK_META[l.network].tone,
                        }}
                      >
                        <SocialNetworkIcon network={l.network} size={16} />
                      </a>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

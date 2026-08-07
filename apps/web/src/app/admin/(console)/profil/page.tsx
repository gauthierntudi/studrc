"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  UserRound,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import { AdminModal } from "@/components/admin/admin-modal";
import { AvatarCropper } from "@/components/site/avatar-cropper";
import { adminAuthApi } from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  EDITOR: "Éditeur",
  REDACTEUR: "Rédacteur",
};

export default function AdminProfilPage() {
  const { admin, setAdmin } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    setName(admin.name);
    setTitle(admin.title ?? "");
    setPhone(admin.phone ?? "");
  }, [admin]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [cropSrc, previewUrl]);

  if (!admin) return null;

  const roleLabel = ROLE_LABELS[admin.role] ?? admin.role;
  const avatar = previewUrl ?? avatarSrc(admin.avatarUrl);
  const locked = profileBusy || passwordBusy || uploading;

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onAvatarPick(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast.error("Formats acceptés : PNG, JPG, WEBP");
      return;
    }
    if (file.size > 12_000_000) {
      toast.error("Image trop lourde (12 Mo max)");
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onCropConfirm(file: File) {
    const localPreview = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(localPreview);
    setUploading(true);
    closeCropper();

    try {
      const updated = await toast.promise(adminAuthApi.uploadAvatar(file), {
        pending: "Envoi de la photo…",
        success: "Photo mise à jour",
        error: {
          render({ data }) {
            return data instanceof Error ? data.message : "Échec upload";
          },
        },
      });
      setAdmin(updated);
      setPreviewUrl(null);
      URL.revokeObjectURL(localPreview);
    } catch {
      setPreviewUrl(null);
      URL.revokeObjectURL(localPreview);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    try {
      const updated = await adminAuthApi.updateProfile({
        name,
        title: title || undefined,
        phone: phone || undefined,
      });
      setAdmin(updated);
      toast.success("Profil mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setProfileBusy(false);
    }
  }

  function resetPasswordForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function closePasswordModal() {
    if (passwordBusy) return;
    setPwdOpen(false);
    resetPasswordForm();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setPasswordBusy(true);
    try {
      await adminAuthApi.changePassword({ currentPassword, newPassword });
      resetPasswordForm();
      setPwdOpen(false);
      toast.success("Mot de passe modifié");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <header className="admin-dash__header">
        <div>
          <h1>Mon profil</h1>
          <p>Identité, photo et sécurité de votre compte staff.</p>
        </div>
      </header>

      <div className="admin-profile">
        <section className="admin-profile__card admin-profile__card--photo">
          <header className="admin-profile__card-head">
            <span className="admin-profile__card-icon" aria-hidden>
              <UserRound className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2>Compte</h2>
            </div>
          </header>

          <div className="admin-profile__photo-body">
            <button
              type="button"
              className="admin-profile__avatar-btn"
              disabled={locked}
              aria-label="Changer la photo de profil"
              onClick={() => fileRef.current?.click()}
            >
              <span className="admin-profile__avatar-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  className="admin-profile__avatar-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = avatarLocalFallback(admin.avatarUrl);
                  }}
                />
              </span>
              <span
                className={cn(
                  "admin-profile__avatar-overlay",
                  uploading && "is-visible",
                )}
              >
                <Camera size={18} strokeWidth={2} aria-hidden />
                {uploading ? "Envoi…" : "Modifier"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
            />

            <div className="admin-profile__photo-meta">
              <p className="admin-profile__photo-name">{admin.name}</p>
              <p className="admin-profile__photo-email">{admin.email}</p>
              <div className="admin-profile__badges">
                <span className="admin-mag__badge admin-mag__badge--on">
                  {roleLabel}
                </span>
                {admin.title ? (
                  <span className="admin-profile__title-chip">{admin.title}</span>
                ) : null}
              </div>
              <p className="admin-profile__photo-hint">
                Cliquez la photo pour la changer — recadrage carré, PNG / JPG /
                WEBP.
              </p>
            </div>
          </div>
        </section>

        <section className="admin-profile__card">
          <header className="admin-profile__card-head">
            <span className="admin-profile__card-icon" aria-hidden>
              <IdCard className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2>Informations</h2>
            </div>
          </header>

          <form
            className="admin-dash__form admin-profile__form"
            onSubmit={(e) => void saveProfile(e)}
          >
            <label className="admin-dash__field">
              <span>Nom complet</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
                autoComplete="name"
              />
            </label>
            <label className="admin-dash__field">
              <span>Titre</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Rédacteur en chef"
              />
            </label>
            <label className="admin-dash__field">
              <span>Téléphone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243…"
                autoComplete="tel"
              />
            </label>
            <label className="admin-dash__field">
              <span>Rôle</span>
              <input value={roleLabel} disabled />
            </label>
            <label className="admin-dash__field">
              <span>Email</span>
              <input value={admin.email} disabled />
            </label>
            <div className="admin-profile__form-actions admin-profile__form-actions--split">
              <button
                type="button"
                className="admin-dash__btn"
                disabled={locked}
                onClick={() => setPwdOpen(true)}
              >
                <KeyRound size={16} strokeWidth={2} aria-hidden />
                Changer le mot de passe
              </button>
              <button
                type="submit"
                className="admin-dash__btn admin-dash__btn--primary"
                disabled={locked}
              >
                {profileBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <AdminModal
        open={pwdOpen}
        title="Changer le mot de passe"
        onClose={closePasswordModal}
      >
        <form
          className="admin-dash__form admin-profile__form"
          onSubmit={(e) => void savePassword(e)}
        >
          <p className="admin-profile__modal-hint">
            Au moins 8 caractères. Vous resterez connecté après la
            modification.
          </p>
          <label className="admin-dash__field">
            <span>Mot de passe actuel</span>
            <span className="admin-profile__pwd">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-profile__pwd-toggle"
                aria-label={
                  showCurrent ? "Masquer le mot de passe" : "Afficher"
                }
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? (
                  <EyeOff size={16} strokeWidth={2} />
                ) : (
                  <Eye size={16} strokeWidth={2} />
                )}
              </button>
            </span>
          </label>
          <label className="admin-dash__field">
            <span>Nouveau mot de passe</span>
            <span className="admin-profile__pwd">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="8 caractères minimum"
              />
              <button
                type="button"
                className="admin-profile__pwd-toggle"
                aria-label={showNew ? "Masquer le mot de passe" : "Afficher"}
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? (
                  <EyeOff size={16} strokeWidth={2} />
                ) : (
                  <Eye size={16} strokeWidth={2} />
                )}
              </button>
            </span>
          </label>
          <label className="admin-dash__field">
            <span>Confirmer le nouveau mot de passe</span>
            <span className="admin-profile__pwd">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="admin-profile__pwd-toggle"
                aria-label={
                  showConfirm ? "Masquer le mot de passe" : "Afficher"
                }
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? (
                  <EyeOff size={16} strokeWidth={2} />
                ) : (
                  <Eye size={16} strokeWidth={2} />
                )}
              </button>
            </span>
          </label>
          <div className="admin-profile__form-actions admin-profile__form-actions--split">
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--cancel-vivid"
              disabled={passwordBusy}
              onClick={closePasswordModal}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-dash__btn admin-dash__btn--primary"
              disabled={passwordBusy || uploading || profileBusy}
            >
              <KeyRound size={16} strokeWidth={2} aria-hidden />
              {passwordBusy ? "Modification…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AvatarCropper
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        busy={uploading}
        onCancel={closeCropper}
        onConfirm={onCropConfirm}
      />
    </>
  );
}

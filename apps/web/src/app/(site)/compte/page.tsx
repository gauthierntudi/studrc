"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  Eye,
  EyeOff,
  Flag,
  Hash,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { AccountTabs } from "@/components/site/account-tabs";
import { AvatarCropper } from "@/components/site/avatar-cropper";
import { authApi } from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { COUNTRIES } from "@/lib/countries";
import "./compte.css";

const schema = z.object({
  name: z.string().min(2, "Nom trop court"),
  email: z.string().email("Adresse e-mail invalide"),
  phone: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  address: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(8, "Au moins 8 caractères"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const ICON = { size: 14, strokeWidth: 2 } as const;

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      country: "",
      countryCode: "",
      address: "",
    },
  });

  const pwdForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirm: "",
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/connexion");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    reset({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      country: user.country ?? "",
      countryCode: user.countryCode ?? "",
      address: user.address ?? "",
    });
  }, [user, reset]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pwd") === "1") {
      setPwdOpen(true);
      window.history.replaceState({}, "", "/compte");
    }
  }, []);

  useEffect(() => {
    if (!pwdOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pwdForm.formState.isSubmitting) {
        setPwdOpen(false);
        pwdForm.reset();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [pwdOpen, pwdForm]);

  const country = watch("country");

  const sortedCountries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [],
  );

  function onCountryChange(name: string) {
    setValue("country", name, { shouldDirty: true });
    const match = COUNTRIES.find((c) => c.name === name);
    setValue("countryCode", match?.code ?? "", { shouldDirty: true });
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onAvatarPick(file: File | undefined) {
    if (!file) return;
    if (!user?.emailVerified) {
      toast.error(
        "Confirmez votre adresse e-mail avant de modifier votre profil.",
      );
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["png", "jpg", "jpeg"].includes(ext)) {
      toast.error("Formats acceptés : PNG, JPG, JPEG");
      return;
    }
    // Source peut dépasser 1 Mo : le recadrage compresse avant envoi.
    if (file.size > 12_000_000) {
      toast.error("Image trop lourde (12 Mo max)");
      return;
    }

    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onCropConfirm(file: File) {
    if (!user?.emailVerified) {
      toast.error(
        "Confirmez votre adresse e-mail avant de modifier votre profil.",
      );
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    closeCropper();

    try {
      const updated = await toast.promise(authApi.uploadAvatar(file), {
        pending: "Envoi de la photo…",
        success: "Photo de profil mise à jour",
        error: {
          render({ data }) {
            if (data instanceof Error) return data.message;
            return "Impossible d’envoyer la photo";
          },
        },
      });
      setUser(updated);
      setPreviewUrl(null);
    } catch {
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!user?.emailVerified) {
      toast.error(
        "Confirmez votre adresse e-mail avant de modifier votre profil.",
      );
      return;
    }
    try {
      const updated = await toast.promise(
        authApi.updateProfile({
          name: values.name,
          email: values.email,
          phone: values.phone,
          country: values.country,
          countryCode: values.countryCode,
          address: values.address,
        }),
        {
          pending: "Enregistrement…",
          success: "Profil mis à jour",
          error: {
            render({ data }) {
              if (data instanceof Error) return data.message;
              return "Impossible d’enregistrer";
            },
          },
        },
      );
      setUser(updated);
    } catch {
      // toast.promise
    }
  });

  const onChangePassword = pwdForm.handleSubmit(async (values) => {
    try {
      await toast.promise(
        authApi.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
        {
          pending: "Mise à jour du mot de passe…",
          success: "Mot de passe mis à jour",
          error: {
            render({ data }) {
              if (data instanceof Error) return data.message;
              return "Impossible de modifier le mot de passe";
            },
          },
        },
      );
      pwdForm.reset();
      setPwdOpen(false);
      setShowCurrent(false);
      setShowNew(false);
    } catch {
      // toast.promise
    }
  });

  if (loading || !user) {
    return (
      <section className="opt-compte opt-compte--loading" aria-busy="true">
        <p>Chargement…</p>
      </section>
    );
  }

  const profileLocked = !user.emailVerified;

  return (
    <section className="opt-compte" aria-label="Mon profil">
      <div className="opt-compte__container">
        <AccountTabs />

        <header className="opt-compte__hero">
          <h1>Mon profil</h1>
          <p>
            {user.name ? `${user.name} — ` : null}
            {profileLocked
              ? "Confirmez votre adresse e-mail pour modifier votre profil."
              : "Mettez à jour votre photo, vos coordonnées et votre adresse de facturation."}
          </p>
        </header>

        {profileLocked ? (
          <p className="opt-compte__lock-note" role="status">
            Profil verrouillé tant que votre e-mail n’est pas confirmé. Utilisez
            le bandeau en haut de page pour renvoyer le message de confirmation.
          </p>
        ) : null}

        <article className={`opt-compte__card${profileLocked ? " is-locked" : ""}`}>
          <div className="opt-compte__card-body">
            <div className="opt-compte__profile">
              <div
                className={`opt-compte__avatar-wrap${uploading ? " is-uploading" : ""}`}
              >
                <div
                  className={`opt-compte__avatar-inner${uploading ? " is-uploading" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      previewUrl ||
                      avatarSrc(user.avatarUrl)
                    }
                    alt="Photo de profil"
                    onError={(e) => {
                      if (previewUrl) return;
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = avatarLocalFallback(user.avatarUrl);
                    }}
                  />
                  <div
                    className={`opt-compte__avatar-overlay${uploading ? " is-active" : ""}`}
                    aria-hidden={!uploading}
                  >
                    <span className="opt-compte__avatar-spinner" />
                    <span className="opt-compte__avatar-overlay-text">
                      Envoi…
                    </span>
                  </div>
                </div>
              </div>
              <div className="opt-compte__profile-text">
                <h2>{user.name || "Mon compte"}</h2>
                <p>
                  PNG, JPG ou JPEG. Recadrez en cercle avant l&apos;envoi (1 Mo
                  max après compression).
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  id="file"
                  className="opt-compte__file-input"
                  accept="image/png,image/jpeg,image/jpg"
                  disabled={uploading || profileLocked}
                  onChange={(e) => onAvatarPick(e.target.files?.[0])}
                />
                <label
                  htmlFor="file"
                  className={`opt-compte__upload-btn${uploading ? " is-loading" : ""}${profileLocked ? " is-disabled" : ""}`}
                  aria-disabled={uploading || profileLocked}
                >
                  <span className="opt-compte__btn-spinner" aria-hidden />
                  <Camera
                    size={15}
                    strokeWidth={2}
                    className="opt-compte__btn-camera"
                    aria-hidden
                  />
                  <span>
                    {uploading ? "Envoi en cours…" : "Changer la photo"}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </article>

        <article className={`opt-compte__card${profileLocked ? " is-locked" : ""}`}>
          <div className="opt-compte__card-body">
            <h2 className="opt-compte__section-title">
              <User {...ICON} aria-hidden />
              Informations personnelles
            </h2>

            <form className="opt-compte__form" onSubmit={onSubmit} noValidate>
              <fieldset disabled={profileLocked} className="opt-compte__fieldset">
              <div className="opt-compte__row">
                <div className="opt-compte__field">
                  <label htmlFor="nomAb">
                    <User {...ICON} aria-hidden /> Nom complet
                  </label>
                  <input
                    id="nomAb"
                    type="text"
                    autoComplete="name"
                    placeholder="Votre nom complet"
                    {...register("name")}
                  />
                  {errors.name ? (
                    <p className="opt-compte__error">{errors.name.message}</p>
                  ) : null}
                </div>
                <div className="opt-compte__field">
                  <label htmlFor="telAb">
                    <Phone {...ICON} aria-hidden /> Téléphone
                  </label>
                  <input
                    id="telAb"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Votre numéro de téléphone"
                    {...register("phone")}
                  />
                </div>
              </div>

              <div className="opt-compte__row">
                <div className="opt-compte__field">
                  <label htmlFor="mailAb">
                    <Mail {...ICON} aria-hidden /> Adresse e-mail
                  </label>
                  <input
                    id="mailAb"
                    type="email"
                    autoComplete="email"
                    placeholder="Votre adresse e-mail"
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="opt-compte__error">{errors.email.message}</p>
                  ) : null}
                </div>
                <div className="opt-compte__field opt-compte__field--split">
                  <div className="opt-compte__field">
                    <label htmlFor="pays">
                      <Flag {...ICON} aria-hidden /> Pays
                    </label>
                    <select
                      id="pays"
                      value={country ?? ""}
                      onChange={(e) => onCountryChange(e.target.value)}
                    >
                      <option value="">Sélectionner votre pays</option>
                      {sortedCountries.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="opt-compte__field opt-compte__field--code">
                    <label htmlFor="codePays">
                      <Hash {...ICON} aria-hidden /> Indicatif
                    </label>
                    <input
                      id="codePays"
                      type="text"
                      readOnly
                      placeholder="+…"
                      {...register("countryCode")}
                    />
                  </div>
                </div>
              </div>

              <div className="opt-compte__field">
                <label htmlFor="adresse_physique">
                  <MapPin {...ICON} aria-hidden /> Adresse physique
                </label>
                <textarea
                  id="adresse_physique"
                  rows={3}
                  placeholder="Rue, ville, code postal…"
                  {...register("address")}
                />
                <p className="opt-compte__hint">
                  Utilisée pour la facturation et la livraison si applicable.
                </p>
              </div>

              <div className="opt-compte__actions">
                <button
                  type="submit"
                  className="opt-compte__btn-save"
                  disabled={isSubmitting || !isDirty || profileLocked}
                >
                  <Save size={15} strokeWidth={2} aria-hidden />
                  {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
              </fieldset>
              <div className="opt-compte__actions opt-compte__actions--pwd">
                <button
                  type="button"
                  className="opt-compte__link-pwd"
                  onClick={() => setPwdOpen(true)}
                >
                  modifier mon mot de passe
                </button>
              </div>
            </form>
          </div>
        </article>
      </div>

      {pwdOpen ? (
        <div
          className="opt-compte-pwd"
          role="dialog"
          aria-modal="true"
          aria-labelledby="opt-compte-pwd-title"
        >
          <button
            type="button"
            className="opt-compte-pwd__backdrop"
            aria-label="Fermer"
            disabled={pwdForm.formState.isSubmitting}
            onClick={() => {
              setPwdOpen(false);
              pwdForm.reset();
            }}
          />
          <div className="opt-compte-pwd__panel">
            <header className="opt-compte-pwd__header">
              <div>
                <h2 id="opt-compte-pwd-title">
                  <KeyRound size={18} strokeWidth={2} aria-hidden />
                  Modifier mon mot de passe
                </h2>
                <p>
                  Saisissez votre mot de passe actuel, puis choisissez-en un
                  nouveau (8 caractères minimum).
                </p>
              </div>
              <button
                type="button"
                className="opt-compte-pwd__close"
                aria-label="Fermer"
                disabled={pwdForm.formState.isSubmitting}
                onClick={() => {
                  setPwdOpen(false);
                  pwdForm.reset();
                }}
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </header>

            <form
              className="opt-compte-pwd__form"
              onSubmit={onChangePassword}
              noValidate
            >
              <div className="opt-compte__field">
                <label htmlFor="currentPassword">Mot de passe actuel</label>
                <div className="opt-compte__pwd-input">
                  <input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    {...pwdForm.register("currentPassword")}
                  />
                  <button
                    type="button"
                    className="opt-compte__pwd-toggle"
                    aria-label={
                      showCurrent ? "Masquer" : "Afficher le mot de passe"
                    }
                    onClick={() => setShowCurrent((v) => !v)}
                  >
                    {showCurrent ? (
                      <EyeOff size={16} strokeWidth={2} />
                    ) : (
                      <Eye size={16} strokeWidth={2} />
                    )}
                  </button>
                </div>
                {pwdForm.formState.errors.currentPassword ? (
                  <p className="opt-compte__error">
                    {pwdForm.formState.errors.currentPassword.message}
                  </p>
                ) : null}
              </div>

              <div className="opt-compte__field">
                <label htmlFor="newPassword">Nouveau mot de passe</label>
                <div className="opt-compte__pwd-input">
                  <input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    {...pwdForm.register("newPassword")}
                  />
                  <button
                    type="button"
                    className="opt-compte__pwd-toggle"
                    aria-label={
                      showNew ? "Masquer" : "Afficher le mot de passe"
                    }
                    onClick={() => setShowNew((v) => !v)}
                  >
                    {showNew ? (
                      <EyeOff size={16} strokeWidth={2} />
                    ) : (
                      <Eye size={16} strokeWidth={2} />
                    )}
                  </button>
                </div>
                {pwdForm.formState.errors.newPassword ? (
                  <p className="opt-compte__error">
                    {pwdForm.formState.errors.newPassword.message}
                  </p>
                ) : null}
              </div>

              <div className="opt-compte__field">
                <label htmlFor="confirmPassword">Confirmation</label>
                <input
                  id="confirmPassword"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  {...pwdForm.register("confirm")}
                />
                {pwdForm.formState.errors.confirm ? (
                  <p className="opt-compte__error">
                    {pwdForm.formState.errors.confirm.message}
                  </p>
                ) : null}
              </div>

              <div className="opt-compte-pwd__actions">
                <Link
                  href="/mot-de-passe-oublie"
                  className="opt-compte__link-pwd"
                >
                  mot de passe oublié ?
                </Link>
                <div className="opt-compte-pwd__btns">
                  <button
                    type="button"
                    className="opt-compte-pwd__btn opt-compte-pwd__btn--ghost"
                    disabled={pwdForm.formState.isSubmitting}
                    onClick={() => {
                      setPwdOpen(false);
                      pwdForm.reset();
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="opt-compte-pwd__btn opt-compte-pwd__btn--primary"
                    disabled={pwdForm.formState.isSubmitting}
                  >
                    {pwdForm.formState.isSubmitting
                      ? "Mise à jour…"
                      : "Enregistrer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AvatarCropper
        open={Boolean(cropSrc)}
        imageSrc={cropSrc ?? ""}
        busy={uploading}
        onCancel={closeCropper}
        onConfirm={onCropConfirm}
      />
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { authApi } from "@/lib/api";
import { AuthPanel } from "@/components/site/auth-panel";
import { OtpBoxes } from "@/components/site/otp-boxes";

const emailSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
});

const resetSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code à 6 chiffres"),
    password: z.string().min(8, "Au moins 8 caractères"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type EmailValues = z.infer<typeof emailSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: "", password: "", confirm: "" },
  });

  useEffect(() => {
    if (!authLoading && user?.email && !email) {
      emailForm.setValue("email", user.email);
    }
  }, [authLoading, user?.email, email, emailForm]);

  const otpValue = resetForm.watch("otp");

  const onRequestOtp = emailForm.handleSubmit(async (values) => {
    setError(null);
    const normalized = values.email.trim().toLowerCase();
    try {
      await toast.promise(authApi.forgotPassword(normalized), {
        pending: "Vérification de l’adresse e-mail…",
        success: "Un code a été envoyé à votre adresse e-mail",
        error: {
          render({ data }) {
            if (data instanceof Error) return data.message;
            return "Votre adresse e-mail n’existe pas";
          },
        },
      });
      setEmail(normalized);
    } catch {
      // toast.promise affiche déjà l’erreur
    }
  });

  const onReset = resetForm.handleSubmit(async (values) => {
    if (!email) return;
    setError(null);
    try {
      await toast.promise(
        authApi.resetPassword(email, values.otp, values.password),
        {
          pending: "Mise à jour du mot de passe…",
          success: "Mot de passe mis à jour",
          error: {
            render({ data }) {
              if (data instanceof Error) return data.message;
              return "Impossible de mettre à jour le mot de passe";
            },
          },
        },
      );
      router.push(user ? "/compte" : "/connexion");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  });

  const onResend = async () => {
    if (!email) return;
    setError(null);
    setResending(true);
    try {
      await toast.promise(authApi.forgotPassword(email), {
        pending: "Envoi d’un nouveau code…",
        success: "Un nouveau code a été envoyé",
        error: {
          render({ data }) {
            if (data instanceof Error) return data.message;
            return "Impossible de renvoyer le code";
          },
        },
      });
      resetForm.setValue("otp", "");
    } catch {
      // toast.promise affiche déjà l’erreur
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPanel
      title={email ? "Entrez le code reçu" : "Mot de passe oublié"}
      subtitle={
        email
          ? `Saisissez le code envoyé à ${email}`
          : user
            ? "Recevez un code OTP, ou changez-le directement depuis votre compte"
            : "Recevez un code pour choisir un nouveau mot de passe"
      }
      badge={user ? "Mon compte" : "Se connecter"}
      badgeHref={user ? "/compte?pwd=1" : "/connexion"}
      footer={
        email ? (
          user ? (
            <Link href="/compte?pwd=1">Changer sans OTP (mot de passe actuel)</Link>
          ) : (
            <>
              Pas de compte ? <Link href="/inscription">S&apos;inscrire</Link>
            </>
          )
        ) : user ? (
          <Link href="/compte?pwd=1">Je connais mon mot de passe actuel</Link>
        ) : (
          <Link href="/connexion">Retour à la connexion</Link>
        )
      }
    >
      {email ? (
        <form onSubmit={onReset} noValidate>
          <div className="auth-field">
            <label htmlFor="otp">Code OTP</label>
            <OtpBoxes
              value={otpValue ?? ""}
              onChange={(otp) => {
                resetForm.setValue("otp", otp, {
                  shouldValidate: otp.length === 6,
                  shouldDirty: true,
                });
              }}
              disabled={resetForm.formState.isSubmitting}
              hasError={Boolean(resetForm.formState.errors.otp)}
            />
            <input type="hidden" {...resetForm.register("otp")} />
            {resetForm.formState.errors.otp ? (
              <p className="auth-error">
                {resetForm.formState.errors.otp.message}
              </p>
            ) : null}
          </div>

          <div className="auth-field">
            <label htmlFor="password">Nouveau mot de passe</label>
            <div className="auth-input-wrap auth-input-wrap--password">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                id="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...resetForm.register("password")}
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {resetForm.formState.errors.password ? (
              <p className="auth-error">
                {resetForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="auth-field">
            <label htmlFor="confirm">Confirmer</label>
            <div className="auth-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                id="confirm"
                placeholder="••••••••"
                autoComplete="new-password"
                {...resetForm.register("confirm")}
              />
            </div>
            {resetForm.formState.errors.confirm ? (
              <p className="auth-error">
                {resetForm.formState.errors.confirm.message}
              </p>
            ) : null}
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button
            type="submit"
            className="auth-submit"
            disabled={resetForm.formState.isSubmitting}
          >
            {resetForm.formState.isSubmitting
              ? "Mise à jour…"
              : "Mettre à jour le mot de passe"}
          </button>

          <p className="auth-resend">
            <button
              type="button"
              className="auth-resend__btn"
              onClick={onResend}
              disabled={resending}
            >
              {resending ? "Envoi…" : "Renvoyer le code"}
            </button>
            {" · "}
            <button
              type="button"
              className="auth-resend__btn"
              onClick={() => {
                setEmail(null);
                setError(null);
                resetForm.reset();
              }}
            >
              Changer d&apos;e-mail
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={onRequestOtp} noValidate>
          <div className="auth-field">
            <label htmlFor="email">Votre e-mail</label>
            <div className="auth-input-wrap">
              <input
                type="email"
                className="form-control"
                id="email"
                placeholder="vous@exemple.com"
                autoComplete="email"
                {...emailForm.register("email")}
              />
            </div>
            {emailForm.formState.errors.email ? (
              <p className="auth-error">
                {emailForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button
            type="submit"
            className="auth-submit"
            disabled={emailForm.formState.isSubmitting}
          >
            {emailForm.formState.isSubmitting
              ? "Envoi…"
              : "Recevoir le code"}
          </button>
        </form>
      )}
    </AuthPanel>
  );
}

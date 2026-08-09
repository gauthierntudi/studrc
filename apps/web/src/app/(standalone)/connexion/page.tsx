"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import { safeAuthNext } from "@/lib/auth-next";
import { useAuth } from "@/components/auth-provider";
import { AuthPanel } from "@/components/site/auth-panel";
import { GoogleSignInButton } from "@/components/site/google-sign-in-button";
import {
  TurnstileWidget,
  resetTurnstile,
} from "@/components/site/turnstile-widget";
import { isTurnstileRequired } from "@/lib/captcha";

const schema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRequired = isTurnstileRequired();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (turnstileRequired && !turnstileToken) {
      setError("Complétez la vérification anti-bot.");
      return;
    }
    try {
      const user = await authApi.login({
        ...values,
        turnstileToken: turnstileToken ?? undefined,
      });
      setUser(user);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
      setTurnstileToken(null);
      resetTurnstile();
    }
  });

  return (
    <AuthPanel
      title="Connectez-vous"
      subtitle="Accédez à votre compte Opt1mum"
      badge="S'inscrire"
      badgeHref={`/inscription?next=${encodeURIComponent(next)}`}
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={`/inscription?next=${encodeURIComponent(next)}`}>
            S&apos;inscrire
          </Link>
        </>
      }
    >
      <form method="POST" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="mailconnect">Votre e-mail</label>
          <div className="auth-input-wrap">
            <input
              type="email"
              className="form-control"
              id="mailconnect"
              placeholder="vous@exemple.com"
              autoComplete="email"
              {...register("email")}
            />
          </div>
          {errors.email ? (
            <p className="auth-error">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="mdpconnect">Mot de passe</label>
          <div className="auth-input-wrap auth-input-wrap--password">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control"
              id="mdpconnect"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
            />
            <button
              type="button"
              className="auth-reveal"
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.75} />
              ) : (
                <Eye size={18} strokeWidth={1.75} />
              )}
            </button>
          </div>
          {errors.password ? (
            <p className="auth-error">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="auth-row">
          <label className="auth-toggle" htmlFor="remember">
            <span className="auth-toggle__control">
              <input
                id="remember"
                type="checkbox"
                className="auth-toggle__input"
              />
              <span className="auth-toggle__track" aria-hidden="true" />
            </span>
            <span className="auth-toggle__text">Se souvenir de moi</span>
          </label>
          <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <TurnstileWidget onToken={setTurnstileToken} />

        <button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting || (turnstileRequired && !turnstileToken)}
        >
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <GoogleSignInButton
        onError={setError}
        next={next}
        turnstileToken={turnstileToken}
        requireTurnstile={turnstileRequired}
      />
    </AuthPanel>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel
          title="Connectez-vous"
          subtitle="Accédez à votre compte Opt1mum"
          footer={null}
        >
          <p className="auth-error">Chargement…</p>
        </AuthPanel>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

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

const schema = z.object({
  name: z.string().min(2, "Nom trop court"),
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(8, "Au moins 8 caractères"),
  terms: z.boolean().refine((v) => v === true, {
    message: "Conditions requises",
  }),
});

type FormValues = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      setUser(user);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
    }
  });

  return (
    <AuthPanel
      title="Créez votre compte"
      subtitle="Rejoignez Opt1mum et accédez à tous les contenus"
      badge="Se connecter"
      badgeHref="/connexion"
      footer={
        <>
          Déjà un compte ? <Link href="/connexion">Se connecter</Link>
        </>
      }
    >
      <form method="POST" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="nomAb">Votre nom</label>
          <div className="auth-input-wrap">
            <input
              type="text"
              className="form-control"
              id="nomAb"
              placeholder="Votre nom"
              autoComplete="name"
              {...register("name")}
            />
          </div>
          {errors.name ? (
            <p className="auth-error">{errors.name.message}</p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="mailAb">Votre e-mail</label>
          <div className="auth-input-wrap">
            <input
              type="email"
              className="form-control"
              id="mailAb"
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
          <label htmlFor="password">Mot de passe</label>
          <div className="auth-input-wrap auth-input-wrap--password">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control"
              id="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("password")}
            />
            <button
              type="button"
              className="auth-reveal"
              aria-label={
                showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
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

        <div className="auth-field">
          <label className="auth-toggle" htmlFor="check_terms">
            <span className="auth-toggle__control">
              <input
                id="check_terms"
                type="checkbox"
                className="auth-toggle__input"
                {...register("terms")}
              />
              <span className="auth-toggle__track" aria-hidden="true" />
            </span>
            <span className="auth-toggle__text">
              J&apos;accepte les{" "}
              <Link
                href="/conditions-utilisation"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                conditions d&apos;utilisation
              </Link>
            </span>
          </label>
          {errors.terms ? (
            <p className="auth-error">{errors.terms.message}</p>
          ) : null}
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Création…" : "S'inscrire"}
        </button>
      </form>

      <GoogleSignInButton
        onError={setError}
        dividerLabel="Inscription rapide"
        next={next}
      />
    </AuthPanel>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel
          title="Créez votre compte"
          subtitle="Rejoignez Opt1mum"
          footer={null}
        >
          <p className="auth-error">Chargement…</p>
        </AuthPanel>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

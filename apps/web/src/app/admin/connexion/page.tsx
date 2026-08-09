"use client";

import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminBrandLogo } from "@/components/admin/admin-brand-logo";
import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import { Alert } from "@/components/ui/alert";
import { adminAuthApi } from "@/lib/api";
import { getAdminEmailHint } from "@/lib/admin-session-hint";
import { AUTH_HERO_VISIBLE, heroWindow, nextHeroOffset, prevHeroOffset } from "@/lib/auth-hero-slides";
import {
  TurnstileWidget,
  resetTurnstile,
} from "@/components/site/turnstile-widget";
import { isTurnstileRequired } from "@/lib/captcha";

const SLIDE_MS = 5000;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdmin } = useAdminAuth();
  const [batchOffset, setBatchOffset] = useState(0);
  const [slide, setSlide] = useState(0);
  const slides = useMemo(
    () => heroWindow(batchOffset, AUTH_HERO_VISIBLE).map((s) => s.cover),
    [batchOffset],
  );
  const [hydrated, setHydrated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRequired = isTurnstileRequired();

  useEffect(() => {
    void adminAuthApi
      .me()
      .then((me) => {
        setAdmin(me);
        router.replace("/admin");
      })
      .catch(() => {
        const hint = getAdminEmailHint();
        if (hint) setEmail(hint);
        setChecking(false);
        setHydrated(true);
      });
  }, [router, setAdmin]);

  useEffect(() => {
    if (slides.length <= 1 || checking) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setSlide((i) => {
        if (i < AUTH_HERO_VISIBLE - 1) return i + 1;
        setBatchOffset((o) => nextHeroOffset(o));
        return 0;
      });
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, checking]);

  function prevSlide() {
    setSlide((i) => {
      if (i > 0) return i - 1;
      setBatchOffset((o) => prevHeroOffset(o));
      return AUTH_HERO_VISIBLE - 1;
    });
  }

  function nextSlide() {
    setSlide((i) => {
      if (i < AUTH_HERO_VISIBLE - 1) return i + 1;
      setBatchOffset((o) => nextHeroOffset(o));
      return 0;
    });
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    if (turnstileRequired && !turnstileToken) {
      setMessage("Complétez la vérification anti-bot.");
      setLoading(false);
      return;
    }
    try {
      const me = await adminAuthApi.login({
        email: email.trim(),
        password,
        turnstileToken: turnstileToken ?? undefined,
      });
      setAdmin(me);
      router.push("/admin");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connexion refusée");
      setTurnstileToken(null);
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  if (checking || !hydrated) {
    return (
      <div className="admin-auth admin-auth--boot" role="status" aria-live="polite">
        <p className="admin-auth__boot-msg">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="admin-auth">
      {loading ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            fontSize: 14,
          }}
        >
          Connexion admin…
        </div>
      ) : null}

      <aside className="admin-auth__hero">
        <div className="admin-auth__hero-frame">
          {slides.map((src, index) => (
            <Image
              key={`${batchOffset}-${src}`}
              src={src}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={
                index === slide
                  ? "admin-auth__hero-img admin-auth__hero-img--active"
                  : "admin-auth__hero-img"
              }
            />
          ))}
          <div className="admin-auth__hero-shade" />
          <div className="admin-auth__hero-copy">
            <h2>Pilotez le magazine en toute confiance.</h2>
            <p>
              Console staff OPT1MUM — magazines, abonnements et rédaction.
            </p>
          </div>
          <div className="admin-auth__hero-nav">
            <button type="button" onClick={prevSlide} aria-label="Précédent">
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={nextSlide} aria-label="Suivant">
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <section className="admin-auth__panel">
        <form className="admin-auth__form" onSubmit={(e) => void submitPassword(e)}>
          <AdminBrandLogo
            variant="default"
            href="/"
            width={148}
            height={36}
            priority
          />
          <div className="admin-auth__intro">
            <h1>Bon retour</h1>
            <p>Accès réservé au staff OPT1MUM.</p>
          </div>

          {message ? <Alert variant="error">{message}</Alert> : null}

          <label className="admin-auth__field">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="admin@opt1mum.com"
            />
          </label>

          <label className="admin-auth__field">
            <span>Mot de passe</span>
            <div className="admin-auth__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="admin-auth__reveal"
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </label>

          <TurnstileWidget onToken={setTurnstileToken} />

          <button
            type="submit"
            className="admin-auth__submit"
            disabled={loading || (turnstileRequired && !turnstileToken)}
          >
            Se connecter
          </button>
        </form>
      </section>
    </div>
  );
}

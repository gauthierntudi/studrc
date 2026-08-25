"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AUTH_HERO_VISIBLE,
  heroWindow,
  nextHeroOffset,
} from "@/lib/auth-hero-slides";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import { ThemeToggle } from "./theme-toggle";
import "./auth-panel.css";

type AuthPanelProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Badge haut droite — action alternative (ex. S'inscrire sur la page login) */
  badge?: string;
  badgeHref?: string;
};

/**
 * Auth split plein écran — layout type maquette (panneau photo + formulaire).
 * 3 slides visibles ; à chaque cycle, nouvelles images du pool.
 */
export function AuthPanel({
  title,
  subtitle,
  children,
  footer,
  badge = "Se connecter",
  badgeHref,
}: AuthPanelProps) {
  const [batchOffset, setBatchOffset] = useState(0);
  const [slide, setSlide] = useState(0);

  const slides = useMemo(
    () => heroWindow(batchOffset, AUTH_HERO_VISIBLE),
    [batchOffset],
  );

  const goNext = () => {
    setSlide((s) => {
      if (s < AUTH_HERO_VISIBLE - 1) return s + 1;
      setBatchOffset((o) => nextHeroOffset(o));
      return 0;
    });
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    let id: number | undefined;

    const start = () => {
      if (id != null) window.clearInterval(id);
      if (mq.matches) return;
      id = window.setInterval(goNext, 5500);
    };

    start();
    mq.addEventListener("change", start);
    return () => {
      if (id != null) window.clearInterval(id);
      mq.removeEventListener("change", start);
    };
  }, []);

  const current = slides[slide] ?? slides[0];
  if (!current) return null;

  return (
    <section className="opt-auth" aria-label={title}>
      <div className="opt-auth__stage">
        <aside className="opt-auth__brand">
          {slides.map((item, i) => (
            <div
              key={`${batchOffset}-${item.cover}`}
              className={`opt-auth__brand-slide${i === slide ? " is-active" : ""}`}
              aria-hidden={i !== slide}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.cover} alt="" className="opt-auth__brand-cover" />
            </div>
          ))}
          <div className="opt-auth__brand-shade" aria-hidden />

          <Link href="/" className="opt-auth__brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/studrc-logo.png" alt="STUDRC" />
          </Link>

          <div className="opt-auth__brand-footer">
            <h1 className="opt-auth__brand-title">{current.title}</h1>
            <p className="opt-auth__brand-lead">{current.lead}</p>
            <div className="opt-auth__dots" role="tablist" aria-label="Diaporama">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  className={`opt-auth__dot${i === slide ? " is-active" : ""}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          </div>
        </aside>

        <div className="opt-auth__panel">
          <div className="opt-auth__panel-top">
            <Link href="/" className="opt-auth__panel-logo" aria-label="STUDRC — accueil">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/studrc-logo.png" alt="STUDRC" />
            </Link>
            <div className="opt-auth__panel-top-actions">
              <ThemeToggle />
              {badgeHref ? (
                <Link href={badgeHref} className="opt-auth__badge">
                  {badge}
                </Link>
              ) : (
                <span className="opt-auth__badge">{badge}</span>
              )}
              {SUBSCRIPTIONS_ENABLED ? (
                <Link href="/abonnement" className="opt-auth__cta-sub">
                  S&apos;abonner
                </Link>
              ) : null}
            </div>
          </div>

          <div className="opt-auth__panel-inner">
            <header className="opt-auth__header">
              <h2 className="opt-auth__title">{title}</h2>
              <p className="opt-auth__subtitle">{subtitle}</p>
            </header>

            <div className="opt-auth__body">{children}</div>

            <p className="opt-auth__footer">{footer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

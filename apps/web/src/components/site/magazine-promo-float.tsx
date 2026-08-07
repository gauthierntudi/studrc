"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { Maximize2, X } from "lucide-react";
import "./magazine-promo-float.css";

const FALLBACK_COVER = "/legacy/covers/1591457791.jpg";
const DEFAULT_THEME = { bgColor: "#0d203d", accentColor: "#02d0d1" };
const MOBILE_MQ = "(max-width: 640px)";

function contrastOn(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L < 0.45 ? "#ffffff" : "#0d203d";
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

export type MagazinePromoFloatProps = {
  magazine: {
    id: string;
    title: string;
    coverUrl: string | null;
    theme?: { bgColor: string; accentColor: string } | null;
  };
  /** Libellé au-dessus du titre */
  eyebrow?: string;
  /** Délai avant apparition (ms). 0 = immédiat. */
  showDelayMs?: number;
};

/**
 * Widget flottant kiosque (desktop) / bottom sheet fermable (mobile).
 */
export function MagazinePromoFloat({
  magazine,
  eyebrow = "Dans le kiosque",
  showDelayMs = 10_000,
}: MagazinePromoFloatProps) {
  const [visible, setVisible] = useState(showDelayMs <= 0);
  const [dismissed, setDismissed] = useState(false);
  const [closedForGood, setClosedForGood] = useState(false);

  useEffect(() => {
    if (showDelayMs <= 0) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), showDelayMs);
    return () => window.clearTimeout(timer);
  }, [showDelayMs]);

  useEffect(() => {
    if (!visible || dismissed || closedForGood) return;
    if (!isMobileViewport()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible, dismissed, closedForGood]);

  const theme = magazine.theme ?? DEFAULT_THEME;
  const themeStyle = {
    ["--mag-bg" as string]: theme.bgColor,
    ["--mag-accent" as string]: theme.accentColor,
    ["--mag-on-bg" as string]: contrastOn(theme.bgColor),
    ["--mag-on-accent" as string]: contrastOn(theme.accentColor),
  } as CSSProperties;

  if (!visible || closedForGood) return null;

  const href = `/kiosque?magazine=${encodeURIComponent(magazine.id)}`;
  const cover = magazine.coverUrl || FALLBACK_COVER;

  const close = () => {
    if (isMobileViewport()) {
      setClosedForGood(true);
      return;
    }
    setDismissed(true);
  };

  if (dismissed) {
    return (
      <aside
        className="opt-mag-float opt-mag-float--mini"
        aria-label="Magazine (réduit)"
        style={themeStyle}
      >
        <button
          type="button"
          className="opt-mag-float__expand"
          onClick={() => setDismissed(false)}
          aria-label={`Agrandir le magazine ${magazine.title}`}
        >
          <Maximize2 size={13} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          className="opt-mag-float__mini-hit"
          onClick={() => setDismissed(false)}
          aria-label={`Afficher le magazine ${magazine.title}`}
        >
          <span className="opt-mag-float__mini-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" />
          </span>
          <span className="opt-mag-float__mini-body">
            <span className="opt-mag-float__eyebrow">Kiosque</span>
            <span className="opt-mag-float__mini-title">{magazine.title}</span>
          </span>
        </button>
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        className="opt-mag-float__scrim"
        aria-label="Fermer"
        onClick={close}
      />

      <aside
        className="opt-mag-float"
        aria-label="Magazine"
        role="dialog"
        aria-modal="true"
        style={themeStyle}
      >
        <div className="opt-mag-float__sheet-bar" aria-hidden>
          <span className="opt-mag-float__sheet-handle" />
        </div>

        <button
          type="button"
          className="opt-mag-float__close"
          onClick={close}
          aria-label="Fermer"
        >
          <X size={14} strokeWidth={2.5} aria-hidden />
        </button>

        <Link href={href} className="opt-mag-float__media" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" />
        </Link>

        <div className="opt-mag-float__body">
          <p className="opt-mag-float__eyebrow">{eyebrow}</p>
          <p className="opt-mag-float__title">{magazine.title}</p>
          <Link href={href} className="opt-mag-float__cta" onClick={close}>
            Voir le numéro
          </Link>
        </div>
      </aside>
    </>
  );
}

"use client";

import { BookOpen } from "lucide-react";

type Props = {
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  seed: string;
  isLatest?: boolean;
  canRead?: boolean;
};

const BADGE_PALETTE = [
  { background: "#e9262a", color: "#ffffff" },
  { background: "#02d0d1", color: "#0a3d3e" },
  { background: "#0d203d", color: "#ffffff" },
  { background: "#f59e0b", color: "#1a1200" },
  { background: "#8b5cf6", color: "#ffffff" },
  { background: "#10b981", color: "#042f1e" },
  { background: "#ec4899", color: "#ffffff" },
  { background: "#3b82f6", color: "#ffffff" },
  { background: "#ef4444", color: "#ffffff" },
  { background: "#14b8a6", color: "#042f2e" },
  { background: "#f97316", color: "#1a0a00" },
  { background: "#6366f1", color: "#ffffff" },
] as const;

function badgeColorsFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

function resolveSrc(coverUrl: string | null) {
  return coverUrl || "/legacy/covers/1591457791.jpg";
}

export function MagazineCover({
  title,
  issueNumber,
  coverUrl,
  seed,
  isLatest = false,
  canRead = true,
}: Props) {
  const src = resolveSrc(coverUrl);
  const badge = badgeColorsFromSeed(seed);

  return (
    <div className="opt-mags__cover">
      {issueNumber ? (
        <span
          className="opt-mags__numero"
          style={{ background: badge.background, color: badge.color }}
        >
          #{issueNumber}
        </span>
      ) : null}
      {isLatest ? <span className="opt-mags__tag">Nouveau</span> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        title={title}
        loading="lazy"
        width={300}
        height={400}
      />
      <span className="opt-mags__overlay" aria-hidden>
        <span className="opt-mags__overlay-cta">
          <BookOpen size={15} strokeWidth={2.25} aria-hidden />
          {canRead ? "Lire" : "S’abonner"}
        </span>
      </span>
    </div>
  );
}

import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";

const DEFAULT_CTA_THEME = { bgColor: "#00132b", accentColor: "#0565ab" };

export function contrastOn(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#062a2b";
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L < 0.45 ? "#ffffff" : "#062a2b";
}

/** page-flip réécrit style.cssText et efface le fond — on le réapplique. */
export function reinforceCtaPage(host: HTMLElement) {
  if (host.dataset.cta !== "1") return;
  const bg = host.dataset.bg;
  const ink = host.dataset.ink;
  if (bg) host.style.setProperty("background", bg);
  const inner = host.querySelector<HTMLElement>(".opt-flip__cta");
  if (inner) {
    if (bg) inner.style.setProperty("background", bg);
    if (ink) inner.style.setProperty("color", ink);
  }
}

export function createPreviewCtaPage(
  magazineId: string,
  coverUrl: string | null,
  magazineTitle: string,
  theme: { bgColor: string; accentColor: string } | null,
  opts?: { isFree?: boolean; loggedIn?: boolean },
): HTMLElement {
  const isFree = Boolean(opts?.isFree);
  const loggedIn = Boolean(opts?.loggedIn);
  const bg = theme?.bgColor || DEFAULT_CTA_THEME.bgColor;
  const accent = theme?.accentColor || DEFAULT_CTA_THEME.accentColor;
  const onAccent = contrastOn(accent);
  const onBg = contrastOn(bg);
  const muted =
    onBg === "#ffffff" ? "rgba(248,250,252,0.82)" : "rgba(6,42,43,0.72)";
  const ghostBorder =
    onBg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(6,42,43,0.22)";

  const lectureHref = `/lecture/${encodeURIComponent(magazineId)}`;
  const loginHref = `/connexion?next=${encodeURIComponent(`/lecture/${magazineId}`)}`;

  const el = document.createElement("div");
  el.className = "opt-flip__page opt-flip__page--cta";
  el.dataset.cta = "1";
  el.dataset.hq = "1";
  el.dataset.bg = bg;
  el.dataset.ink = onBg;
  el.style.setProperty("--cta-bg", bg);
  el.style.setProperty("--cta-ink", onBg);
  el.style.setProperty("--cta-accent", accent);
  el.style.setProperty("--cta-on-accent", onAccent);
  el.setAttribute(
    "aria-label",
    isFree
      ? "Fin de l’aperçu — se connecter"
      : "Fin de l’aperçu — s’abonner ou acheter",
  );
  el.style.setProperty("background", bg);

  const inner = document.createElement("div");
  inner.className = "opt-flip__cta";
  inner.style.cssText = [
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "gap:0.75rem",
    "padding:8% 7%",
    "text-align:center",
    `color:${onBg}`,
    `background:${bg}`,
  ].join(";");

  if (coverUrl) {
    const coverWrap = document.createElement("div");
    coverWrap.className = "opt-flip__cta-cover";
    coverWrap.style.cssText = [
      "flex:0 0 auto",
      "width:min(42%,9.5rem)",
      "aspect-ratio:3/4",
      "border-radius:4px",
      "overflow:hidden",
      "background:color-mix(in srgb, var(--cta-ink) 8%, transparent)",
    ].join(";");

    const cover = document.createElement("img");
    cover.src = coverUrl;
    cover.alt = magazineTitle ? `Couverture — ${magazineTitle}` : "Couverture";
    cover.draggable = false;
    cover.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover";
    coverWrap.append(cover);
    inner.append(coverWrap);
  }

  const eyebrow = document.createElement("p");
  eyebrow.className = "opt-flip__cta-eyebrow";
  eyebrow.style.cssText = `margin:0;font-size:0.72rem;font-weight:750;letter-spacing:0.1em;text-transform:uppercase;color:var(--cta-accent, ${accent})`;
  eyebrow.textContent = "Fin de l’aperçu";

  const title = document.createElement("h2");
  title.className = "opt-flip__cta-title";
  title.style.cssText = `margin:0;max-width:18rem;font-size:1.35rem;font-weight:750;line-height:1.15;color:${onBg}`;
  title.textContent = "Poursuivez la lecture";

  const text = document.createElement("p");
  text.className = "opt-flip__cta-text";
  text.style.cssText = `margin:0;max-width:18rem;font-size:0.88rem;line-height:1.5;color:${muted}`;
  text.textContent = isFree
    ? loggedIn
      ? "Ce numéro est gratuit. Ouvrez la lecture complète pour voir les pages suivantes."
      : "Les pages suivantes sont accessibles après connexion."
    : SUBSCRIPTIONS_ENABLED
      ? "Les pages suivantes sont réservées aux abonnés et aux acheteurs de ce numéro."
      : "Les pages suivantes sont réservées aux acheteurs de ce numéro.";

  const actions = document.createElement("div");
  actions.className = "opt-flip__cta-actions";
  actions.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:center;gap:0.55rem;margin-top:0.2rem";

  const primary = document.createElement("a");
  primary.className = "opt-flip__cta-btn opt-flip__cta-btn--primary";
  primary.href = isFree
    ? loggedIn
      ? lectureHref
      : loginHref
    : `/achat?magazine=${encodeURIComponent(magazineId)}`;
  primary.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:0.55rem 1.1rem;border-radius:999px;background:var(--cta-accent, ${accent});color:var(--cta-on-accent, ${onAccent});font-size:0.88rem;font-weight:750;text-decoration:none`;
  primary.textContent = isFree
    ? loggedIn
      ? "Lire ce numéro"
      : "Se connecter"
    : "Acheter ce numéro";

  actions.append(primary);
  if (!isFree && SUBSCRIPTIONS_ENABLED) {
    const subscribe = document.createElement("a");
    subscribe.className = "opt-flip__cta-btn opt-flip__cta-btn--ghost";
    subscribe.href = "/abonnement";
    subscribe.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:0.55rem 1.1rem;border-radius:999px;background:transparent;color:${onBg};border:1px solid ${ghostBorder};font-size:0.88rem;font-weight:750;text-decoration:none`;
    subscribe.textContent = "S’abonner";
    actions.append(subscribe);
  }
  inner.append(eyebrow, title, text, actions);
  el.append(inner);
  return el;
}

export { DEFAULT_CTA_THEME };

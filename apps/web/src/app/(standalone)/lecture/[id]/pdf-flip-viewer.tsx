"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, FileWarning } from "lucide-react";

type Props = {
  url: string;
  title: string;
  thumbsOpen?: boolean;
  /** Limite les pages PDF affichées (aperçu kiosque). */
  maxPages?: number | null;
  /** Id magazine pour les CTA de fin d’aperçu. */
  magazineId?: string | null;
  /** Couverture affichée sur la page CTA d’aperçu. */
  coverUrl?: string | null;
  /** Thème magazine pour la page CTA d’aperçu. */
  theme?: { bgColor: string; accentColor: string } | null;
  onProgress?: (pageIndex: number, pageCount: number) => void;
};

type Mode = "loading" | "flip" | "fallback";

type PdfDoc = Awaited<
  ReturnType<Awaited<typeof import("pdfjs-dist")>["getDocument"]>["promise"]
>;

const PRELOAD_RADIUS = 2;
const TARGET_PAGE_CSS_WIDTH = 720;
const THUMB_CSS_WIDTH = 72;

/** Cache PDF (Strict Mode remonte l’effet sans re-télécharger 20–30 Mo). */
const pdfBytesCache = new Map<string, Promise<Uint8Array>>();

function loadPdfBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  let pending = pdfBytesCache.get(url);
  if (!pending) {
    pending = fetch(url, { mode: "cors", credentials: "omit" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      })
      .catch((err) => {
        pdfBytesCache.delete(url);
        throw err;
      });
    pdfBytesCache.set(url, pending);
  }
  return pending.then((bytes) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    // Copie : pdf.js peut transférer le buffer au worker.
    return bytes.slice();
  });
}

async function paintPage(
  pdf: PdfDoc,
  pageNumber: number,
  host: HTMLElement,
  cssWidth: number,
  isCancelled: () => boolean,
): Promise<void> {
  if (host.dataset.hq === "1" || isCancelled()) return;

  const page = await pdf.getPage(pageNumber);
  if (isCancelled()) return;

  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const scale = (cssWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  canvas.className = "opt-flip__page-canvas";

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    background: "#ffffff",
    intent: "display",
  }).promise;
  if (isCancelled()) return;

  host.replaceChildren(canvas);
  host.dataset.hq = "1";
}

function clearPage(host: HTMLElement) {
  // Ne jamais vider la page CTA HTML (pas de canvas PDF à repeindre).
  if (host.dataset.cta === "1") return;
  host.replaceChildren();
  delete host.dataset.hq;
}

/** page-flip réécrit style.cssText et efface le fond — on le réapplique. */
function reinforceCtaPage(host: HTMLElement) {
  if (host.dataset.cta !== "1") return;
  const bg = host.dataset.bg;
  if (bg) host.style.setProperty("background", bg);
  const inner = host.querySelector<HTMLElement>(".opt-flip__cta");
  if (inner && bg) inner.style.setProperty("background", bg);
}

async function renderThumbDataUrl(
  pdf: PdfDoc,
  pageNumber: number,
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (THUMB_CSS_WIDTH / base.width) * dpr;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    background: "#ffffff",
    intent: "display",
  }).promise;

  const url = canvas.toDataURL("image/jpeg", 0.72);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

const DEFAULT_CTA_THEME = { bgColor: "#0d203d", accentColor: "#02d0d1" };

function contrastOn(hex: string): string {
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

function createPreviewCtaPage(
  magazineId: string,
  coverUrl: string | null,
  magazineTitle: string,
  theme: { bgColor: string; accentColor: string } | null,
): HTMLElement {
  const colors = {
    bgColor: theme?.bgColor || DEFAULT_CTA_THEME.bgColor,
    accentColor: theme?.accentColor || DEFAULT_CTA_THEME.accentColor,
  };
  const onAccent = contrastOn(colors.accentColor);
  const onBg = contrastOn(colors.bgColor);
  const muted = onBg === "#ffffff" ? "rgba(248,250,252,0.82)" : "rgba(6,42,43,0.72)";
  const ghostBorder =
    onBg === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(6,42,43,0.22)";

  const el = document.createElement("div");
  el.className = "opt-flip__page opt-flip__page--cta";
  el.dataset.cta = "1";
  el.dataset.hq = "1";
  el.dataset.bg = colors.bgColor;
  el.setAttribute("aria-label", "Fin de l’aperçu — s’abonner ou acheter");
  el.style.setProperty("background", colors.bgColor);

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
    `background:${colors.bgColor}`,
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
      "background:rgba(255,255,255,0.06)",
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
  eyebrow.style.cssText = `margin:0;font-size:0.72rem;font-weight:750;letter-spacing:0.1em;text-transform:uppercase;color:${colors.accentColor}`;
  eyebrow.textContent = "Fin de l’aperçu";

  const title = document.createElement("h2");
  title.className = "opt-flip__cta-title";
  title.style.cssText = `margin:0;max-width:18rem;font-size:1.35rem;font-weight:750;line-height:1.15;color:${onBg}`;
  title.textContent = "Poursuivez la lecture";

  const text = document.createElement("p");
  text.className = "opt-flip__cta-text";
  text.style.cssText = `margin:0;max-width:18rem;font-size:0.88rem;line-height:1.5;color:${muted}`;
  text.textContent =
    "Les pages suivantes sont réservées aux abonnés et aux acheteurs de ce numéro.";

  const actions = document.createElement("div");
  actions.className = "opt-flip__cta-actions";
  actions.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:center;gap:0.55rem;margin-top:0.2rem";

  const buy = document.createElement("a");
  buy.className = "opt-flip__cta-btn opt-flip__cta-btn--primary";
  buy.href = `/achat?magazine=${encodeURIComponent(magazineId)}`;
  buy.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:0.55rem 1.1rem;border-radius:999px;background:${colors.accentColor};color:${onAccent};font-size:0.88rem;font-weight:750;text-decoration:none`;
  buy.textContent = "Acheter ce numéro";

  const subscribe = document.createElement("a");
  subscribe.className = "opt-flip__cta-btn opt-flip__cta-btn--ghost";
  subscribe.href = "/abonnement";
  subscribe.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:0.55rem 1.1rem;border-radius:999px;background:transparent;color:${onBg};border:1px solid ${ghostBorder};font-size:0.88rem;font-weight:750;text-decoration:none`;
  subscribe.textContent = "S’abonner";

  actions.append(buy, subscribe);
  inner.append(eyebrow, title, text, actions);
  el.append(inner);
  return el;
}

function ThumbnailStrip({
  pageCount,
  contentPageCount,
  pageIndex,
  pdfRef,
  open,
  theme,
  onSelect,
}: {
  pageCount: number;
  contentPageCount: number;
  pageIndex: number;
  pdfRef: RefObject<PdfDoc | null>;
  open: boolean;
  theme?: { bgColor: string; accentColor: string } | null;
  onSelect: (index: number) => void;
}) {
  const ctaColors = {
    bgColor: theme?.bgColor || DEFAULT_CTA_THEME.bgColor,
    accentColor: theme?.accentColor || DEFAULT_CTA_THEME.accentColor,
  };
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const pendingRef = useRef(new Set<number>());

  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;

  useEffect(() => {
    if (!open || pageCount <= 0) return;
    const root = scrollerRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        const pdf = pdfRef.current;
        if (!pdf) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          if (el.dataset.cta === "1") continue;
          const n = Number(el.dataset.page);
          if (!n || thumbsRef.current[n] || pendingRef.current.has(n)) continue;
          pendingRef.current.add(n);
          void renderThumbDataUrl(pdf, n)
            .then((src) => {
              setThumbs((prev) =>
                prev[n] ? prev : { ...prev, [n]: src },
              );
            })
            .catch(() => undefined)
            .finally(() => {
              pendingRef.current.delete(n);
            });
        }
      },
      { root, rootMargin: "160px", threshold: 0.01 },
    );

    root.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
      io.observe(el);
    });

    return () => io.disconnect();
  }, [open, pageCount, pdfRef]);

  useEffect(() => {
    if (!open) return;
    const root = scrollerRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>(
      `[data-index="${pageIndex}"]`,
    );
    active?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [open, pageIndex]);

  if (!open || pageCount <= 0) return null;

  return (
    <aside className="opt-flip__thumbs" role="navigation" aria-label="Pages">
      <div className="opt-flip__thumbs-scroll" ref={scrollerRef}>
        {Array.from({ length: pageCount }, (_, i) => {
          const n = i + 1;
          const active = i === pageIndex;
          const isCta = i >= contentPageCount;
          const src = !isCta ? thumbs[n] : null;
          return (
            <button
              key={n}
              type="button"
              className={`opt-flip__thumb${active ? " is-active" : ""}${isCta ? " is-cta" : ""}`}
              data-index={i}
              data-page={isCta ? undefined : n}
              data-cta={isCta ? "1" : undefined}
              aria-label={
                isCta ? "Fin de l’aperçu — offres" : `Aller à la page ${n}`
              }
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(i)}
            >
              {isCta ? (
                <span
                  className="opt-flip__thumb-cta"
                  aria-hidden
                  style={{
                    background: ctaColors.bgColor,
                    color: ctaColors.accentColor,
                  }}
                >
                  CTA
                </span>
              ) : src ? (
                <img src={src} alt="" draggable={false} />
              ) : (
                <span className="opt-flip__thumb-skel" aria-hidden />
              )}
              <span className="opt-flip__thumb-num">{isCta ? "★" : n}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function PdfFlipViewer({
  url,
  title,
  thumbsOpen = false,
  maxPages = null,
  magazineId = null,
  coverUrl = null,
  theme = null,
  onProgress,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const pdfRef = useRef<PdfDoc | null>(null);
  const flipRef = useRef<InstanceType<
    typeof import("page-flip").PageFlip
  > | null>(null);
  const paintGen = useRef(0);
  const cssWidthRef = useRef(TARGET_PAGE_CSS_WIDTH);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const [mode, setMode] = useState<Mode>("loading");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [contentPageCount, setContentPageCount] = useState(0);
  const [status, setStatus] = useState("Ouverture du PDF…");

  const reportProgress = useCallback((page: number, total: number) => {
    setPageIndex(page);
    setPageCount(total);
    onProgressRef.current?.(page, total);
  }, []);

  const destroyFlip = useCallback(() => {
    paintGen.current += 1;
    try {
      flipRef.current?.destroy();
    } catch {
      /* ignore */
    }
    flipRef.current = null;
    pagesRef.current = [];
    const pdf = pdfRef.current;
    pdfRef.current = null;
    if (pdf) {
      void pdf.cleanup().catch(() => undefined);
    }
  }, []);

  const ensureWindow = useCallback(async (centerIndex: number) => {
    const pdf = pdfRef.current;
    const pages = pagesRef.current;
    if (!pdf || pages.length === 0) return;

    const gen = ++paintGen.current;
    const isCancelled = () => gen !== paintGen.current;

    const total = pages.length;
    const from = Math.max(0, centerIndex - PRELOAD_RADIUS);
    const to = Math.min(total - 1, centerIndex + PRELOAD_RADIUS + 1);
    const cssWidth = cssWidthRef.current;

    for (let i = 0; i < total; i++) {
      if (pages[i].dataset.cta === "1") continue;
      if (i < from - 1 || i > to + 1) {
        if (pages[i].dataset.hq === "1") clearPage(pages[i]);
      }
    }

    const jobs: Promise<void>[] = [];
    for (let i = from; i <= to; i++) {
      const host = pages[i];
      if (!host || host.dataset.cta === "1") continue;
      if (host.dataset.hq === "1") continue;
      // Numéro PDF = data-page (1-based), pas l’index (la CTA n’a pas de data-page).
      const pageNumber = Number(host.dataset.page);
      if (!pageNumber) continue;
      jobs.push(
        paintPage(pdf, pageNumber, host, cssWidth, isCancelled).catch((err) => {
          console.warn("[PdfFlipViewer] paint failed", pageNumber, err);
        }),
      );
    }
    await Promise.all(jobs);
  }, []);

  const goToPage = useCallback(
    (index: number) => {
      const flip = flipRef.current;
      if (!flip) return;
      const clamped = Math.max(0, Math.min(index, pageCount - 1));
      flip.turnToPage(clamped);
      reinforceCtaPage(pagesRef.current[clamped]!);
      reportProgress(clamped, pageCount);
      void ensureWindow(clamped);
    },
    [ensureWindow, pageCount, reportProgress],
  );

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();

    async function boot() {
      setMode("loading");
      setStatus("Ouverture du PDF…");
      destroyFlip();

      // Attendre le nœud DOM (Strict Mode / premier paint).
      let wrap = wrapRef.current;
      for (let i = 0; i < 10 && !wrap; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        wrap = wrapRef.current;
      }
      if (!wrap || cancelled) return;
      wrap.replaceChildren();

      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker local versionné — doit matcher pdfjs-dist du lockfile (pas une copie périmée).
        pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${encodeURIComponent(pdfjs.version)}`;

        setStatus("Téléchargement du PDF…");
        const data = await loadPdfBytes(url, abort.signal);
        if (cancelled) return;

        setStatus("Ouverture du PDF…");
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          await pdf.cleanup();
          return;
        }
        pdfRef.current = pdf;

        const first = await pdf.getPage(1);
        const base = first.getViewport({ scale: 1 });
        const ratio = base.height / base.width;
        const pageW = TARGET_PAGE_CSS_WIDTH;
        const pageH = Math.round(pageW * ratio);
        cssWidthRef.current = pageW;

        setStatus("Préparation du feuilletage…");
        const items: HTMLElement[] = [];
        const isPreview = maxPages != null && maxPages > 0;
        const limit = isPreview
          ? Math.min(pdf.numPages, maxPages)
          : pdf.numPages;
        for (let i = 1; i <= limit; i++) {
          const el = document.createElement("div");
          el.className = "opt-flip__page";
          el.dataset.page = String(i);
          el.setAttribute("aria-label", `Page ${i}`);
          items.push(el);
        }
        if (isPreview && magazineId) {
          items.push(createPreviewCtaPage(magazineId, coverUrl, title, theme));
        }
        pagesRef.current = items;
        setContentPageCount(limit);

        // Re-lire le wrap au cas où Strict Mode l’aurait remplacé.
        wrap = wrapRef.current;
        if (!wrap || cancelled) return;
        wrap.replaceChildren();

        const book = document.createElement("div");
        book.className = "opt-flip__book";
        wrap.appendChild(book);

        const pageFlipMod = await import("page-flip");
        if (cancelled) return;

        // Bundler may expose named export or `{ default: { PageFlip } }` (UMD).
        const PageFlipCtor =
          pageFlipMod.PageFlip ?? pageFlipMod.default?.PageFlip ?? null;
        if (!PageFlipCtor) {
          throw new Error("Bibliothèque page-flip indisponible");
        }

        // usePortrait + minWidth 360 → une page si largeur < ~720px, sinon double page.
        const pageFlip = new PageFlipCtor(book, {
          width: pageW,
          height: pageH,
          size: "stretch",
          minWidth: 360,
          maxWidth: 860,
          minHeight: 360,
          maxHeight: 980,
          drawShadow: true,
          flippingTime: 650,
          usePortrait: true,
          autoSize: true,
          maxShadowOpacity: 0.4,
          showCover: false,
          mobileScrollSupport: true,
          useMouseEvents: true,
          showPageCorners: true,
          startPage: 0,
        });

        pageFlip.loadFromHTML(items);
        pageFlip.on("flip", (e) => {
          const idx = typeof e.data === "number" ? e.data : 0;
          reinforceCtaPage(pagesRef.current[idx]!);
          reportProgress(idx, pageFlip.getPageCount());
          void ensureWindow(idx);
        });

        flipRef.current = pageFlip;
        reportProgress(pageFlip.getCurrentPageIndex(), pageFlip.getPageCount());
        setMode("flip");
        setStatus("");

        requestAnimationFrame(() => {
          try {
            const rect = pageFlip.getBoundsRect();
            if (rect?.pageWidth) {
              cssWidthRef.current = Math.max(Math.round(rect.pageWidth), 560);
            }
          } catch {
            /* ignore */
          }
          reinforceCtaPage(pagesRef.current[pagesRef.current.length - 1]!);
          void ensureWindow(pageFlip.getCurrentPageIndex());
        });
      } catch (err) {
        if (cancelled || abort.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Impossible de charger le PDF";
        console.error("[PdfFlipViewer]", err);
        setStatus(message);
        setMode("fallback");
      }
    }

    void boot();

    return () => {
      cancelled = true;
      abort.abort();
      paintGen.current += 1;
      destroyFlip();
    };
  }, [
    url,
    maxPages,
    magazineId,
    coverUrl,
    theme,
    title,
    destroyFlip,
    ensureWindow,
    reportProgress,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (mode !== "flip" || !flipRef.current) return;
      if (e.key === "ArrowRight") flipRef.current.flipNext();
      if (e.key === "ArrowLeft") flipRef.current.flipPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  useEffect(() => {
    if (mode !== "flip" || !wrapRef.current || !flipRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const flip = flipRef.current;
        if (!flip) return;
        try {
          flip.update();
          const rect = flip.getBoundsRect();
          if (rect?.pageWidth) {
            const next = Math.max(Math.round(rect.pageWidth), 560);
            if (Math.abs(next - cssWidthRef.current) > 40) {
              cssWidthRef.current = next;
              for (const el of pagesRef.current) clearPage(el);
              void ensureWindow(flip.getCurrentPageIndex());
            }
          }
        } catch {
          /* ignore */
        }
      }, 120);
    });
    ro.observe(wrapRef.current);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, [mode, ensureWindow]);

  if (mode === "fallback") {
    return (
      <div className="opt-flip opt-flip--fallback">
        <iframe
          src={`${url}#view=FitH`}
          className="opt-lecture__frame"
          title={title}
          allow="fullscreen"
          allowFullScreen
        />
        <p className="opt-flip__fallback-note">
          <FileWarning size={14} strokeWidth={2.25} aria-hidden />
          Mode PDF classique (flip indisponible sur cet appareil / réseau).
        </p>
      </div>
    );
  }

  return (
    <div className={`opt-flip${thumbsOpen ? " has-thumbs" : ""}`}>
      {mode === "loading" ? (
        <div className="opt-flip__loading" aria-live="polite">
          <span className="opt-lecture__spinner" aria-hidden />
          <p>{status || "Préparation du feuilletage…"}</p>
        </div>
      ) : null}

      {mode === "flip" ? (
        <ThumbnailStrip
          pageCount={pageCount}
          contentPageCount={contentPageCount || pageCount}
          pageIndex={pageIndex}
          pdfRef={pdfRef}
          open={thumbsOpen}
          theme={theme}
          onSelect={goToPage}
        />
      ) : null}

      <div className="opt-flip__main">
        <div
          className={`opt-flip__book-wrap${mode === "flip" ? " is-ready" : ""}`}
          ref={wrapRef}
        />

        {mode === "flip" ? (
          <div className="opt-flip__controls">
            <button
              type="button"
              className="opt-flip__nav"
              aria-label="Page précédente"
              disabled={pageIndex <= 0}
              onClick={() => flipRef.current?.flipPrev()}
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
            </button>
            <span className="opt-flip__pager">
              {pageIndex >= contentPageCount && contentPageCount > 0
                ? "Offre"
                : `${pageIndex + 1} / ${contentPageCount || pageCount}`}
            </span>
            <button
              type="button"
              className="opt-flip__nav"
              aria-label="Page suivante"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => flipRef.current?.flipNext()}
            >
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

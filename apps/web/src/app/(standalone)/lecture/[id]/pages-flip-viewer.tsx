"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning } from "lucide-react";
import {
  createPreviewCtaPage,
  DEFAULT_CTA_THEME,
  reinforceCtaPage,
} from "./flip-preview-cta";

export type MagazinePageAsset = {
  pageNumber: number;
  url: string;
  thumbUrl: string | null;
  width: number;
  height: number;
};

type Props = {
  pages: MagazinePageAsset[];
  title: string;
  thumbsOpen?: boolean;
  magazineId?: string | null;
  coverUrl?: string | null;
  theme?: { bgColor: string; accentColor: string } | null;
  onProgress?: (pageIndex: number, pageCount: number) => void;
};

const PRELOAD_RADIUS = 2;
const TARGET_PAGE_CSS_WIDTH = 720;
/** Prefetch réseau hors fenêtre peinte (évite le blanc à l’arrivée). */
const PREFETCH_EXTRA = 1;
/** Au boot : peindre uniquement les 2 premières pages, le reste en lazy. */
const INITIAL_LAZY_PAGES = 2;

function paintImagePage(
  host: HTMLElement,
  url: string,
  alt: string,
): Promise<void> {
  if (host.dataset.hq === "1") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.className = "opt-flip__page-canvas";
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", alt);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        reject(new Error("Canvas 2D indisponible"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      host.replaceChildren(canvas);
      host.dataset.hq = "1";
      host.classList.remove("is-skeleton");
      resolve();
    };
    img.onerror = () => reject(new Error("Image page impossible à charger"));
    img.src = url;
  });
}

function preloadUrl(url: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

function ImageThumbnailStrip({
  pages,
  pageCount,
  contentPageCount,
  pageIndex,
  open,
  theme,
  onSelect,
}: {
  pages: MagazinePageAsset[];
  pageCount: number;
  contentPageCount: number;
  pageIndex: number;
  open: boolean;
  theme?: { bgColor: string; accentColor: string } | null;
  onSelect: (index: number) => void;
}) {
  const ctaColors = {
    bgColor: theme?.bgColor || DEFAULT_CTA_THEME.bgColor,
    accentColor: theme?.accentColor || DEFAULT_CTA_THEME.accentColor,
  };
  const scrollerRef = useRef<HTMLDivElement>(null);

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
          const src = !isCta
            ? pages[i]?.thumbUrl || pages[i]?.url || null
            : null;
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
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  loading={
                    i < INITIAL_LAZY_PAGES || Math.abs(i - pageIndex) <= 1
                      ? "eager"
                      : "lazy"
                  }
                  decoding="async"
                />
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

export function PagesFlipViewer({
  pages,
  title,
  thumbsOpen = false,
  magazineId = null,
  coverUrl = null,
  theme = null,
  onProgress,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const pagesAssetsRef = useRef(pages);
  pagesAssetsRef.current = pages;
  const flipRef = useRef<InstanceType<
    typeof import("page-flip").PageFlip
  > | null>(null);
  const paintGen = useRef(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  /** Stable tant que le jeu de pages (numéros / dimensions) ne change pas — ignore le renouvellement d’URLs signées. */
  const pagesBootKey = pages
    .map((p) => `${p.pageNumber}:${p.width}x${p.height}`)
    .join("|");

  const [mode, setMode] = useState<"loading" | "flip" | "fallback">("loading");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [contentPageCount, setContentPageCount] = useState(0);
  const [status, setStatus] = useState("Préparation du feuilletage…");
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const paintIndices = useCallback(
    async (indices: number[]) => {
      const hosts = pagesRef.current;
      const gen = paintGen.current;
      for (const i of indices) {
        if (gen !== paintGen.current) return;
        if (i < 0 || i >= contentPageCount) continue;
        const asset = pagesAssetsRef.current[i];
        const host = hosts[i];
        if (!asset || !host || host.dataset.cta === "1") continue;
        await paintImagePage(
          host,
          asset.url,
          `${title} — page ${asset.pageNumber}`,
        ).catch(() => undefined);
      }
    },
    [contentPageCount, title],
  );

  const ensureWindow = useCallback(
    async (centerIndex: number) => {
      const hosts = pagesRef.current;
      if (hosts.length === 0 || contentPageCount <= 0) return;
      const gen = paintGen.current;
      const start = Math.max(0, centerIndex - PRELOAD_RADIUS);
      const end = Math.min(contentPageCount - 1, centerIndex + PRELOAD_RADIUS);

      // Prefetch réseau avant/après la fenêtre (précédente + suivantes).
      for (
        let i = Math.max(0, start - PREFETCH_EXTRA);
        i <= Math.min(contentPageCount - 1, end + PREFETCH_EXTRA);
        i++
      ) {
        const asset = pagesAssetsRef.current[i];
        if (asset?.url) preloadUrl(asset.url);
      }

      for (let i = 0; i < contentPageCount; i++) {
        if (i < start || i > end) {
          const host = hosts[i];
          if (host && host.dataset.cta !== "1" && host.dataset.hq === "1") {
            host.replaceChildren();
            delete host.dataset.hq;
            host.classList.add("is-skeleton");
          }
        }
      }

      // Priorité : page courante, puis précédente, puis suivante, puis le reste.
      const order: number[] = [];
      const pushUnique = (i: number) => {
        if (i < start || i > end) return;
        if (!order.includes(i)) order.push(i);
      };
      pushUnique(centerIndex);
      pushUnique(centerIndex - 1);
      pushUnique(centerIndex + 1);
      for (let i = start; i <= end; i++) pushUnique(i);

      await paintIndices(order);
      if (gen !== paintGen.current) return;
    },
    [contentPageCount, paintIndices],
  );

  const goToPage = useCallback(
    async (index: number) => {
      const flip = flipRef.current;
      if (!flip) return;
      const total = flip.getPageCount();
      const clamped = Math.max(0, Math.min(index, total - 1));
      // Peindre la destination (et voisins) avant le saut.
      await ensureWindow(clamped);
      flip.turnToPage(clamped);
      reinforceCtaPage(pagesRef.current[clamped]!);
      reportProgress(clamped, total);
      void ensureWindow(clamped);
    },
    [ensureWindow, reportProgress],
  );

  const flipPrev = useCallback(async () => {
    const flip = flipRef.current;
    if (!flip) return;
    const target = Math.max(0, flip.getCurrentPageIndex() - 1);
    await ensureWindow(target);
    flip.flipPrev();
  }, [ensureWindow]);

  const flipNext = useCallback(async () => {
    const flip = flipRef.current;
    if (!flip) return;
    const target = Math.min(
      flip.getPageCount() - 1,
      flip.getCurrentPageIndex() + 1,
    );
    await ensureWindow(target);
    flip.flipNext();
  }, [ensureWindow]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setMode("loading");
      setStatus("Préparation du feuilletage…");
      setError(null);
      destroyFlip();

      let wrap = wrapRef.current;
      for (let i = 0; i < 10 && !wrap; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        wrap = wrapRef.current;
      }
      if (!wrap || cancelled) return;
      wrap.replaceChildren();

      try {
        if (!pagesAssetsRef.current.length) {
          throw new Error("Aucune page image disponible");
        }

        const bootPages = pagesAssetsRef.current;
        const first = bootPages[0]!;
        const ratio = first.height / Math.max(1, first.width);
        const pageW = TARGET_PAGE_CSS_WIDTH;
        const pageH = Math.round(pageW * ratio);

        const items: HTMLElement[] = [];
        for (const asset of bootPages) {
          const el = document.createElement("div");
          el.className = "opt-flip__page is-skeleton";
          el.dataset.page = String(asset.pageNumber);
          el.setAttribute("aria-label", `Page ${asset.pageNumber}`);
          items.push(el);
        }

        const isPreview = Boolean(magazineId);
        if (isPreview && magazineId) {
          items.push(
            createPreviewCtaPage(magazineId, coverUrl, title, theme),
          );
        }

        const contentCount = bootPages.length;
        setContentPageCount(contentCount);
        pagesRef.current = items;

        wrap = wrapRef.current;
        if (!wrap || cancelled) return;
        wrap.replaceChildren();

        const book = document.createElement("div");
        book.className = "opt-flip__book";
        wrap.appendChild(book);

        const pageFlipMod = await import("page-flip");
        if (cancelled) return;

        const PageFlipCtor =
          pageFlipMod.PageFlip ?? pageFlipMod.default?.PageFlip ?? null;
        if (!PageFlipCtor) {
          throw new Error("Bibliothèque page-flip indisponible");
        }

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
        // Dès que l’utilisateur commence à tourner : peindre prev/next.
        pageFlip.on("changeState", (e) => {
          const state = String(e.data ?? "");
          if (state === "user_fold" || state === "flipping") {
            const idx = pageFlip.getCurrentPageIndex();
            void ensureWindow(idx);
            void ensureWindow(idx + 1);
            void ensureWindow(idx - 1);
          }
          const last = pagesRef.current[pagesRef.current.length - 1];
          if (last) reinforceCtaPage(last);
        });

        flipRef.current = pageFlip;
        reportProgress(pageFlip.getCurrentPageIndex(), pageFlip.getPageCount());
        setMode("flip");
        setStatus("");

        requestAnimationFrame(() => {
          reinforceCtaPage(pagesRef.current[pagesRef.current.length - 1]!);
          // Lazy : uniquement les 2 premières pages au démarrage.
          const initial = Array.from(
            { length: Math.min(INITIAL_LAZY_PAGES, contentCount) },
            (_, i) => i,
          );
          void paintIndices(initial).then(() => {
            // Prefetch léger de la suite quand le navigateur est idle.
            const idle =
              typeof window !== "undefined" && "requestIdleCallback" in window
                ? window.requestIdleCallback.bind(window)
                : (cb: () => void) => window.setTimeout(cb, 400);
            idle(() => {
              void ensureWindow(Math.min(1, contentCount - 1));
            });
          });
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Impossible d’ouvrir les pages";
        console.error("[PagesFlipViewer]", err);
        setError(message);
        setMode("fallback");
        setStatus("");
      }
    }

    void boot();
    return () => {
      cancelled = true;
      destroyFlip();
    };
  }, [
    pagesBootKey,
    title,
    magazineId,
    coverUrl,
    theme,
    destroyFlip,
    ensureWindow,
    paintIndices,
    reportProgress,
  ]);

  if (mode === "fallback") {
    return (
      <div
        className="opt-flip opt-flip--fallback"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="opt-flip__loading" style={{ position: "relative" }}>
          <FileWarning size={28} strokeWidth={1.75} aria-hidden />
          <p>Impossible d’afficher le feuilletage image.</p>
          {error ? <p className="opt-flip__error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`opt-flip${thumbsOpen ? " has-thumbs" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {mode === "loading" ? (
        <div className="opt-flip__loading" aria-live="polite">
          <span className="opt-lecture__spinner" aria-hidden />
          <p>{status || "Préparation du feuilletage…"}</p>
        </div>
      ) : null}

      {mode === "flip" ? (
        <ImageThumbnailStrip
          pages={pages}
          pageCount={pageCount}
          contentPageCount={contentPageCount || pageCount}
          pageIndex={pageIndex}
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
              onClick={() => void flipPrev()}
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
              onClick={() => void flipNext()}
            >
              <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

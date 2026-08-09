"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronLeft, ChevronRight, FileWarning } from "lucide-react";
import {
  createPreviewCtaPage,
  DEFAULT_CTA_THEME,
  reinforceCtaPage,
} from "./flip-preview-cta";

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

/** CDN cross-origin → chemins same-origin (nginx /cdn-media ou /api/media-proxy). */
const PDF_PROXY_HOSTS = new Set(["cdn.opt1mum.com", "cdn.egouv.online"]);

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function pdfFetchCandidates(url: string): string[] {
  try {
    const absolute = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (
      typeof window !== "undefined" &&
      absolute.origin === window.location.origin
    ) {
      return [url];
    }
    if (
      absolute.protocol === "https:" &&
      PDF_PROXY_HOSTS.has(absolute.hostname)
    ) {
      const path = `${absolute.pathname}${absolute.search}`;
      const proxy = `/api/media-proxy?u=${encodeURIComponent(absolute.toString())}`;
      // Local : CDN direct d’abord (évite /cdn-media 404 + proxy Next lent sur 50+ Mo).
      if (isLocalDevHost()) {
        return [absolute.toString(), proxy];
      }
      return [
        `/cdn-media${path}`,
        proxy,
        absolute.toString(),
      ];
    }
  } catch {
    /* keep original */
  }
  return [url];
}

function isPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** Extraire un PDF encapsulé dans un dump multipart (imports legacy). */
function unwrapPdfBytes(bytes: Uint8Array): Uint8Array {
  if (isPdfMagic(bytes)) return bytes;
  const pdfMarker = [0x25, 0x50, 0x44, 0x46]; // %PDF
  let start = -1;
  for (let i = 0; i < Math.min(bytes.length - 4, 4096); i++) {
    if (
      bytes[i] === pdfMarker[0] &&
      bytes[i + 1] === pdfMarker[1] &&
      bytes[i + 2] === pdfMarker[2] &&
      bytes[i + 3] === pdfMarker[3]
    ) {
      start = i;
      break;
    }
  }
  if (start < 0) return bytes;

  // Cherche le dernier %%EOF
  const eof = [0x25, 0x25, 0x45, 0x4f, 0x46]; // %%EOF
  let end = -1;
  for (let i = bytes.length - 5; i >= start; i--) {
    if (
      bytes[i] === eof[0] &&
      bytes[i + 1] === eof[1] &&
      bytes[i + 2] === eof[2] &&
      bytes[i + 3] === eof[3] &&
      bytes[i + 4] === eof[4]
    ) {
      end = i + 5;
      break;
    }
  }
  return bytes.subarray(start, end > start ? end : undefined);
}

async function fetchPdfOnce(
  fetchUrl: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Uint8Array> {
  const res = await fetch(fetchUrl, {
    mode: "cors",
    credentials: "omit",
    signal,
  });
  if (!res.ok) throw new Error(`PDF HTTP ${res.status} (${fetchUrl})`);

  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  const body = res.body;
  if (!body || !onProgress) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    onProgress?.(bytes.byteLength, total ?? bytes.byteLength);
    if (bytes.byteLength < 64) {
      throw new Error("PDF trop petit / réponse tronquée");
    }
    const unwrapped = unwrapPdfBytes(bytes);
    if (!isPdfMagic(unwrapped)) {
      throw new Error(
        "Fichier PDF invalide ou corrompu sur le CDN (réponse HTML / multipart)",
      );
    }
    return unwrapped;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, Number.isFinite(total) ? total : null);
    }
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.byteLength < 64) {
    throw new Error("PDF trop petit / réponse tronquée");
  }
  const unwrapped = unwrapPdfBytes(bytes);
  if (!isPdfMagic(unwrapped)) {
    throw new Error(
      "Fichier PDF invalide ou corrompu sur le CDN (réponse HTML / multipart)",
    );
  }
  return unwrapped;
}

function loadPdfBytes(
  url: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Uint8Array> {
  const cacheKey = url;
  let pending = pdfBytesCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const candidates = pdfFetchCandidates(url);
      let lastErr: unknown;
      for (const candidate of candidates) {
        try {
          return await fetchPdfOnce(candidate, signal, onProgress);
        } catch (err) {
          if (signal?.aborted) throw err;
          lastErr = err;
          console.warn(
            "[PdfFlipViewer] fetch PDF échoué, essai suivant",
            candidate,
            err,
          );
        }
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error("Impossible de télécharger le PDF");
    })().catch((err) => {
      pdfBytesCache.delete(cacheKey);
      throw err;
    });
    pdfBytesCache.set(cacheKey, pending);
  }
  return pending.then((bytes) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onProgress?.(bytes.byteLength, bytes.byteLength);
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
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

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
      setDownloadPct(null);
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
        // Worker servi depuis /public, synchronisé via `pnpm sync:pdf-worker` (même version que pdfjs-dist).
        pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${encodeURIComponent(pdfjs.version)}`;

        setStatus("Téléchargement du PDF…");
        const data = await loadPdfBytes(url, abort.signal, (loaded, total) => {
          if (cancelled) return;
          if (total && total > 0) {
            const pct = Math.min(100, Math.round((loaded / total) * 100));
            setDownloadPct(pct);
            const mb = (loaded / (1024 * 1024)).toFixed(1);
            const tot = (total / (1024 * 1024)).toFixed(1);
            setStatus(`Téléchargement du PDF… ${mb} / ${tot} Mo`);
          } else {
            const mb = (loaded / (1024 * 1024)).toFixed(1);
            setStatus(`Téléchargement du PDF… ${mb} Mo`);
          }
        });
        if (cancelled) return;
        setDownloadPct(100);

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
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Impossible de charger le PDF";
        console.error("[PdfFlipViewer]", err);
        setStatus(message);
        setMode("fallback");
      }
    }

    void boot().catch((err) => {
      if (cancelled || abort.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[PdfFlipViewer]", err);
    });

    return () => {
      cancelled = true;
      try {
        abort.abort();
      } catch {
        /* ignore */
      }
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
      <div
        className="opt-flip opt-flip--fallback"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <iframe
          src={`${url}#view=FitH`}
          className="opt-lecture__frame"
          title={title}
          allow="fullscreen"
          allowFullScreen
        />
        <p className="opt-flip__fallback-note">
          <FileWarning size={14} strokeWidth={2.25} aria-hidden />
          Mode PDF classique
          {status ? ` — ${status}` : " (flip indisponible sur cet appareil / réseau)"}.
        </p>
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
          {downloadPct != null ? (
            <div className="opt-flip__bar" aria-hidden>
              <span style={{ width: `${downloadPct}%` }} />
            </div>
          ) : null}
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

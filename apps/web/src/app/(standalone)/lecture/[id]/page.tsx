"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  magazinesPublicApi,
  type MagazineReadSession,
} from "@/lib/api";
import { PdfFlipViewer } from "./pdf-flip-viewer";
import { PagesFlipViewer } from "./pages-flip-viewer";
import "./lecture.css";

function LectureContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<MagazineReadSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [progress, setProgress] = useState({ page: 0, total: 0 });

  useEffect(() => {
    if (isPreview || authLoading) return;
    if (!user && id) {
      router.replace(
        `/connexion?next=${encodeURIComponent(`/lecture/${id}`)}`,
      );
    }
  }, [authLoading, user, router, id, isPreview]);

  useEffect(() => {
    if (!id) return;
    if (!isPreview && (authLoading || !user)) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = isPreview
      ? magazinesPublicApi.preview(id)
      : magazinesPublicApi.read(id);

    load
      .then((res) => {
        if (!cancelled) setSession(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible d’ouvrir ce magazine",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, id, isPreview, authLoading]);

  // Poll discret :
  // - PDF : bascule vers WebP dès que des pages existent
  // - pages en PROCESSING : récupère les nouvelles pages uploadées
  useEffect(() => {
    if (!id || !session?.canRead) return;
    if (session.pagesStatus === "FAILED" && session.viewer !== "pages") return;
    if (session.viewer === "pages" && session.pagesStatus === "READY") return;
    if (!isPreview && (authLoading || !user)) return;

    const onPages = session.viewer === "pages";
    let cancelled = false;

    const tick = () => {
      const load = isPreview
        ? magazinesPublicApi.preview(id, { refresh: true })
        : magazinesPublicApi.read(id, { refresh: true });
      void load
        .then((res) => {
          if (cancelled) return;
          const hasPages =
            res.viewer === "pages" &&
            Array.isArray(res.pages) &&
            res.pages.length > 0;

          if (!onPages) {
            if (hasPages) setSession(res);
            return;
          }

          if (hasPages) {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    pages: res.pages,
                    pagesUrlExpiresAt: res.pagesUrlExpiresAt ?? null,
                    pagesStatus: res.pagesStatus,
                  }
                : res,
            );
          }
        })
        .catch(() => undefined);
    };

    const intervalMs = onPages ? 30_000 : 10_000;
    const interval = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    id,
    isPreview,
    authLoading,
    user,
    session?.canRead,
    session?.viewer,
    session?.pagesStatus,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
      // Empêche Enregistrer / téléchargement clavier pendant la lecture.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const waitingAuth = !isPreview && (authLoading || !user);

  if (waitingAuth || loading) {
    return (
      <section className="opt-lecture opt-lecture--loading" aria-busy="true">
        <div className="opt-lecture__loader">
          <span className="opt-lecture__spinner" aria-hidden />
          <p>{isPreview ? "Ouverture de l’aperçu…" : "Ouverture du magazine…"}</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="opt-lecture">
        <header className="opt-lecture__bar">
          <Link
            href="/kiosque"
            className="opt-lecture__back"
            aria-label="Retour au kiosque"
            title="Kiosque"
          >
            <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          </Link>
        </header>
        <div className="opt-lecture__state">
          <h1>Lecture indisponible</h1>
          <p>{error}</p>
          <Link href="/kiosque" className="opt-lecture__btn">
            Retour au kiosque
          </Link>
        </div>
      </section>
    );
  }

  if (!session) return null;

  const hasPages =
    session.viewer === "pages" &&
    Array.isArray(session.pages) &&
    session.pages.length > 0;
  const canOpen = session.canRead && (hasPages || Boolean(session.readerUrl));

  if (!canOpen) {
    return (
      <section className="opt-lecture">
        <header className="opt-lecture__bar">
          <Link
            href="/kiosque"
            className="opt-lecture__back"
            aria-label="Retour au kiosque"
            title="Kiosque"
          >
            <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
          </Link>
          <div className="opt-lecture__titleblock">
            <h1 className="opt-lecture__heading">{session.title}</h1>
            {session.issueNumber ? (
              <span className="opt-lecture__issue">N° {session.issueNumber}</span>
            ) : null}
          </div>
        </header>
        <div className="opt-lecture__state">
          <div className="opt-lecture__lock" aria-hidden>
            <Lock size={28} strokeWidth={1.75} />
          </div>
          <h1>Accès restreint</h1>
          <p>
            {session.message ||
              "Un abonnement actif ou l’achat de ce numéro est requis."}
          </p>
          <div className="opt-lecture__actions">
            {id ? (
              <Link
                href={`/achat?magazine=${encodeURIComponent(id)}`}
                className="opt-lecture__btn"
              >
                Acheter ce numéro
              </Link>
            ) : null}
            <Link
              href="/abonnement"
              className={`opt-lecture__btn${id ? " opt-lecture__btn--ghost" : ""}`}
            >
              Voir les formules
            </Link>
            <Link
              href={id ? `/lecture/${id}?preview=1` : "/kiosque"}
              className="opt-lecture__btn opt-lecture__btn--ghost"
            >
              Aperçu gratuit
            </Link>
            <Link href="/kiosque" className="opt-lecture__btn opt-lecture__btn--ghost">
              Aller au kiosque
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const previewMode = Boolean(session.preview || isPreview);
  const maxPages = session.maxPages ?? (previewMode ? 15 : null);
  const backHref = `/kiosque?magazine=${encodeURIComponent(session.id)}`;

  return (
    <section
      className={`opt-lecture${fullscreen ? " is-fullscreen" : ""}${thumbsOpen ? " has-thumbs" : ""}${previewMode ? " is-preview" : ""}`}
      aria-label={`${previewMode ? "Aperçu" : "Lecture"} — ${session.title}`}
    >
      <header className="opt-lecture__bar">
        <Link
          href={backHref}
          className="opt-lecture__back"
          aria-label="Retour au kiosque"
          title="Kiosque"
        >
          <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
        </Link>

        <div className="opt-lecture__titleblock">
          <p className="opt-lecture__kicker">
            {previewMode ? "Aperçu" : "En lecture"}
          </p>
          <div className="opt-lecture__title-row">
            <h1 className="opt-lecture__heading">{session.title}</h1>
            {session.issueNumber ? (
              <span className="opt-lecture__issue">N° {session.issueNumber}</span>
            ) : null}
          </div>
        </div>

        <Link href="/" className="opt-lecture__brand" aria-label="STUDRC — Accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/studrc-logo.png" alt="STUDRC" />
        </Link>

        <div className="opt-lecture__tools">
          {progress.total > 0 ? (
            <span className="opt-lecture__pagechip" aria-live="polite">
              {progress.page + 1}
              <span aria-hidden> / </span>
              {progress.total}
            </span>
          ) : null}
          <button
            type="button"
            className={`opt-lecture__tool${thumbsOpen ? " is-active" : ""}`}
            aria-label={
              thumbsOpen ? "Masquer les vignettes" : "Afficher les vignettes"
            }
            aria-pressed={thumbsOpen}
            title="Vignettes"
            onClick={() => setThumbsOpen((v) => !v)}
          >
            <Menu size={16} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            className="opt-lecture__tool"
            aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? (
              <Minimize2 size={16} strokeWidth={2.25} aria-hidden />
            ) : (
              <Maximize2 size={16} strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>
      </header>

      <div className="opt-lecture__stage">
        {fullscreen ? (
          <div className="opt-lecture__fs-tools">
            <button
              type="button"
              className={`opt-lecture__fs-exit${thumbsOpen ? " is-active" : ""}`}
              aria-label={
                thumbsOpen ? "Masquer les vignettes" : "Afficher les vignettes"
              }
              aria-pressed={thumbsOpen}
              title="Vignettes"
              onClick={() => setThumbsOpen((v) => !v)}
            >
              <Menu size={16} strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              className="opt-lecture__fs-exit"
              aria-label="Quitter le plein écran"
              title="Quitter le plein écran (Échap)"
              onClick={() => setFullscreen(false)}
            >
              <Minimize2 size={16} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ) : null}
        {hasPages ? (
          <PagesFlipViewer
            pages={session.pages!}
            title={session.title}
            thumbsOpen={thumbsOpen}
            magazineId={previewMode ? session.id : null}
            coverUrl={previewMode ? session.coverUrl : null}
            theme={previewMode ? session.theme ?? null : null}
            onProgress={(page, total) => setProgress({ page, total })}
          />
        ) : (
          <PdfFlipViewer
            url={session.readerUrl!}
            title={session.title}
            thumbsOpen={thumbsOpen}
            maxPages={maxPages}
            magazineId={previewMode ? session.id : null}
            coverUrl={previewMode ? session.coverUrl : null}
            theme={previewMode ? session.theme ?? null : null}
            onProgress={(page, total) => setProgress({ page, total })}
          />
        )}
      </div>
    </section>
  );
}

export default function LecturePage() {
  return (
    <Suspense
      fallback={
        <section className="opt-lecture opt-lecture--loading" aria-busy="true">
          <div className="opt-lecture__loader">
            <span className="opt-lecture__spinner" aria-hidden />
            <p>Ouverture du magazine…</p>
          </div>
        </section>
      }
    >
      <LectureContent />
    </Suspense>
  );
}

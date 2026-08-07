"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { DEMO_MAGAZINES } from "@/lib/legacy-demo";
import { CoverImage } from "@/components/site/cover-image";
import "./home-kiosque.css";

const GAP = 20;
const FALLBACK_COVER = "/legacy/covers/1591457791.jpg";

export type HomeKiosqueItem = {
  id: string | number;
  titre: string;
  cover: string;
  dateLabel: string;
};

function usePerView() {
  const [perView, setPerView] = useState(4);

  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      if (w < 576) setPerView(2);
      else if (w < 992) setPerView(3);
      else setPerView(6);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return perView;
}

const DEMO_ITEMS: HomeKiosqueItem[] = DEMO_MAGAZINES.map((m) => ({
  id: m.id,
  titre: m.titre,
  cover: m.cover,
  dateLabel: m.dateLabel,
}));

/** Section kiosque — carousel slide des numéros. */
export function HomeKiosque({
  magazines,
}: {
  magazines?: HomeKiosqueItem[];
} = {}) {
  const items =
    magazines && magazines.length > 0 ? magazines : DEMO_ITEMS;
  const perView = usePerView();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [itemW, setItemW] = useState(0);

  const maxIndex = Math.max(0, items.length - perView);

  useEffect(() => {
    setIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      setItemW((w - GAP * (perView - 1)) / perView);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [perView]);

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => Math.min(maxIndex, Math.max(0, i + dir)));
    },
    [maxIndex],
  );

  const offset = itemW > 0 ? -(index * (itemW + GAP)) : 0;
  const canPrev = index > 0;
  const canNext = index < maxIndex;

  return (
    <section className="opt-kiosque" aria-labelledby="opt-kiosque-title">
      <div className="opt-kiosque__inner">
        <header className="opt-kiosque__head">
          <div className="opt-kiosque__head-text">
            <h2 id="opt-kiosque-title" className="opt-kiosque__title">
              <Link href="/kiosque" className="opt-kiosque__logo-link">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/legacy/img/kios.png"
                  alt="Kiosque"
                  className="opt-kiosque__logo"
                />
              </Link>
            </h2>
            <p className="opt-kiosque__lead">
              Feuilletez les derniers numéros Opt1mum — lecture sur smartphone,
              tablette et ordinateur.
            </p>
          </div>
          <div className="opt-kiosque__head-actions">
            <div className="opt-kiosque__nav" role="group" aria-label="Parcourir le kiosque">
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Précédent"
                disabled={!canPrev}
                onClick={() => go(-1)}
              >
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Suivant"
                disabled={!canNext}
                onClick={() => go(1)}
              >
                <ChevronRight size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <Link href="/kiosque" className="opt-kiosque__all">
              Tout le kiosque
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </header>

        <div className="opt-kiosque__slider" ref={viewportRef}>
          <ul
            className="opt-kiosque__track"
            style={{
              gap: GAP,
              transform: itemW > 0 ? `translate3d(${offset}px, 0, 0)` : undefined,
            }}
          >
            {items.map((mag, i) => (
              <li
                key={mag.id}
                className="opt-kiosque__item"
                style={
                  itemW > 0
                    ? { width: itemW, minWidth: itemW, maxWidth: itemW }
                    : undefined
                }
              >
                <Link
                  href={`/kiosque?magazine=${encodeURIComponent(String(mag.id))}`}
                  className="opt-kiosque__card"
                >
                  <div className="opt-kiosque__cover-wrap">
                    <span className="opt-kiosque__rank" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <CoverImage
                      src={mag.cover || FALLBACK_COVER}
                      className="opt-kiosque__cover"
                    />
                  </div>
                  <div className="opt-kiosque__meta">
                    <div className="opt-kiosque__meta-top">
                      <h3 className="opt-kiosque__name">{mag.titre}</h3>
                      <span className="opt-kiosque__date">{mag.dateLabel}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="opt-kiosque__cta">
          <Link href="/kiosque" className="opt-kiosque__btn opt-kiosque__btn--dark">
            Voir tous les numéros
          </Link>
          <Link
            href="/abonnement"
            className="opt-kiosque__btn opt-kiosque__btn--teal"
          >
            S&apos;abonner
          </Link>
        </div>
      </div>
    </section>
  );
}

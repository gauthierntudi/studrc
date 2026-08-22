"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { DEMO_MAGAZINES } from "@/lib/legacy-demo";
import { CoverImage } from "@/components/site/cover-image";

import "swiper/css";
import "swiper/css/free-mode";
import "./home-kiosque.css";

const FALLBACK_COVER = "/legacy/covers/1591457791.jpg";

export type HomeKiosqueItem = {
  id: string | number;
  titre: string;
  cover: string;
  dateLabel: string;
};

const DEMO_ITEMS: HomeKiosqueItem[] = DEMO_MAGAZINES.map((m) => ({
  id: m.id,
  titre: m.titre,
  cover: m.cover,
  dateLabel: m.dateLabel,
}));

/** Section kiosque — carousel Swiper des numéros. */
export function HomeKiosque({
  magazines,
}: {
  magazines?: HomeKiosqueItem[];
} = {}) {
  const items =
    magazines && magazines.length > 0 ? magazines : DEMO_ITEMS;
  const swiperRef = useRef<SwiperType | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 1);

  const syncNav = (swiper: SwiperType) => {
    setCanPrev(!swiper.isBeginning);
    setCanNext(!swiper.isEnd);
  };

  return (
    <section className="opt-kiosque" aria-labelledby="opt-kiosque-title">
      <div className="opt-kiosque__inner">
        <header className="opt-kiosque__head">
          <div className="opt-kiosque__head-text">
            <h2 id="opt-kiosque-title" className="opt-kiosque__title">
              <Link href="/kiosque" className="opt-kiosque__logo-link">
                STU MAG
              </Link>
            </h2>
            <p className="opt-kiosque__lead">
              Feuilletez STU MAG, le magazine numérique bimestriel — analyses
              approfondies sur smartphone, tablette et ordinateur.
            </p>
          </div>
          <div className="opt-kiosque__head-actions">
            <div
              className="opt-kiosque__nav"
              role="group"
              aria-label="Parcourir le kiosque"
            >
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Précédent"
                disabled={!canPrev}
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <ChevronLeft size={20} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="opt-kiosque__nav-btn"
                aria-label="Suivant"
                disabled={!canNext}
                onClick={() => swiperRef.current?.slideNext()}
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

        <div className="opt-kiosque__slider">
          <Swiper
            className="opt-kiosque__swiper"
            modules={[FreeMode, A11y]}
            slidesPerView={2}
            spaceBetween={16}
            grabCursor
            freeMode={{
              enabled: true,
              sticky: true,
              momentumRatio: 0.65,
              momentumVelocityRatio: 0.75,
            }}
            speed={480}
            watchOverflow
            breakpoints={{
              576: {
                slidesPerView: 3,
                spaceBetween: 18,
              },
              992: {
                slidesPerView: 6,
                spaceBetween: 20,
              },
            }}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
              syncNav(swiper);
            }}
            onSlideChange={syncNav}
            onReachBeginning={syncNav}
            onReachEnd={syncNav}
            onFromEdge={syncNav}
            onResize={syncNav}
          >
            {items.map((mag, i) => (
              <SwiperSlide key={mag.id} className="opt-kiosque__item">
                <Link
                  href={`/kiosque?magazine=${encodeURIComponent(String(mag.id))}`}
                  className="opt-kiosque__card"
                  draggable={false}
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
              </SwiperSlide>
            ))}
          </Swiper>
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

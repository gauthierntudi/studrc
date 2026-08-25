"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, A11y } from "swiper/modules";
import type { PublicArticleCard } from "@/lib/api";
import { CoverImage } from "@/components/site/cover-image";
import { VideoPlay } from "@/components/site/video-play";
import { isVideoRubrique } from "@/lib/rubriques";

import "swiper/css";
import "swiper/css/pagination";

function articleHref(slug: string) {
  return `/article/${encodeURIComponent(slug)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type Props = {
  items: PublicArticleCard[];
  video?: boolean;
};

export function RubriqueHeroCarousel({ items, video }: Props) {
  if (items.length === 0) return null;

  const showPagination = items.length > 4;

  return (
    <section
      className="opt-rubrique__hero"
      aria-label="À la une de la rubrique"
    >
      <Swiper
        className="opt-rubrique__hero-swiper"
        modules={[Pagination, A11y]}
        slidesPerView={1}
        slidesPerGroup={1}
        spaceBetween={14}
        grabCursor
        loop={items.length > 4}
        loopAdditionalSlides={4}
        speed={450}
        watchOverflow
        pagination={
          showPagination
            ? {
                clickable: true,
                bulletClass: "opt-rubrique__hero-bullet",
                bulletActiveClass: "is-active",
              }
            : false
        }
        breakpoints={{
          561: {
            slidesPerView: 2,
            slidesPerGroup: 2,
            spaceBetween: 12,
          },
          961: {
            slidesPerView: 4,
            slidesPerGroup: 4,
            spaceBetween: 14,
          },
        }}
      >
        {items.map((item) => (
          <SwiperSlide key={item.id} className="opt-rubrique__hero-card">
            <Link
              href={articleHref(item.slug)}
              className="opt-rubrique__hero-link"
              draggable={false}
            >
              <span className="opt-rubrique__hero-media">
                {item.coverUrl ? (
                  <CoverImage src={item.coverUrl} />
                ) : (
                  <span className="opt-rubrique__ph" aria-hidden />
                )}
              </span>
              {video ||
              isVideoRubrique(item.category, item.categoryLabel) ? (
                <VideoPlay size={22} />
              ) : null}
              <span className="opt-rubrique__hero-shade" aria-hidden />
              <span className="opt-rubrique__hero-body">
                <span className="opt-rubrique__hero-badge">
                  {item.categoryLabel}
                </span>
                <h2 className="opt-rubrique__hero-title">{item.title}</h2>
                <span className="opt-rubrique__hero-meta">
                  <span className="opt-rubrique__hero-avatar" aria-hidden>
                    {initials(item.authorName)}
                  </span>
                  <span className="opt-rubrique__hero-author">
                    {item.authorName}
                  </span>
                  {item.dateLabel ? (
                    <>
                      <span className="opt-rubrique__hero-dot" aria-hidden>
                        ·
                      </span>
                      <time className="opt-rubrique__hero-date">
                        {item.dateLabel}
                      </time>
                    </>
                  ) : null}
                </span>
              </span>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

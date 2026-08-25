"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string | null;
};

/**
 * Aperçu HLS muet au survol souris — pas de chrome, 360p d’abord.
 */
export function StoryHoverPreview({ src, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const delayRef = useRef(0);
  const [active, setActive] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    return () => window.clearTimeout(delayRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video || !src) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      setOn(false);
      return;
    }

    let cancelled = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.setAttribute("muted", "");

    async function attach() {
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        const { default: Hls } = await import("hls.js");
        if (cancelled || !Hls.isSupported()) return;
        const BaseLoader = Hls.DefaultConfig.loader;
        class CorsLoader extends BaseLoader {
          load(context: any, config: any, callbacks: any) {
            if (context.url && !/[?&]cors=1(?:&|$)/.test(context.url)) {
              context.url += context.url.includes("?") ? "&cors=1" : "?cors=1";
            }
            super.load(context, config, callbacks);
          }
        }
        const hls = new Hls({
          enableWorker: true,
          startLevel: 0,
          capLevelToPlayerSize: true,
          maxBufferLength: 8,
          maxMaxBufferLength: 12,
          loader: CorsLoader,
          xhrSetup(xhr) {
            xhr.withCredentials = false;
          },
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
      }
      try {
        await video.play();
        if (!cancelled) setOn(true);
      } catch {
        /* autoplay bloqué */
      }
    }

    void attach();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      setOn(false);
    };
  }, [active, src]);

  function onEnter(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    window.clearTimeout(delayRef.current);
    delayRef.current = window.setTimeout(() => setActive(true), 140);
  }

  function onLeave() {
    window.clearTimeout(delayRef.current);
    setActive(false);
  }

  return (
    <span
      className={`opt-kiosque__hover${on ? " is-on" : ""}`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <video
        ref={videoRef}
        className="opt-kiosque__hover-video"
        muted
        loop
        playsInline
        preload="none"
        poster={poster || undefined}
        aria-hidden
      />
    </span>
  );
}

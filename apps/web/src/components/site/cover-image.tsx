"use client";

import { useEffect, useRef, useState } from "react";
import "./cover-image.css";

type Props = {
  src: string;
  alt?: string;
  /** Classes sur le wrapper (ex. position absolute) */
  className?: string;
  /** Classes sur l’élément img */
  imgClassName?: string;
};

/**
 * Affiche un skeleton jusqu’au chargement complet de l’image
 * (évite le flash de fond noir).
 */
export function CoverImage({
  src,
  alt = "",
  className,
  imgClassName,
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <span
      className={`opt-cover${loaded ? " is-loaded" : ""}${className ? ` ${className}` : ""}`}
    >
      <span className="opt-cover__skel" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={`opt-cover__img${imgClassName ? ` ${imgClassName}` : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        decoding="async"
      />
    </span>
  );
}

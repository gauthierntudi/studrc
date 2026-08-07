"use client";

import {
  MagazinePromoFloat,
  type MagazinePromoFloatProps,
} from "@/components/site/magazine-promo-float";

/** @deprecated Prefer MagazinePromoFloat — alias pour l’article. */
export type ArticleMagazineFloatProps = MagazinePromoFloatProps;

export function ArticleMagazineFloat(props: MagazinePromoFloatProps) {
  return <MagazinePromoFloat {...props} />;
}

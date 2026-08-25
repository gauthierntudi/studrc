import type { Metadata } from "next";
import { Suspense } from "react";
import { magazinesPublicApi } from "@/lib/api";
import {
  absoluteMediaUrl,
  getSiteUrl,
  plainDescription,
} from "@/lib/site-url";
import { KiosqueClient } from "./kiosque-client";
import "./kiosque.css";

type Props = {
  searchParams: Promise<{ magazine?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const magazineId = firstParam((await searchParams).magazine);
  const site = getSiteUrl();

  if (!magazineId) {
    const url = `${site}/kiosque`;
    return {
      title: "Kiosque",
      description: "Parcourez les numéros STUDRC dans le kiosque numérique.",
      alternates: { canonical: url },
      openGraph: {
        type: "website",
        locale: "fr_FR",
        siteName: "STUDRC",
        title: "Kiosque · STUDRC",
        description: "Parcourez les numéros STUDRC dans le kiosque numérique.",
        url,
      },
      twitter: {
        card: "summary_large_image",
        title: "Kiosque · STUDRC",
        description: "Parcourez les numéros STUDRC dans le kiosque numérique.",
      },
    };
  }

  try {
    const mag = await magazinesPublicApi.get(magazineId);
    const issue =
      mag.issueNumber?.trim() || mag.dateLabel?.trim() || null;
    const title = issue ? `${mag.title} · ${issue}` : mag.title;
    const description =
      plainDescription(mag.description) ??
      (issue
        ? `Numéro ${issue} de STU MAG — disponible dans le kiosque.`
        : "STU MAG — disponible dans le kiosque.");
    const image = absoluteMediaUrl(mag.coverUrl);
    const url = `${site}/kiosque?magazine=${encodeURIComponent(mag.id)}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "website",
        locale: "fr_FR",
        siteName: "STUDRC",
        title,
        description,
        url,
        images: image
          ? [
              {
                url: image,
                alt: mag.title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    const url = `${site}/kiosque`;
    return {
      title: "Kiosque",
      description: "STU MAG — kiosque numérique.",
      alternates: { canonical: url },
    };
  }
}

function KiosqueFallback() {
  return (
    <div className="opt-kq" style={{ background: "#00132b", minHeight: "100vh" }}>
      <div className="opt-kq__loading" aria-busy="true">
        <div className="opt-kq__skel">
          <div className="opt-kq__skel-cover" />
          <div className="opt-kq__skel-lines">
            <div className="opt-kq__skel-line opt-kq__skel-line--sm" />
            <div className="opt-kq__skel-line opt-kq__skel-line--lg" />
            <div className="opt-kq__skel-line" />
            <div className="opt-kq__skel-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KiosquePage() {
  return (
    <Suspense fallback={<KiosqueFallback />}>
      <KiosqueClient />
    </Suspense>
  );
}

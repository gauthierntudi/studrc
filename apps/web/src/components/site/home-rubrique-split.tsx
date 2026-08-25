import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEMO_MAGAZINES } from "@/lib/legacy-demo";
import { CoverImage } from "@/components/site/cover-image";
import "./home-rubrique-split.css";

export type HomeMagItem = {
  id: string;
  title: string;
  cover: string;
  issueNumber?: string | null;
  dateLabel?: string;
};

export type HomeRubriqueSplitProps = {
  title?: string;
  href?: string;
  accentClass?: string;
  moreLabel?: string;
  magazines?: HomeMagItem[];
};

const DEMO_ITEMS: HomeMagItem[] = DEMO_MAGAZINES.slice(0, 4).map((m) => ({
  id: String(m.id),
  title: m.titre,
  cover: m.cover,
  issueNumber: m.numero,
  dateLabel: m.dateLabel,
}));

function magazineHref(id: string) {
  return `/kiosque?magazine=${encodeURIComponent(id)}`;
}

function MagazineCard({
  mag,
  latest,
}: {
  mag: HomeMagItem;
  latest?: boolean;
}) {
  return (
    <Link href={magazineHref(mag.id)} className="opt-rsplit__mag">
      <span className="opt-rsplit__mag-cover">
        <CoverImage src={mag.cover} />
        <span className="opt-rsplit__mag-badge">STU MAG</span>
        {latest ? (
          <span className="opt-rsplit__mag-tag">Nouveau</span>
        ) : null}
        {mag.issueNumber ? (
          <span className="opt-rsplit__mag-num">
            {mag.issueNumber.startsWith("#")
              ? mag.issueNumber
              : `#${mag.issueNumber}`}
          </span>
        ) : null}
      </span>
      <h3 className="opt-rsplit__mag-title">{mag.title}</h3>
      {mag.dateLabel ? (
        <p className="opt-rsplit__mag-date">{mag.dateLabel}</p>
      ) : null}
    </Link>
  );
}

/**
 * Rayon STU MAG — couvertures magazine (3:4) dans la colonne principale.
 */
export function HomeRubriqueSplit({
  title = "STU MAG",
  href = "/kiosque",
  accentClass,
  moreLabel = "Tous les numéros",
  magazines,
}: HomeRubriqueSplitProps = {}) {
  const items = magazines && magazines.length > 0 ? magazines : DEMO_ITEMS;

  return (
    <div className="opt-rsplit opt-rsplit--mag" aria-label={title}>
      <header className="opt-rsplit__head">
        <h2 className={`opt-rsplit__title${accentClass ? ` ${accentClass}` : ""}`}>
          <span className="opt-rsplit__dot" aria-hidden />
          {title}
        </h2>
        <Link href={href} className="opt-rsplit__more">
          {moreLabel}
          <span className="opt-rsplit__more-icon" aria-hidden>
            <ArrowRight size={14} strokeWidth={2.5} />
          </span>
        </Link>
      </header>

      <div className="opt-rsplit__mags">
        {items.map((mag, i) => (
          <MagazineCard key={mag.id} mag={mag} latest={i === 0} />
        ))}
      </div>
    </div>
  );
}

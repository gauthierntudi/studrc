import Link from "next/link";
import { DEMO_DOSSIERS, DEMO_FIL_INFO } from "@/lib/legacy-demo";
import { articleHref } from "@/lib/home-articles";
import { CoverImage } from "@/components/site/cover-image";
import "./home-dossiers.css";

type FilItem = { id: string | number; slug?: string; titre: string };
type DossierItem = (typeof DEMO_DOSSIERS)[number];

/**
 * Après le kiosque :
 * 1. STU DATA — analyses et cartographies
 * 2. Fil info — bandeau STU NEWS
 */
export function HomeDossiers({
  decryptages = DEMO_DOSSIERS,
  filInfo = DEMO_FIL_INFO,
}: {
  decryptages?: DossierItem[];
  filInfo?: FilItem[];
} = {}) {
  return (
    <section className="opt-dossiers" aria-label="STU DATA et fil info">
      <div className="opt-dossiers__inner">
        <header className="opt-dossiers__head">
          <h2 className="opt-dossiers__title">
            <Link href="/rubrique/stu-data">STU DATA</Link>
          </h2>
        </header>

        <ul className="opt-dossiers__grid">
          {decryptages.map((item) => (
            <li key={item.id}>
              <Link href={articleHref(item)} className="opt-dossiers__card">
                <CoverImage src={item.cover} className="opt-dossiers__cover" />
                <div className="opt-dossiers__shade" aria-hidden />
                <div className="opt-dossiers__overlay">
                  <div className="opt-dossiers__tags">
                    <span className="opt-dossiers__badge">STU DATA</span>
                  </div>
                  <h3 className="opt-dossiers__card-title">{item.titre}</h3>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="opt-dossiers__fil">
          <h2 className="opt-dossiers__title opt-dossiers__title--fil">
            Le fil info
          </h2>
          <ul className="opt-dossiers__fil-list">
            {filInfo.slice(0, 5).map((item) => (
              <li key={item.id} className="opt-dossiers__fil-item">
                <Link href={articleHref(item)} className="opt-dossiers__fil-link">
                  <span className="opt-dossiers__fil-mark" aria-hidden>
                    O
                  </span>
                  <span className="opt-dossiers__fil-text">{item.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

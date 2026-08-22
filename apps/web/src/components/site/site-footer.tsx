import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FooterRecent } from "@/components/site/footer-recent";
import { FooterSocial } from "@/components/site/footer-social";
import { BrandLogo } from "@/components/site/brand-logo";
import { BRAND } from "@/lib/brand";
import { RUBRIQUES } from "@/lib/rubriques";
import "./site-footer.css";

const QUICK = [
  { href: "/", label: "Accueil" },
  { href: "/abonnement", label: "Abonnement" },
  { href: "/kiosque", label: "STU MAG" },
  { href: "/actualites", label: "Actualités" },
];

/**
 * Footer presse — identité STUDRC.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="opt-ft">
      <div className="opt-ft__top">
        <div className="opt-ft__inner">
          <div className="opt-ft__brand">
            <Link href="/" className="opt-ft__logo">
              <BrandLogo onDark height={64} />
            </Link>
            <p className="opt-ft__tagline">{BRAND.tagline}</p>
            <Link href="/abonnement" className="opt-ft__cta">
              S&apos;abonner
            </Link>
            <FooterSocial />
          </div>

          <div className="opt-ft__col">
            <h2 className="opt-ft__heading">Liens rapides</h2>
            <ul className="opt-ft__links">
              {QUICK.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="opt-ft__col">
            <h2 className="opt-ft__heading">Rubriques</h2>
            <ul className="opt-ft__links">
              {RUBRIQUES.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="opt-ft__col opt-ft__col--recent">
            <h2 className="opt-ft__heading">Récents</h2>
            <FooterRecent />
          </div>

          <div className="opt-ft__col">
            <h2 className="opt-ft__heading">Contact</h2>
            <ul className="opt-ft__contact">
              <li>
                <MapPin size={15} strokeWidth={1.75} aria-hidden />
                <span>{BRAND.address}</span>
              </li>
              <li>
                <Mail size={15} strokeWidth={1.75} aria-hidden />
                <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              </li>
              <li>
                <Phone size={15} strokeWidth={1.75} aria-hidden />
                <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
              </li>
              <li>
                <Phone size={15} strokeWidth={1.75} aria-hidden />
                <a href={`tel:${BRAND.phoneAlt.replace(/\s/g, "")}`}>
                  {BRAND.phoneAlt}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="opt-ft__bottom">
        <div className="opt-ft__bottom-inner">
          <p className="opt-ft__copy">
            © {year} <Link href="/">{BRAND.legalName}</Link>. Tous droits
            réservés.
          </p>
          <ul className="opt-ft__legal">
            <li>
              <Link href="/confidentialite">Confidentialité</Link>
            </li>
            <li>
              <Link href="/conditions-utilisation">Conditions d&apos;utilisation</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FooterRecent } from "@/components/site/footer-recent";
import { FooterSocial } from "@/components/site/footer-social";
import "./site-footer.css";

const QUICK = [
  { href: "/", label: "Accueil" },
  { href: "/abonnement", label: "Abonnement" },
  { href: "/kiosque", label: "Kiosque" },
  { href: "/actualites", label: "Actualités" },
];

const RUBRIQUES = [
  { href: "/rubrique/start-up", label: "Start-up" },
  { href: "/rubrique/inspirationnel", label: "Inspirationnel" },
  { href: "/rubrique/zoom", label: "Zoom" },
  { href: "/rubrique/game-changers", label: "Game changers" },
  { href: "/rubrique/decryptages", label: "Décryptages" },
];

/**
 * Footer presse moderne — identité Opt1mum.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="opt-ft">
      <div className="opt-ft__top">
        <div className="opt-ft__inner">
          <div className="opt-ft__brand">
            <Link href="/" className="opt-ft__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/legacy/img/logo-hd.png" alt="Opt1mum" />
            </Link>
            <p className="opt-ft__tagline">
              Contenu premium pour décideurs — accessible en temps réel,
              partout.
            </p>
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
                <span>8 Avenue Kalemie, Kinshasa-Gombe</span>
              </li>
              <li>
                <Mail size={15} strokeWidth={1.75} aria-hidden />
                <a href="mailto:contact@opt1mum.com">contact@opt1mum.com</a>
              </li>
              <li>
                <Phone size={15} strokeWidth={1.75} aria-hidden />
                <a href="tel:+243828504000">+243 828 504 000</a>
              </li>
              <li>
                <Phone size={15} strokeWidth={1.75} aria-hidden />
                <a href="tel:+243843966000">+243 843 966 000</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="opt-ft__bottom">
        <div className="opt-ft__bottom-inner">
          <p className="opt-ft__copy">
            © {year}{" "}
            <Link href="/">Opt1mum Corporate</Link>. Tous droits réservés.
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

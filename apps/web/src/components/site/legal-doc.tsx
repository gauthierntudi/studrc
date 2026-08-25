import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import "./legal-doc.css";

type LegalDocProps = {
  title: string;
  updatedAt: string;
  current: "privacy" | "terms";
  children: ReactNode;
};

const DOCS = [
  { href: "/confidentialite", id: "privacy" as const, label: "Confidentialité" },
  {
    href: "/conditions-utilisation",
    id: "terms" as const,
    label: "Conditions d’utilisation",
  },
];

export function LegalDoc({
  title,
  updatedAt,
  current,
  children,
}: LegalDocProps) {
  return (
    <article className="opt-legal">
      <div className="opt-legal__container">
        <nav className="opt-legal__tabs" aria-label="Documents juridiques">
          {DOCS.map((doc) => (
            <Link
              key={doc.id}
              href={doc.href}
              className={`opt-legal__tab${current === doc.id ? " is-active" : ""}`}
              aria-current={current === doc.id ? "page" : undefined}
            >
              {doc.label}
            </Link>
          ))}
        </nav>

        <header className="opt-legal__hero">
          <h1 className="opt-legal__title">{title}</h1>
          <p className="opt-legal__meta">
            Dernière mise à jour : {updatedAt}
          </p>
        </header>

        <div className="opt-legal__body">{children}</div>

        <aside className="opt-legal__contact">
          <p className="opt-legal__contact-label">Contact</p>
          <p className="opt-legal__contact-name">{BRAND.legalName}</p>
          <p>{BRAND.address}</p>
          <p>
            <a href={`mailto:${BRAND.infoEmail}`}>{BRAND.infoEmail}</a>
            <span aria-hidden> · </span>
            <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
          </p>
        </aside>
      </div>
    </article>
  );
}

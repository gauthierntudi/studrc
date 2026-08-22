import Link from "next/link";
import type { ReactNode } from "react";
import "./legal-doc.css";

type LegalDocProps = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

export function LegalDoc({ title, updatedAt, children }: LegalDocProps) {
  return (
    <article className="opt-legal">
      <header className="opt-legal__hero">
        <p className="opt-legal__eyebrow">
          <Link href="/">STUDRC</Link>
        </p>
        <h1 className="opt-legal__title">{title}</h1>
        <p className="opt-legal__meta">Dernière mise à jour : {updatedAt}</p>
      </header>
      <div className="opt-legal__body">{children}</div>
    </article>
  );
}

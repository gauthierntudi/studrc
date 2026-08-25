"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { newsletterPublicApi } from "@/lib/api";
import "./home-newsletter.css";

/**
 * Newsletter — après le bloc rubriques (Start-up / Inspirationnel / plus vus).
 */
export function HomeNewsletter() {
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    if (!accepted) {
      setError("Veuillez accepter les termes et conditions.");
      return;
    }

    setBusy(true);
    try {
      const res = await newsletterPublicApi.subscribe({
        email: email.trim(),
        acceptedTerms: true,
        source: "home",
      });
      setSuccessMsg(res.message);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer l’inscription.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="opt-nl" aria-label="Newsletter">
      <div className="opt-nl__inner">
        <p className="opt-nl__kicker">Newsletter STUDRC</p>
        <h2 className="opt-nl__title">Restons en contact</h2>
        <p className="opt-nl__lead">
          Recevez l’actualité éducative, les données et les histoires STUDRC
          directement dans votre boîte mail.
        </p>

        {done ? (
          <p className="opt-nl__success" role="status">
            {successMsg ||
              "Merci — votre inscription a bien été prise en compte."}
          </p>
        ) : (
          <form className="opt-nl__form" onSubmit={onSubmit} noValidate>
            <div className="opt-nl__row">
              <label className="visually-hidden" htmlFor="opt-nl-email">
                Adresse e-mail
              </label>
              <input
                id="opt-nl-email"
                type="email"
                name="email"
                className="opt-nl__input"
                placeholder="Adresse e-mail"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                required
              />
              <button
                type="submit"
                className="opt-nl__submit"
                disabled={busy}
              >
                {busy ? "…" : "Je m'abonne"}
              </button>
            </div>

            <div className="opt-nl__terms">
              <input
                id="opt-nl-terms"
                type="checkbox"
                className="opt-nl__switch"
                role="switch"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                disabled={busy}
              />
              <p className="opt-nl__terms-text">
                <label htmlFor="opt-nl-terms">J&apos;accepte les </label>
                <Link href="/conditions-utilisation">termes et conditions</Link>
              </p>
            </div>

            {error ? (
              <p className="opt-nl__error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}

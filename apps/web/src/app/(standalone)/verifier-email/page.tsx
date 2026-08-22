"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authApi } from "@/lib/api";

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Confirmation en cours…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien invalide");
      return;
    }

    void authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("ok");
        setMessage(res.message);
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Échec de confirmation");
      });
  }, [token]);

  return (
    <p
      className={`mt-8 text-sm ${status === "error" ? "text-red-400" : "text-[var(--opt-cyan)]"}`}
    >
      {message}
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-[var(--opt-fg)]">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="font-display text-2xl tracking-[0.08em]"
        >
          STUDRC
        </Link>
        <h1 className="mt-10 font-display text-3xl">
          Confirmation email
        </h1>
        <Suspense fallback={<p className="mt-8 text-sm text-[var(--opt-muted)]">Chargement…</p>}>
          <VerifyContent />
        </Suspense>
        <p className="mt-6 text-sm text-[var(--opt-muted)]">
          <Link href="/connexion" className="text-[var(--opt-cyan)] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/components/auth-provider";
import { authApi } from "@/lib/api";
import "./email-verify-banner.css";

const HIDDEN_PATHS = [
  "/verifier-email",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/achat",
  "/abonnement",
];

export function EmailVerifyBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const hideRoute = HIDDEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (loading || !user || user.emailVerified || hideRoute) {
    return null;
  }

  async function onResend() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await authApi.resendVerification();
      setSent(true);
      toast.success(res.message || "Email de confirmation renvoyé");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de renvoyer l’email",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="opt-email-banner" role="status">
      <div className="opt-email-banner__inner">
        <Mail size={16} strokeWidth={2.1} aria-hidden />
        <p className="opt-email-banner__text">
          Confirmez votre adresse e-mail
          {user.email ? (
            <>
              {" "}
              <strong>{user.email}</strong>
            </>
          ) : null}{" "}
          pour sécuriser votre compte.
        </p>
        <button
          type="button"
          className="opt-email-banner__btn"
          onClick={() => void onResend()}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="opt-email-banner__spin" size={14} aria-hidden />
              Envoi…
            </>
          ) : sent ? (
            "Renvoyer à nouveau"
          ) : (
            "Renvoyer mail"
          )}
        </button>
      </div>
    </div>
  );
}

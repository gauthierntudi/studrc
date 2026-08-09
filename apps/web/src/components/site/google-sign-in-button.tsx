"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { isTurnstileRequired } from "@/lib/captcha";
import { useAuth } from "@/components/auth-provider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>,
          ) => void;
        };
      };
    };
  }
}

type GoogleSignInButtonProps = {
  onError?: (message: string) => void;
  dividerLabel?: string;
  next?: string;
  /** Token Turnstile (requis si captcha activé côté API). */
  turnstileToken?: string | null;
  /** Si true et Turnstile activé sans token, bloque le clic Google. */
  requireTurnstile?: boolean;
};

function GoogleMark() {
  return (
    <svg
      className="opt-auth-google__mark"
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Script Google indisponible")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Script Google indisponible"));
    document.head.appendChild(script);
  });
}

/**
 * Bouton Google custom (UI maquette) + overlay GSI invisible pour le clic.
 */
export function GoogleSignInButton({
  onError,
  dividerLabel = "Connexion rapide",
  next = "/magazines",
  turnstileToken = null,
  requireTurnstile = false,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const { setUser } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef(turnstileToken);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const turnstileConfigured = isTurnstileRequired();

  useEffect(() => {
    turnstileRef.current = turnstileToken;
  }, [turnstileToken]);

  useEffect(() => {
    if (!clientId || !overlayRef.current || !shellRef.current) {
      return;
    }

    let cancelled = false;

    const handleCredential = async (response: { credential?: string }) => {
      if (!response.credential) {
        onError?.("Connexion Google annulée.");
        return;
      }
      if (
        requireTurnstile &&
        turnstileConfigured &&
        !turnstileRef.current?.trim()
      ) {
        onError?.("Complétez la vérification anti-bot avant de continuer.");
        return;
      }
      setBusy(true);
      try {
        const user = await authApi.loginWithGoogle(
          response.credential,
          turnstileRef.current ?? undefined,
        );
        if (cancelled) return;
        setUser(user);
        router.push(next);
      } catch (err) {
        onError?.(
          err instanceof Error ? err.message : "Connexion Google impossible",
        );
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    (async () => {
      try {
        await loadGsiScript();
        if (
          cancelled ||
          !overlayRef.current ||
          !shellRef.current ||
          !window.google?.accounts?.id
        ) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const width = Math.max(280, shellRef.current.clientWidth || 320);

        overlayRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(overlayRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
          locale: "fr",
        });
        setReady(true);
      } catch {
        onError?.("Connexion Google indisponible.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, next, onError, requireTurnstile, router, setUser, turnstileConfigured]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="opt-auth-google">
      <div className="opt-auth-google__divider" role="separator">
        <span>{dividerLabel}</span>
      </div>

      <div
        ref={shellRef}
        className={`opt-auth-google__shell${!ready || busy ? " is-loading" : ""}`}
        aria-busy={busy}
      >
        <div className="opt-auth-google__face" aria-hidden>
          <GoogleMark />
          <span>Continuer avec Google</span>
        </div>
        <div ref={overlayRef} className="opt-auth-google__overlay" />
      </div>
    </div>
  );
}

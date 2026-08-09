"use client";

import { useEffect, useRef, useState } from "react";
import { isTurnstileRequired } from "@/lib/captcha";
import "./turnstile-widget.css";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type Props = {
  onToken: (token: string | null) => void;
  className?: string;
};

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Turnstile indisponible")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile indisponible"));
    document.head.appendChild(script);
  });
}

/**
 * Widget Cloudflare Turnstile — masqué si CAPTCHA off ou pas de site key.
 */
export function TurnstileWidget({ onToken, className }: Props) {
  const enabled = isTurnstileRequired();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !siteKey || !hostRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !hostRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        hostRef.current.innerHTML = "";
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: siteKey,
          theme: "light",
          size: "flexible",
          callback: (token) => {
            if (!cancelled) onToken(token);
          },
          "expired-callback": () => {
            if (!cancelled) onToken(null);
          },
          "error-callback": () => {
            if (!cancelled) {
              onToken(null);
              setError("Vérification anti-bot indisponible");
            }
          },
        });
      } catch {
        if (!cancelled) {
          setError("Vérification anti-bot indisponible");
          onToken(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
    // onToken intentionally omitted — parent should pass stable setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, siteKey]);

  if (!enabled || !siteKey) return null;

  return (
    <div className={`opt-turnstile${className ? ` ${className}` : ""}`}>
      <div ref={hostRef} className="opt-turnstile__host" />
      {error ? (
        <p className="opt-turnstile__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function resetTurnstile() {
  if (window.turnstile) {
    try {
      window.turnstile.reset();
    } catch {
      /* ignore */
    }
  }
}

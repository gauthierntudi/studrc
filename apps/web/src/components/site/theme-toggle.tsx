"use client";

import { Moon, Sun } from "lucide-react";
import { useSiteTheme } from "./theme-provider";
import "./theme-toggle.css";

type Props = {
  variant?: "header" | "menu";
};

export function ThemeToggle({ variant = "header" }: Props) {
  const { toggleTheme } = useSiteTheme();

  const switchEl = (
    <span className="opt-switch__track" aria-hidden>
      <Sun size={10} strokeWidth={2.4} className="opt-switch__icon opt-switch__icon--sun" />
      <Moon size={10} strokeWidth={2.4} className="opt-switch__icon opt-switch__icon--moon" />
      <span className="opt-switch__thumb" />
    </span>
  );

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="switch"
        className="opt-menu__row opt-switch opt-switch--menu"
        onClick={toggleTheme}
        aria-label="Activer ou désactiver le mode sombre"
      >
        {switchEl}
        <span className="opt-menu__row-label">Thème</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      className="opt-switch"
      onClick={toggleTheme}
      aria-label="Activer ou désactiver le mode sombre"
      title="Thème clair / sombre"
    >
      {switchEl}
    </button>
  );
}

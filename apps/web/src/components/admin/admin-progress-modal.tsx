"use client";

import { useEffect } from "react";
import { CloudUpload } from "lucide-react";

export function AdminProgressModal({
  open,
  title = "Envoi en cours",
  label,
  percent,
}: {
  open: boolean;
  title?: string;
  label: string;
  percent: number;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="admin-progress"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-progress-title"
      aria-describedby="admin-progress-label"
      aria-busy="true"
    >
      <div className="admin-progress__backdrop" />
      <div className="admin-progress__panel">
        <div className="admin-progress__icon" aria-hidden>
          <CloudUpload size={22} strokeWidth={2} />
        </div>
        <h2 id="admin-progress-title">{title}</h2>
        <p id="admin-progress-label">{label}</p>
        <div
          className="admin-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-label="Progression de l’envoi"
        >
          <div
            className="admin-progress__fill"
            style={{ width: `${value}%` }}
          />
        </div>
        <p className="admin-progress__pct">{value} %</p>
        <p className="admin-progress__hint">
          Ne fermez pas cette page pendant l’envoi.
        </p>
      </div>
    </div>
  );
}

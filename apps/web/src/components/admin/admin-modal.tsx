"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminModal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="admin-modal__backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={cn("admin-modal__panel", wide && "admin-modal__panel--wide")}
      >
        <header className="admin-modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

type AlertVariant = "success" | "error" | "info" | "warning";

const styles: Record<AlertVariant, React.CSSProperties> = {
  success: {
    borderColor: "#a7f3d0",
    background: "#ecfdf5",
    color: "#065f46",
  },
  error: {
    borderColor: "#fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
  },
  info: {
    borderColor: "#bae6fd",
    background: "#f0f9ff",
    color: "#075985",
  },
  warning: {
    borderColor: "#fde68a",
    background: "#fffbeb",
    color: "#92400e",
  },
};

export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(className)}
      style={{
        borderRadius: 16,
        border: "1px solid",
        padding: "0.75rem 1rem",
        fontSize: "0.875rem",
        marginBottom: "0.75rem",
        ...styles[variant],
      }}
    >
      {children}
    </div>
  );
}

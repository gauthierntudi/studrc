"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC: Record<"default" | "black" | "white", string> = {
  default: "/legacy/img/logo-hd.png",
  black: "/legacy/img/logo-hd.png",
  white: "/legacy/img/logo2.png",
};

export function AdminBrandLogo({
  href = "/admin",
  variant = "default",
  width = 148,
  height = 36,
  className,
  priority,
}: {
  href?: string;
  variant?: "default" | "black" | "white";
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const filter =
    variant === "white"
      ? "brightness(0) invert(1)"
      : variant === "black"
        ? "brightness(0)"
        : undefined;

  return (
    <Link href={href} className={cn("admin-brand-logo", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC[variant]}
        alt="OPT1MUM"
        width={width}
        height={height}
        style={{
          width,
          height: "auto",
          display: "block",
          filter,
        }}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </Link>
  );
}

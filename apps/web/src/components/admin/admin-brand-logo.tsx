"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function AdminBrandLogo({
  href = "/admin",
  variant: _variant = "default",
  width = 148,
  height = 52,
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
  return (
    <Link href={href} className={cn("admin-brand-logo", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND.logo}
        alt={BRAND.name}
        width={width}
        height={height}
        style={{
          width: "auto",
          maxWidth: width,
          height,
          display: "block",
          objectFit: "contain",
        }}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </Link>
  );
}

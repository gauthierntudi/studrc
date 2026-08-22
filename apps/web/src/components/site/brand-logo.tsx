import { BRAND } from "@/lib/brand";

type BrandLogoProps = {
  onDark?: boolean;
  className?: string;
  height?: number;
};

export function BrandLogo({
  onDark = false,
  className,
  height = 52,
}: BrandLogoProps) {
  const classes = ["brand-logo", onDark ? "brand-logo--on-dark" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logo}
      alt={BRAND.name}
      className={classes}
      height={height}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

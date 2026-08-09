/** URL publique du site (OG, canonical). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/** Rend une URL média absolue pour Open Graph. */
export function absoluteMediaUrl(
  url: string | null | undefined,
): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const site = getSiteUrl();
  return `${site}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/** Texte court pour meta description (sans HTML). */
export function plainDescription(
  text: string | null | undefined,
  max = 160,
): string | undefined {
  if (!text?.trim()) return undefined;
  const plain = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

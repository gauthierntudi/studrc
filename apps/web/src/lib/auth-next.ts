/** Redirection post-auth : uniquement chemins relatifs internes. */
export function safeAuthNext(
  raw: string | null | undefined,
  fallback = "/magazines",
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/admin")) return fallback;
  return value;
}

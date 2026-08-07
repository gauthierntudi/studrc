/** Fallback local si le CDN avatar échoue (403 / DNS). */
export function avatarSrc(url: string | null | undefined): string {
  if (!url) return "/legacy/img/user.jpg";
  return url;
}

export function avatarLocalFallback(url: string | null | undefined): string {
  if (!url) return "/legacy/img/user.jpg";
  try {
    const path = url.startsWith("http")
      ? new URL(url).pathname
      : url.split("?")[0];
    const m = path.match(/\/profil\/([^/]+)$/i);
    if (m) return `/legacy/profil/${decodeURIComponent(m[1])}`;
  } catch {
    // ignore
  }
  return "/legacy/img/user.jpg";
}

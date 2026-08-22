import { NextRequest, NextResponse } from "next/server";

/** CDN autorisés pour le proxy lecture PDF (évite CORS navigateur → R2). */
const ALLOWED_HOSTS = new Set([
  "cdn.studrc.com",
  "cdn.opt1mum.com",
  "cdn.egouv.online",
]);

export const runtime = "nodejs";
/** PDFs lourds — pas de limite edge courte. */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) {
    return NextResponse.json({ error: "Paramètre u manquant" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "Hôte non autorisé" }, { status: 403 });
  }

  const upstreamHeaders: HeadersInit = {
    Accept: "application/pdf,*/*",
  };
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Échec téléchargement CDN" },
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `CDN HTTP ${upstream.status}` },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  const headers = new Headers();
  const contentType =
    upstream.headers.get("content-type") || "application/pdf";
  headers.set("Content-Type", contentType);
  headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

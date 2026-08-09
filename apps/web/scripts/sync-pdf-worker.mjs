/**
 * Keep public/pdf.worker.min.mjs in sync with the installed pdfjs-dist.
 * Mismatched API/worker versions break the flip viewer.
 */
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "pdf.worker.min.mjs");
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.error("[sync-pdf-worker] missing:", src);
  process.exit(1);
}

copyFileSync(src, dest);
const { version } = require("pdfjs-dist/package.json");
console.log(`[sync-pdf-worker] pdfjs-dist@${version} → public/pdf.worker.min.mjs`);

/**
 * Upload covers + PDFs magazines → Cloudflare R2, puis réécrit les clés DB.
 *
 * Sources locales :
 *   MAGAZINE/covers/            → R2 covers/{file}
 *   MAGAZINE/magazinefileopti/  → R2 magazines/{file}
 *   MAGAZINE/magazines/         → R2 magazines/{file} (complément)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:magazines-r2
 *   pnpm migrate:magazines-r2 -- --dry-run
 *   pnpm migrate:magazines-r2 -- --skip-existing   # ne ré-upload pas si clé déjà sur R2
 */
import { access, readdir, readFile, stat } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
  r2ObjectExists,
} from '../src/storage/r2';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_EXISTING = args.has('--skip-existing');

const COVER_PREFIX = 'covers';
const MAG_PREFIX = 'magazines';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const PDF_EXT = new Set(['.pdf']);

type LocalFile = {
  name: string;
  full: string;
  size: number;
  ext: string;
};

async function listFiles(
  dir: string,
  allowed: Set<string>,
): Promise<LocalFile[]> {
  try {
    await access(dir);
  } catch {
    console.warn(`[warn] dossier introuvable : ${dir}`);
    return [];
  }

  const names = await readdir(dir);
  const out: LocalFile[] = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const ext = extname(name).toLowerCase();
    if (!allowed.has(ext)) continue;
    const full = join(dir, name);
    const st = await stat(full);
    if (!st.isFile()) continue;
    out.push({ name, full, size: st.size, ext });
  }
  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

async function uploadBatch(
  label: string,
  prefix: string,
  files: LocalFile[],
  r2: NonNullable<ReturnType<typeof createR2ClientFromEnv>>,
) {
  console.log(`\n— ${label} → ${prefix}/ (${files.length} fichiers) —`);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const key = `${prefix}/${file.name}`;
    try {
      if (SKIP_EXISTING && !DRY_RUN) {
        const exists = await r2ObjectExists(r2, key);
        if (exists) {
          console.log(`[skip] ${key} (déjà sur R2)`);
          skipped += 1;
          continue;
        }
      }

      if (DRY_RUN) {
        console.log(`[dry-run] ${file.name} → ${key} (${formatBytes(file.size)})`);
        uploaded += 1;
        continue;
      }

      const body = await readFile(file.full);
      await putR2Object(r2, {
        key,
        body,
        contentType: contentTypeForExt(file.ext),
      });
      console.log(`[ok] ${key} (${formatBytes(file.size)})`);
      uploaded += 1;
    } catch (err) {
      failed += 1;
      console.error(`[fail] ${file.name}`, err);
    }
  }

  return { uploaded, skipped, failed };
}

/** Normalise une clé média legacy vers covers/… ou magazines/…. */
function rewriteMediaKey(
  raw: string | null | undefined,
  kind: 'cover' | 'pdf',
): string | null {
  if (!raw) return null;
  let key = raw.trim();
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key; // FlipHTML5 etc. — inchangé

  key = key.replace(/^\//, '');
  const base = basename(key);
  if (!base) return null;

  if (kind === 'cover') {
    if (key.startsWith(`${COVER_PREFIX}/`)) return key;
    return `${COVER_PREFIX}/${base}`;
  }

  // PDF / download
  if (key.startsWith(`${MAG_PREFIX}/`) && !key.startsWith(`${MAG_PREFIX}/pdf/`)) {
    return key;
  }
  // magazines/pdf/foo.pdf → magazines/foo.pdf
  const name = base.includes('.') ? base : `${base}.pdf`;
  return `${MAG_PREFIX}/${name}`;
}

async function rewriteDbKeys() {
  const prisma = new PrismaClient();
  let updated = 0;
  try {
    const magazines = await prisma.magazine.findMany({
      select: {
        id: true,
        coverKey: true,
        pdfKey: true,
        previewKey: true,
        downloadKey: true,
      },
    });

    for (const m of magazines) {
      const coverKey = rewriteMediaKey(m.coverKey, 'cover');
      const downloadKey = rewriteMediaKey(m.downloadKey, 'pdf');
      // pdfKey : garder les URLs Flip ; sinon réécrire vers magazines/
      const pdfKey = rewriteMediaKey(m.pdfKey, 'pdf');
      const previewKey = rewriteMediaKey(m.previewKey, 'pdf');

      const data = {
        coverKey: coverKey !== m.coverKey ? coverKey : undefined,
        downloadKey: downloadKey !== m.downloadKey ? downloadKey : undefined,
        pdfKey: pdfKey !== m.pdfKey ? pdfKey : undefined,
        previewKey: previewKey !== m.previewKey ? previewKey : undefined,
      };

      const hasChange = Object.values(data).some((v) => v !== undefined);
      if (!hasChange) continue;

      if (DRY_RUN) {
        console.log(
          `[dry-run] DB ${m.id}: cover=${data.coverKey ?? '—'} download=${data.downloadKey ?? '—'}`,
        );
        updated += 1;
        continue;
      }

      await prisma.magazine.update({
        where: { id: m.id },
        data: {
          ...(data.coverKey !== undefined ? { coverKey: data.coverKey } : {}),
          ...(data.downloadKey !== undefined
            ? { downloadKey: data.downloadKey }
            : {}),
          ...(data.pdfKey !== undefined ? { pdfKey: data.pdfKey } : {}),
          ...(data.previewKey !== undefined
            ? { previewKey: data.previewKey }
            : {}),
        },
      });
      updated += 1;
    }
  } finally {
    await prisma.$disconnect();
  }
  return updated;
}

async function main() {
  const root = resolve(process.cwd(), '../../..');
  const coversDir =
    process.env.COVERS_DIR?.trim() || join(root, 'covers');
  const optiDir =
    process.env.MAGAZINE_PDF_DIR?.trim() || join(root, 'magazinefileopti');
  const magsDir =
    process.env.MAGAZINES_DIR?.trim() || join(root, 'magazines');

  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error(
      'Config R2 incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
    );
  }

  console.log('— Migration covers + PDFs → R2 —');
  console.log(`Bucket : ${r2.bucket}`);
  console.log(`CDN    : ${r2.publicUrl || '(non défini)'}`);
  console.log(`Mode   : ${DRY_RUN ? 'dry-run' : 'upload'}`);
  console.log(`Skip existing : ${SKIP_EXISTING ? 'oui' : 'non'}`);
  console.log(`Covers : ${coversDir}`);
  console.log(`PDF    : ${optiDir} + ${magsDir}`);

  const covers = await listFiles(coversDir, IMAGE_EXT);

  // PDFs : opti prioritaire, magazines/ en complément (pas de doublon de nom)
  const optiPdfs = await listFiles(optiDir, PDF_EXT);
  const magPdfs = await listFiles(magsDir, PDF_EXT);
  const pdfByName = new Map<string, LocalFile>();
  for (const f of magPdfs) pdfByName.set(f.name, f);
  for (const f of optiPdfs) pdfByName.set(f.name, f); // opti gagne
  const pdfs = [...pdfByName.values()];

  const coverStats = await uploadBatch('Covers', COVER_PREFIX, covers, r2);
  const pdfStats = await uploadBatch('PDFs', MAG_PREFIX, pdfs, r2);

  console.log('\n— Réécriture clés Postgres —');
  const dbUpdated = await rewriteDbKeys();

  console.log('\n— Résumé —');
  console.log(
    `Covers : ${coverStats.uploaded} ok · ${coverStats.skipped} skip · ${coverStats.failed} fail`,
  );
  console.log(
    `PDFs   : ${pdfStats.uploaded} ok · ${pdfStats.skipped} skip · ${pdfStats.failed} fail`,
  );
  console.log(`DB magazines mises à jour : ${dbUpdated}`);

  if (coverStats.failed + pdfStats.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

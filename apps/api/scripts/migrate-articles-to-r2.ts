/**
 * Upload covers articles → Cloudflare R2, puis réécrit les clés DB.
 *
 * Source locale :
 *   MAGAZINE/articles/  → R2 articles/{file}
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:articles-r2
 *   pnpm migrate:articles-r2 -- --dry-run
 *   pnpm migrate:articles-r2 -- --skip-existing
 *
 * Prérequis : pnpm migrate:articles (coverKey = articles/{file} ou nom fichier)
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

const ARTICLES_PREFIX = 'articles';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

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

function rewriteCoverKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let key = raw.trim();
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;

  key = key.replace(/^\//, '');
  const base = basename(key);
  if (!base) return null;
  if (key.startsWith(`${ARTICLES_PREFIX}/`)) return key;
  return `${ARTICLES_PREFIX}/${base}`;
}

async function uploadBatch(
  files: LocalFile[],
  r2: NonNullable<ReturnType<typeof createR2ClientFromEnv>>,
) {
  console.log(`\n— Covers articles → ${ARTICLES_PREFIX}/ (${files.length}) —`);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const key = `${ARTICLES_PREFIX}/${file.name}`;
    try {
      if (SKIP_EXISTING && !DRY_RUN) {
        const exists = await r2ObjectExists(r2, key);
        if (exists) {
          console.log(`[skip] ${key}`);
          skipped += 1;
          continue;
        }
      }

      if (DRY_RUN) {
        console.log(
          `[dry-run] ${file.name} → ${key} (${formatBytes(file.size)})`,
        );
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

async function rewriteDbKeys() {
  const prisma = new PrismaClient();
  let updated = 0;
  let missing = 0;
  try {
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, coverKey: true },
    });

    for (const a of articles) {
      const next = rewriteCoverKey(a.coverKey);
      if (!next || next === a.coverKey) {
        if (a.coverKey && !next) missing += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry-run] DB « ${a.title} » → ${next}`);
        updated += 1;
        continue;
      }

      await prisma.article.update({
        where: { id: a.id },
        data: { coverKey: next },
      });
      updated += 1;
    }
  } finally {
    await prisma.$disconnect();
  }
  return { updated, missing };
}

async function main() {
  const root = resolve(process.cwd(), '../../..');
  const articlesDir =
    process.env.ARTICLES_DIR?.trim() || join(root, 'articles');

  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error(
      'Config R2 incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
    );
  }

  console.log('— Migration covers articles → R2 —');
  console.log(`Bucket : ${r2.bucket}`);
  console.log(`CDN    : ${r2.publicUrl || '(non défini)'}`);
  console.log(`Mode   : ${DRY_RUN ? 'dry-run' : 'upload'}`);
  console.log(`Skip existing : ${SKIP_EXISTING ? 'oui' : 'non'}`);
  console.log(`Source : ${articlesDir}`);

  const files = await listFiles(articlesDir, IMAGE_EXT);
  const uploadStats = await uploadBatch(files, r2);

  console.log('\n— Réécriture clés Postgres —');
  const dbStats = await rewriteDbKeys();

  console.log('\n— Résumé —');
  console.log({
    files: files.length,
    ...uploadStats,
    dbUpdated: dbStats.updated,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Upload local MAGAZINE/profil/* → R2 magazine-prod/profil/*
 * and rewrite Subscriber.avatarKey filename → profil/filename.
 *
 * Usage:
 *   pnpm --filter @opt1mum/api migrate:profiles-r2
 *   pnpm --filter @opt1mum/api migrate:profiles-r2 -- --dry-run
 */
import { readdir, readFile, stat } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../src/storage/r2';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const dryRun = process.argv.includes('--dry-run');
const PREFIX = 'profil';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

async function main() {
  const profilDir =
    process.env.PROFILE_UPLOAD_DIR?.trim() ||
    resolve(process.cwd(), '../../../profil');

  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error(
      'Config R2 incomplète (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)',
    );
  }

  console.log(`Source : ${profilDir}`);
  console.log(`Bucket : ${r2.bucket}`);
  console.log(`Prefix : ${PREFIX}/`);
  console.log(`Mode   : ${dryRun ? 'dry-run' : 'upload'}`);
  console.log(`CDN    : ${r2.publicUrl || '(non défini)'}`);

  const names = await readdir(profilDir);
  const files = [];
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const ext = extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const full = join(profilDir, name);
    const st = await stat(full);
    if (!st.isFile()) continue;
    files.push({ name, full, size: st.size, ext });
  }

  console.log(`Fichiers à traiter : ${files.length}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const key = `${PREFIX}/${file.name}`;
    try {
      if (dryRun) {
        console.log(`[dry-run] ${file.name} → ${key} (${file.size} o)`);
      } else {
        const body = await readFile(file.full);
        await putR2Object(r2, {
          key,
          body,
          contentType: contentTypeForExt(file.ext),
        });
        console.log(`[ok] ${key}`);
      }
      uploaded += 1;
    } catch (err) {
      failed += 1;
      console.error(`[fail] ${file.name}`, err);
    }
  }

  const prisma = new PrismaClient();
  let updatedKeys = 0;
  try {
    const subscribers = await prisma.subscriber.findMany({
      where: { avatarKey: { not: null } },
      select: { id: true, avatarKey: true },
    });

    for (const sub of subscribers) {
      const key = sub.avatarKey?.trim();
      if (!key) continue;
      if (/^https?:\/\//i.test(key)) continue;
      if (key.includes('/')) continue;

      const next = `${PREFIX}/${key}`;
      if (dryRun) {
        console.log(`[dry-run] DB ${sub.id}: ${key} → ${next}`);
        updatedKeys += 1;
        continue;
      }

      await prisma.subscriber.update({
        where: { id: sub.id },
        data: { avatarKey: next },
      });
      updatedKeys += 1;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('---');
  console.log(
    `Upload : ${uploaded} ok · ${skipped} skip · ${failed} fail · DB avatarKey : ${updatedKeys}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

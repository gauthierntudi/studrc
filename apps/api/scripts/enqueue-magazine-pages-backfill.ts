/**
 * Enqueue rasterization for magazines that have a PDF but pages not READY.
 *
 * Usage (API container / local):
 *   pnpm --filter @studrc/api exec tsx scripts/enqueue-magazine-pages-backfill.ts
 *   pnpm --filter @studrc/api exec tsx scripts/enqueue-magazine-pages-backfill.ts --limit=10
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, MagazinePagesStatus } from '@prisma/client';
import { enqueueMagazinePages } from '../src/magazines/pages/magazine-pages.queue';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  const prisma = new PrismaClient();
  try {
    const magazines = await prisma.magazine.findMany({
      where: {
        downloadKey: { not: null },
        pagesStatus: { not: MagazinePagesStatus.READY },
      },
      select: { id: true, title: true, pagesStatus: true },
      orderBy: { updatedAt: 'desc' },
      ...(limit && limit > 0 ? { take: limit } : {}),
    });

    console.log(`Enqueue ${magazines.length} magazine(s)…`);
    for (const m of magazines) {
      await prisma.magazine.update({
        where: { id: m.id },
        data: {
          pagesStatus: MagazinePagesStatus.PENDING,
          pagesError: null,
        },
      });
      await enqueueMagazinePages(m.id);
      console.log(`  queued ${m.id} (${m.title}) [${m.pagesStatus}]`);
    }
    console.log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

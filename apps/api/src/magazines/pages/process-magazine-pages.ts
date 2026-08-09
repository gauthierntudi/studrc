import { PrismaClient, MagazinePagesStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import {
  createR2ClientFromEnv,
  getR2ObjectBuffer,
  putR2Object,
} from '../../storage/r2';
import type { MagazinePagesJobData } from './magazine-pages.queue';
import { rasterizePdfPages } from './rasterize-pdf';

const prisma = new PrismaClient();

function pageImageKey(magazineId: string, pageNumber: number): string {
  return `magazines/${magazineId}/pages/${pageNumber}.webp`;
}

function pageThumbKey(magazineId: string, pageNumber: number): string {
  return `magazines/${magazineId}/pages/${pageNumber}.thumb.webp`;
}

/**
 * Calcule la 1re page à (re)générer.
 * Préfixe contigu depuis 1 → reprise. Sinon purge et repart de 1.
 * `force` : toujours repartir de zéro.
 */
async function resolveStartPage(
  magazineId: string,
  force: boolean,
): Promise<number> {
  if (force) {
    await prisma.magazinePage.deleteMany({ where: { magazineId } });
    return 1;
  }

  const rows = await prisma.magazinePage.findMany({
    where: { magazineId },
    orderBy: { pageNumber: 'asc' },
    select: { pageNumber: true },
  });
  if (rows.length === 0) return 1;
  if (rows[0]?.pageNumber !== 1) {
    await prisma.magazinePage.deleteMany({ where: { magazineId } });
    return 1;
  }

  let expected = 1;
  for (const row of rows) {
    if (row.pageNumber !== expected) {
      await prisma.magazinePage.deleteMany({
        where: { magazineId, pageNumber: { gte: expected } },
      });
      return expected;
    }
    expected += 1;
  }
  return expected;
}

export async function processMagazinePagesJob(
  job: Job<MagazinePagesJobData>,
): Promise<{ pages: number; resumedFrom?: number }> {
  const magazineId = job.data.magazineId;
  const force = Boolean(job.data.force);
  // eslint-disable-next-line no-console
  console.log(
    `[magazine-pages] start ${magazineId}${force ? ' (force)' : ''}`,
  );

  const magazine = await prisma.magazine.findUnique({
    where: { id: magazineId },
    select: { id: true, downloadKey: true },
  });

  if (!magazine?.downloadKey) {
    await prisma.magazine.update({
      where: { id: magazineId },
      data: {
        pagesStatus: MagazinePagesStatus.FAILED,
        pagesError: 'Aucun PDF (downloadKey) à rasteriser',
        pagesCount: null,
      },
    });
    throw new Error(`Magazine ${magazineId}: missing downloadKey`);
  }

  const r2 = createR2ClientFromEnv();
  if (!r2) {
    throw new Error('R2 non configuré');
  }

  await prisma.magazine.update({
    where: { id: magazineId },
    data: {
      pagesStatus: MagazinePagesStatus.PROCESSING,
      pagesError: null,
    },
  });

  try {
    const pdfBuffer = await getR2ObjectBuffer(r2, magazine.downloadKey);
    const startPage = await resolveStartPage(magazineId, force);
    if (startPage > 1) {
      // eslint-disable-next-line no-console
      console.log(
        `[magazine-pages] resume ${magazineId} from page ${startPage}`,
      );
    }

    const total = await rasterizePdfPages(
      new Uint8Array(pdfBuffer),
      async (page, done, pageTotal) => {
        const imageKey = pageImageKey(magazineId, page.pageNumber);
        const thumbKey = pageThumbKey(magazineId, page.pageNumber);

        await putR2Object(r2, {
          key: imageKey,
          body: page.image,
          contentType: 'image/webp',
        });
        await putR2Object(r2, {
          key: thumbKey,
          body: page.thumb,
          contentType: 'image/webp',
        });

        await prisma.magazinePage.upsert({
          where: {
            magazineId_pageNumber: {
              magazineId,
              pageNumber: page.pageNumber,
            },
          },
          create: {
            magazineId,
            pageNumber: page.pageNumber,
            imageKey,
            thumbKey,
            width: page.width,
            height: page.height,
          },
          update: {
            imageKey,
            thumbKey,
            width: page.width,
            height: page.height,
          },
        });

        // Heartbeat DB : le reaper voit que le job avance encore.
        if (done === startPage || done % 5 === 0 || done === pageTotal) {
          await prisma.magazine
            .update({
              where: { id: magazineId },
              data: { pagesStatus: MagazinePagesStatus.PROCESSING },
            })
            .catch(() => undefined);
        }

        await job.updateProgress(Math.round((done / pageTotal) * 100));
      },
      { startPage },
    );

    if (total === 0) {
      throw new Error('PDF sans pages');
    }

    // Déjà complet (reprise après READY partiel / race).
    if (startPage > total) {
      const count = await prisma.magazinePage.count({ where: { magazineId } });
      await prisma.magazine.update({
        where: { id: magazineId },
        data: {
          pagesStatus: MagazinePagesStatus.READY,
          pagesCount: count,
          pagesError: null,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`[magazine-pages] ready ${magazineId} (${count} pages, noop)`);
      return { pages: count, resumedFrom: startPage };
    }

    await prisma.magazine.update({
      where: { id: magazineId },
      data: {
        pagesStatus: MagazinePagesStatus.READY,
        pagesCount: total,
        pagesError: null,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`[magazine-pages] ready ${magazineId} (${total} pages)`);
    return {
      pages: total,
      ...(startPage > 1 ? { resumedFrom: startPage } : {}),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : 'Rasterization failed';
    await prisma.magazine
      .update({
        where: { id: magazineId },
        data: {
          pagesStatus: MagazinePagesStatus.FAILED,
          pagesError: message,
        },
      })
      .catch(() => undefined);
    throw err;
  }
}

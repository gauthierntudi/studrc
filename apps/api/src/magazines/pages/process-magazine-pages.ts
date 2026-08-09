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

export async function processMagazinePagesJob(
  job: Job<MagazinePagesJobData>,
): Promise<{ pages: number }> {
  const magazineId = job.data.magazineId;
  // eslint-disable-next-line no-console
  console.log(`[magazine-pages] start ${magazineId}`);

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

    // Remplace l’ancien jeu avant d’écrire les nouvelles pages.
    await prisma.magazinePage.deleteMany({ where: { magazineId } });

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

        await prisma.magazinePage.create({
          data: {
            magazineId,
            pageNumber: page.pageNumber,
            imageKey,
            thumbKey,
            width: page.width,
            height: page.height,
          },
        });

        await job.updateProgress(Math.round((done / pageTotal) * 100));
      },
    );

    if (total === 0) {
      throw new Error('PDF sans pages');
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
    return { pages: total };
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

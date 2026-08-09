import { MagazinePagesStatus, PrismaClient } from '@prisma/client';
import { enqueueMagazinePages } from './magazine-pages.queue';

const prisma = new PrismaClient();

/** Intervalle reaper (env MAGAZINE_PAGES_RECOVER_INTERVAL_MS). */
const DEFAULT_RECOVER_INTERVAL_MS = 5 * 60_000;

export function readRecoverIntervalMs(): number {
  const raw = process.env.MAGAZINE_PAGES_RECOVER_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_RECOVER_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RECOVER_INTERVAL_MS;
  return Math.max(60_000, Math.min(Math.floor(n), 60 * 60_000));
}

/**
 * Ré-enqueue les magazines orphelins :
 * - PENDING (jamais démarrés / job perdu)
 * - PROCESSING (crash worker / job Redis disparu — `enqueue` no-op si déjà active)
 *
 * FAILED : laissé à la relance lazy (lecture/aperçu) ou admin,
 * pour ne pas boucler sur des PDF irrécupérables.
 */
export async function recoverOrphanedMagazinePages(): Promise<{
  scanned: number;
  queued: number;
}> {
  const orphans = await prisma.magazine.findMany({
    where: {
      downloadKey: { not: null },
      pagesStatus: {
        in: [MagazinePagesStatus.PENDING, MagazinePagesStatus.PROCESSING],
      },
    },
    select: { id: true, pagesStatus: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 80,
  });

  let queued = 0;
  for (const mag of orphans) {
    const urgent = mag.pagesStatus === MagazinePagesStatus.PROCESSING;
    try {
      const res = await enqueueMagazinePages(mag.id, {
        urgent,
        priority: urgent ? 2 : 10,
      });
      if (res.queued) {
        queued += 1;
        // eslint-disable-next-line no-console
        console.log(
          `[magazine-pages] recover queued ${mag.id} (${mag.pagesStatus})` +
            (res.queue ? ` @${res.queue}` : ''),
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[magazine-pages] recover failed ${mag.id}`, err);
    }
  }

  if (orphans.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[magazine-pages] recover scanned=${orphans.length} queued=${queued}`,
    );
  }

  return { scanned: orphans.length, queued };
}

/** Boot + intervalle. Retourne le timer pour shutdown. */
export function startMagazinePagesRecoveryLoop(): {
  stop: () => void;
} {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const intervalMs = readRecoverIntervalMs();

  const run = () => {
    if (stopped) return;
    void recoverOrphanedMagazinePages().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[magazine-pages] recover loop error', err);
    });
  };

  // Léger délai au boot : laisser les workers s’enregistrer avant le scan.
  const boot = setTimeout(run, 8_000);
  timer = setInterval(run, intervalMs);

  // eslint-disable-next-line no-console
  console.log(
    `[magazine-pages] recover loop every ${Math.round(intervalMs / 1000)}s`,
  );

  return {
    stop: () => {
      stopped = true;
      clearTimeout(boot);
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

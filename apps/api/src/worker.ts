/**
 * BullMQ worker — magazine page rasterization (PDF → WebP on R2).
 *
 * Deux files :
 * - urgent : lecture / aperçu (démarrage indépendant du backfill)
 * - bulk   : upload + backfill
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { Worker } from 'bullmq';
import {
  createRedisConnection,
  MAGAZINE_PAGES_QUEUE,
  MAGAZINE_PAGES_URGENT_QUEUE,
  type MagazinePagesJobData,
} from './magazines/pages/magazine-pages.queue';
import { processMagazinePagesJob } from './magazines/pages/process-magazine-pages';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

function readConcurrency(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 8) : fallback;
}

async function bootstrap() {
  const connection = createRedisConnection();
  const urgentConcurrency = readConcurrency(
    'MAGAZINE_PAGES_URGENT_CONCURRENCY',
    3,
  );
  const bulkConcurrency = readConcurrency('MAGAZINE_PAGES_CONCURRENCY', 2);

  const makeWorker = (queueName: string, concurrency: number) => {
    const worker = new Worker<MagazinePagesJobData>(
      queueName,
      async (job) => processMagazinePagesJob(job),
      {
        connection,
        concurrency,
        lockDuration: 30 * 60_000,
      },
    );

    worker.on('completed', (job, result) => {
      // eslint-disable-next-line no-console
      console.log(
        `[worker:${queueName}] completed ${job.id}`,
        result && typeof result === 'object' ? result : '',
      );
    });

    worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[worker:${queueName}] failed ${job?.id}:`, err.message);
    });

    return worker;
  };

  const urgentWorker = makeWorker(
    MAGAZINE_PAGES_URGENT_QUEUE,
    urgentConcurrency,
  );
  const bulkWorker = makeWorker(MAGAZINE_PAGES_QUEUE, bulkConcurrency);

  // eslint-disable-next-line no-console
  console.log(
    `OPT1MUM worker started — urgent×${urgentConcurrency} + bulk×${bulkConcurrency}`,
  );

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[worker] ${signal}, shutting down…`);
    await Promise.all([urgentWorker.close(), bulkWorker.close()]);
    connection.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal', err);
  process.exit(1);
});

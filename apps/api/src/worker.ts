/**
 * BullMQ worker — magazine page rasterization (PDF → WebP on R2).
 *
 * Deux files :
 * - urgent : lecture / aperçu (démarrage indépendant du backfill)
 * - bulk   : upload + backfill
 *
 * Reaper : au boot + périodiquement, ré-enqueue PENDING / PROCESSING orphelins
 * (crash worker, job Redis perdu) avec reprise des pages déjà uploadées.
 *
 * Heartbeat Redis : lu par Admin → Monitoring.
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
import { startMagazinePagesRecoveryLoop } from './magazines/pages/recover-orphaned-pages';
import {
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SEC,
} from './monitoring/monitoring.constants';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../.env') });

function readConcurrency(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 4) : fallback;
}

async function bootstrap() {
  const connection = createRedisConnection();
  // Défauts bas : un gros PDF rasterisé peut monter à plusieurs Go de RAM.
  const urgentConcurrency = readConcurrency(
    'MAGAZINE_PAGES_URGENT_CONCURRENCY',
    1,
  );
  const bulkConcurrency = readConcurrency('MAGAZINE_PAGES_CONCURRENCY', 1);

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
  const recovery = startMagazinePagesRecoveryLoop();

  const writeHeartbeat = () => {
    const payload = JSON.stringify({
      at: new Date().toISOString(),
      urgent: urgentConcurrency,
      bulk: bulkConcurrency,
      pid: process.pid,
    });
    void connection
      .set(WORKER_HEARTBEAT_KEY, payload, 'EX', WORKER_HEARTBEAT_TTL_SEC)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[worker] heartbeat failed', err);
      });
  };
  writeHeartbeat();
  const heartbeatTimer = setInterval(writeHeartbeat, 30_000);

  // eslint-disable-next-line no-console
  console.log(
    `OPT1MUM worker started — urgent×${urgentConcurrency} + bulk×${bulkConcurrency}`,
  );

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[worker] ${signal}, shutting down…`);
    clearInterval(heartbeatTimer);
    recovery.stop();
    await connection.del(WORKER_HEARTBEAT_KEY).catch(() => undefined);
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

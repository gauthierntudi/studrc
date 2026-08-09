import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/** Backfill / upload — ne bloque pas les lectures. */
export const MAGAZINE_PAGES_QUEUE = 'magazine-pages';
/** Ouverture lecture / aperçu — démarrage immédiat (workers dédiés). */
export const MAGAZINE_PAGES_URGENT_QUEUE = 'magazine-pages-urgent';

export type MagazinePagesJobData = {
  magazineId: string;
};

export type EnqueuePagesResult = {
  queued: boolean;
  state?: string;
  queue?: string;
};

export function createRedisConnection(
  url = process.env.REDIS_URL,
): IORedis {
  if (!url?.trim()) {
    throw new Error('REDIS_URL is required for magazine pages queue');
  }
  return new IORedis(url.trim(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function createNamedQueue(name: string, connection?: IORedis): Queue {
  return new Queue(name, {
    connection: connection ?? createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 8_000 },
      removeOnComplete: 50,
      removeOnFail: 30,
    },
  });
}

export function createMagazinePagesQueue(connection?: IORedis): Queue {
  return createNamedQueue(MAGAZINE_PAGES_QUEUE, connection);
}

export function createMagazinePagesUrgentQueue(connection?: IORedis): Queue {
  return createNamedQueue(MAGAZINE_PAGES_URGENT_QUEUE, connection);
}

function jobIdFor(magazineId: string): string {
  return `magazine-pages__${magazineId}`;
}

async function findExistingJob(
  queues: Queue[],
  jobId: string,
): Promise<{ queue: Queue; job: NonNullable<Awaited<ReturnType<Queue['getJob']>>> } | null> {
  for (const queue of queues) {
    const job = await queue.getJob(jobId);
    if (job) return { queue, job };
  }
  return null;
}

/**
 * Enqueue rasterization.
 * `urgent: true` (lecture / aperçu) → file dédiée, ne attend pas le backfill.
 */
export async function enqueueMagazinePages(
  magazineId: string,
  options?: { priority?: number; urgent?: boolean },
): Promise<EnqueuePagesResult> {
  const connection = createRedisConnection();
  const bulk = createMagazinePagesQueue(connection);
  const urgentQ = createMagazinePagesUrgentQueue(connection);
  const jobId = jobIdFor(magazineId);
  const urgent = Boolean(options?.urgent) || (options?.priority ?? 10) < 10;
  const target = urgent ? urgentQ : bulk;
  const targetName = urgent
    ? MAGAZINE_PAGES_URGENT_QUEUE
    : MAGAZINE_PAGES_QUEUE;

  try {
    const existing = await findExistingJob([urgentQ, bulk], jobId);
    if (existing) {
      const state = await existing.job.getState();
      if (
        state === 'active' ||
        state === 'waiting' ||
        state === 'delayed' ||
        state === 'prioritized' ||
        state === 'waiting-children'
      ) {
        // Lecture : si le job est encore en file bulk, le déplacer vers urgent.
        if (
          urgent &&
          state !== 'active' &&
          existing.queue.name === MAGAZINE_PAGES_QUEUE
        ) {
          const data = existing.job.data as MagazinePagesJobData;
          await existing.job.remove().catch(() => undefined);
          await urgentQ.add('rasterize', data, { jobId, priority: 1 });
          return { queued: true, state: 'waiting', queue: MAGAZINE_PAGES_URGENT_QUEUE };
        }
        return { queued: false, state, queue: existing.queue.name };
      }
      await existing.job.remove().catch(() => undefined);
    }

    await target.add(
      'rasterize',
      { magazineId } satisfies MagazinePagesJobData,
      { jobId, priority: urgent ? 1 : (options?.priority ?? 10) },
    );
    return { queued: true, state: 'waiting', queue: targetName };
  } finally {
    await Promise.all([bulk.close(), urgentQ.close()]);
    connection.disconnect();
  }
}

import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { createRedisConnection } from '../../magazines/pages/magazine-pages.queue';

export const ARTICLE_VIDEO_QUEUE = 'article-video';

export type ArticleVideoJobData = {
  articleId: string;
  force?: boolean;
};

export type EnqueueVideoResult = {
  queued: boolean;
  state?: string;
};

export function createArticleVideoQueue(connection?: IORedis): Queue {
  return new Queue(ARTICLE_VIDEO_QUEUE, {
    connection: connection ?? createRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: 40,
      removeOnFail: 40,
    },
  });
}

function jobIdFor(articleId: string): string {
  return `article-video__${articleId}`;
}

export async function enqueueArticleVideo(
  articleId: string,
  options?: { force?: boolean },
): Promise<EnqueueVideoResult> {
  const connection = createRedisConnection();
  const queue = createArticleVideoQueue(connection);
  const jobId = jobIdFor(articleId);
  const force = Boolean(options?.force);
  const jobData = {
    articleId,
    ...(force ? { force: true } : {}),
  } satisfies ArticleVideoJobData;

  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (
        state === 'active' ||
        state === 'waiting' ||
        state === 'delayed' ||
        state === 'prioritized' ||
        state === 'waiting-children'
      ) {
        if (force && state !== 'active') {
          await existing.remove().catch(() => undefined);
        } else {
          return { queued: false, state };
        }
      } else {
        await existing.remove().catch(() => undefined);
      }
    }

    await queue.add('transcode', jobData, { jobId, priority: 5 });
    return { queued: true, state: 'waiting' };
  } finally {
    await queue.close();
    connection.disconnect();
  }
}

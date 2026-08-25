import { PrismaClient, VideoStatus } from '@prisma/client';
import { logSystemActivity } from '../../activity/log-system-activity';
import { enqueueArticleVideo } from './article-video.queue';

const prisma = new PrismaClient();

const DEFAULT_RECOVER_INTERVAL_MS = 5 * 60_000;

export function readVideoRecoverIntervalMs(): number {
  const raw = process.env.ARTICLE_VIDEO_RECOVER_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_RECOVER_INTERVAL_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RECOVER_INTERVAL_MS;
  return Math.max(60_000, Math.min(Math.floor(n), 60 * 60_000));
}

export async function recoverOrphanedArticleVideos(): Promise<{
  scanned: number;
  queued: number;
}> {
  const orphans = await prisma.article.findMany({
    where: {
      videoSourceKey: { not: null },
      videoStatus: {
        in: [VideoStatus.PENDING, VideoStatus.PROCESSING],
      },
    },
    select: { id: true, title: true, videoStatus: true },
    orderBy: { updatedAt: 'asc' },
    take: 40,
  });

  let queued = 0;
  for (const article of orphans) {
    try {
      const res = await enqueueArticleVideo(article.id);
      if (res.queued) {
        queued += 1;
        // eslint-disable-next-line no-console
        console.log(
          `[article-video] recover queued ${article.id} (${article.videoStatus})`,
        );
        await logSystemActivity(prisma, {
          action: 'article_video_recovered',
          entity: 'article',
          entityId: article.id,
          meta: {
            title: article.title,
            previousStatus: article.videoStatus,
          },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[article-video] recover failed ${article.id}`, err);
    }
  }

  if (orphans.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[article-video] recover scanned=${orphans.length} queued=${queued}`,
    );
  }

  return { scanned: orphans.length, queued };
}

export function startArticleVideoRecoveryLoop(): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const intervalMs = readVideoRecoverIntervalMs();

  const run = () => {
    if (stopped) return;
    void recoverOrphanedArticleVideos().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[article-video] recover loop error', err);
    });
  };

  const boot = setTimeout(run, 12_000);
  timer = setInterval(run, intervalMs);

  // eslint-disable-next-line no-console
  console.log(
    `[article-video] recover loop every ${Math.round(intervalMs / 1000)}s`,
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

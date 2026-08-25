import { PrismaClient, VideoStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { logSystemActivity } from '../../activity/log-system-activity';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  deleteR2Prefix,
  getR2ObjectStream,
  putR2Object,
} from '../../storage/r2';
import type { ArticleVideoJobData } from './article-video.queue';
import {
  buildMasterPlaylist,
  evenWidth,
  pickHlsRungs,
  probeVideo,
  runFfmpeg,
  type HlsRung,
} from './ffmpeg';

const prisma = new PrismaClient();

export function videoSourcePrefix(articleId: string): string {
  return `videos/${articleId}/`;
}

export function videoHlsPrefix(articleId: string): string {
  return `videos/${articleId}/hls`;
}

export function videoPosterKey(articleId: string): string {
  return `videos/${articleId}/poster.jpg`;
}

export function videoMasterKey(articleId: string): string {
  return `videos/${articleId}/hls/master.m3u8`;
}

async function fail(articleId: string, message: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      videoStatus: VideoStatus.FAILED,
      videoError: message.slice(0, 1000),
    },
  });
  await logSystemActivity(prisma, {
    action: 'article_video_failed',
    entity: 'article',
    entityId: articleId,
    meta: { error: message.slice(0, 500) },
  });
}

async function downloadToFile(
  key: string,
  dest: string,
): Promise<void> {
  const r2 = createR2ClientFromEnv();
  if (!r2) throw new Error('Stockage R2 non configuré');
  const stream = await getR2ObjectStream(r2, key);
  await pipeline(stream.body, createWriteStream(dest));
}

async function uploadTree(
  localDir: string,
  keyPrefix: string,
): Promise<number> {
  const r2 = createR2ClientFromEnv();
  if (!r2) throw new Error('Stockage R2 non configuré');
  let count = 0;

  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: Array<{ abs: string; key: string }> = [];
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, `${prefix}/${entry.name}`);
      } else {
        files.push({ abs, key: `${prefix}/${entry.name}` });
      }
    }

    const batchSize = 6;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ abs, key }) => {
          const ext = key.split('.').pop() ?? '';
          const isPlaylist = ext === 'm3u8';
          const body = await readFile(abs);
          await putR2Object(r2!, {
            key,
            body,
            contentType: contentTypeForExt(ext),
            cacheControl: isPlaylist
              ? 'public, max-age=60, must-revalidate'
              : 'public, max-age=31536000, immutable',
          });
          count += 1;
        }),
      );
    }
  }

  await walk(localDir, keyPrefix);
  return count;
}

async function transcodeRung(
  inputPath: string,
  workDir: string,
  rung: HlsRung,
  hasAudio: boolean,
): Promise<void> {
  const outDir = join(workDir, rung.name);
  await mkdir(outDir, { recursive: true });
  const args = [
    '-y',
    '-i',
    inputPath,
    '-vf',
    `scale=-2:${rung.height}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-profile:v',
    'main',
    '-level',
    '4.0',
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    `${rung.videoKbps}k`,
    '-maxrate',
    `${Math.round(rung.videoKbps * 1.07)}k`,
    '-bufsize',
    `${rung.videoKbps * 2}k`,
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-sc_threshold',
    '0',
    '-force_key_frames',
    'expr:gte(t,n_forced*2)',
    '-hls_time',
    '2',
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    join(outDir, 'seg_%03d.ts'),
  ];
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', `${rung.audioKbps}k`, '-ac', '2');
  } else {
    args.push('-an');
  }
  args.push(join(outDir, 'index.m3u8'));
  await runFfmpeg(args);
}

export async function processArticleVideoJob(
  job: Job<ArticleVideoJobData>,
): Promise<{ variants: number; durationSec: number | null }> {
  const articleId = job.data.articleId;
  // eslint-disable-next-line no-console
  console.log(`[article-video] start ${articleId}`);

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      coverKey: true,
      videoSourceKey: true,
      videoStatus: true,
    },
  });

  if (!article?.videoSourceKey) {
    await fail(articleId, 'Aucun fichier source à transcoder');
    throw new Error('Aucun videoSourceKey');
  }

  const r2 = createR2ClientFromEnv();
  if (!r2) {
    await fail(articleId, 'Stockage R2 non configuré');
    throw new Error('R2 manquant');
  }

  await prisma.article.update({
    where: { id: articleId },
    data: {
      videoStatus:
        article.videoStatus === VideoStatus.READY
          ? VideoStatus.READY
          : VideoStatus.PROCESSING,
      videoError: null,
    },
  });

  const workDir = join(tmpdir(), `studrc-video-${articleId}`);
  const sourcePath = join(workDir, 'source.bin');
  const hlsDir = join(workDir, 'hls');
  const posterPath = join(workDir, 'poster.jpg');

  try {
    await rm(workDir, { recursive: true, force: true });
    await mkdir(hlsDir, { recursive: true });
    await downloadToFile(article.videoSourceKey, sourcePath);

    const probe = await probeVideo(sourcePath);
    const rungs = pickHlsRungs(probe.height);
    // eslint-disable-next-line no-console
    console.log(
      `[article-video] ${articleId} ${probe.width}x${probe.height}` +
        ` ${probe.durationSec ?? '?'}s → ${rungs.map((r) => r.name).join(', ')}`,
    );

    await runFfmpeg([
      '-y',
      '-ss',
      probe.durationSec && probe.durationSec > 4 ? '00:00:02' : '00:00:00',
      '-i',
      sourcePath,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      posterPath,
    ]);

    const posterKey = videoPosterKey(articleId);
    const posterBody = await readFile(posterPath);
    await putR2Object(r2, {
      key: posterKey,
      body: posterBody,
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400',
    });

    const hlsKey = videoMasterKey(articleId);
    const published: Array<HlsRung & { width: number }> = [];

    for (const rung of rungs) {
      // eslint-disable-next-line no-console
      console.log(`[article-video] ${articleId} → ${rung.name}`);
      await transcodeRung(sourcePath, hlsDir, rung, probe.hasAudio);
      published.push({
        ...rung,
        width: evenWidth(probe.width, probe.height, rung.height),
      });
      const master = buildMasterPlaylist(published, probe.hasAudio);
      await writeFile(join(hlsDir, 'master.m3u8'), master, 'utf8');
      if (published.length === 1) {
        await deleteR2Prefix(r2, `${videoHlsPrefix(articleId)}/`);
      }
      await uploadTree(
        join(hlsDir, rung.name),
        `${videoHlsPrefix(articleId)}/${rung.name}`,
      );
      await putR2Object(r2, {
        key: hlsKey,
        body: Buffer.from(master, 'utf8'),
        contentType: 'application/vnd.apple.mpegurl',
        cacheControl: 'public, max-age=60, must-revalidate',
      });
      if (published.length === 1) {
        await prisma.article.update({
          where: { id: articleId },
          data: {
            videoHlsKey: hlsKey,
            videoPosterKey: posterKey,
            videoStatus: VideoStatus.READY,
            videoError: null,
            videoDurationSec: probe.durationSec,
            ...(!article.coverKey ? { coverKey: posterKey } : {}),
          },
        });
        // eslint-disable-next-line no-console
        console.log(`[article-video] ${articleId} READY (${rung.name})`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[article-video] ${articleId} +${rung.name}`);
      }
      await job.updateProgress({
        variant: rung.name,
        ready: published.length,
        total: rungs.length,
      });
    }

    await logSystemActivity(prisma, {
      action: 'article_video_ready',
      entity: 'article',
      entityId: articleId,
      meta: {
        title: article.title,
        variants: published.map((r) => r.name),
        durationSec: probe.durationSec,
      },
    });

    return { variants: published.length, durationSec: probe.durationSec };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const current = await prisma.article.findUnique({
      where: { id: articleId },
      select: { videoStatus: true },
    });
    if (current?.videoStatus === VideoStatus.READY) {
      // eslint-disable-next-line no-console
      console.error(
        `[article-video] ${articleId} rung failed after READY:`,
        message,
      );
      return { variants: 1, durationSec: null };
    }
    await fail(articleId, message);
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

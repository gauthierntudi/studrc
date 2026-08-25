import { spawn } from 'child_process';

export function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

export function ffprobeBin(): string {
  return process.env.FFPROBE_PATH?.trim() || 'ffprobe';
}

export type VideoProbe = {
  width: number;
  height: number;
  durationSec: number | null;
  hasAudio: boolean;
};

function run(
  bin: string,
  args: string[],
  opts?: { cwd?: string; captureStdout?: boolean },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (opts?.captureStdout) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 12_000) stderr = stderr.slice(-6_000);
    });
    child.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        reject(
          new Error(
            `${bin} introuvable — installez FFmpeg (brew install ffmpeg / apt install ffmpeg)`,
          ),
        );
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${bin} exit ${code}: ${stderr.slice(-1800)}`));
    });
  });
}

export function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  return run(ffmpegBin(), args, { cwd }).then(() => undefined);
}

export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  const raw = await run(
    ffprobeBin(),
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ],
    { captureStdout: true },
  );

  let parsed: {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error('ffprobe : JSON invalide');
  }

  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!video?.width || !video.height) {
    throw new Error('Aucune piste vidéo détectée');
  }
  const durationRaw =
    parsed.format?.duration ?? video.duration ?? null;
  const durationSec =
    durationRaw && Number.isFinite(Number(durationRaw))
      ? Math.max(1, Math.round(Number(durationRaw)))
      : null;
  const hasAudio = Boolean(
    parsed.streams?.some((s) => s.codec_type === 'audio'),
  );

  return {
    width: video.width,
    height: video.height,
    durationSec,
    hasAudio,
  };
}

export type HlsRung = {
  name: string;
  height: number;
  videoKbps: number;
  audioKbps: number;
};

export const HLS_LADDER: HlsRung[] = [
  { name: '1080p', height: 1080, videoKbps: 5000, audioKbps: 128 },
  { name: '720p', height: 720, videoKbps: 2800, audioKbps: 128 },
  { name: '480p', height: 480, videoKbps: 1400, audioKbps: 96 },
  { name: '360p', height: 360, videoKbps: 800, audioKbps: 96 },
];

export function pickHlsRungs(sourceHeight: number): HlsRung[] {
  const fit = HLS_LADDER.filter((r) => r.height <= sourceHeight + 16);
  const chosen = fit.length > 0 ? fit : [HLS_LADDER[HLS_LADDER.length - 1]!];
  return [...chosen].sort((a, b) => a.height - b.height);
}

export function evenWidth(sourceWidth: number, sourceHeight: number, height: number): number {
  const w = Math.round((sourceWidth * height) / sourceHeight);
  return Math.max(2, w - (w % 2));
}

export function buildMasterPlaylist(
  rungs: Array<HlsRung & { width: number }>,
  hasAudio: boolean,
): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  const ordered = [...rungs].sort((a, b) => a.videoKbps - b.videoKbps);
  for (const rung of ordered) {
    const bandwidth = (rung.videoKbps + (hasAudio ? rung.audioKbps : 0)) * 1000;
    const codecs = hasAudio ? 'avc1.4d401f,mp4a.40.2' : 'avc1.4d401f';
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rung.width}x${rung.height},CODECS="${codecs}"`,
      `${rung.name}/index.m3u8`,
    );
  }
  return `${lines.join('\n')}\n`;
}

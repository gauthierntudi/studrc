import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  createCanvas,
  type Canvas,
  type SKRSContext2D,
} from '@napi-rs/canvas';
import sharp from 'sharp';

export const PAGE_TARGET_WIDTH = 1400;
export const THUMB_TARGET_WIDTH = 200;
export const PAGE_WEBP_QUALITY = 80;
export const THUMB_WEBP_QUALITY = 72;

type CanvasAndContext = {
  canvas: Canvas;
  context: SKRSContext2D;
};

/** pdf.js Node canvas factory backed by @napi-rs/canvas. */
class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: CanvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

export type RasterizedPage = {
  pageNumber: number;
  width: number;
  height: number;
  image: Buffer;
  thumb: Buffer;
};

export type RasterizePdfOptions = {
  /** Reprise après crash : saute les pages déjà présentes (1-based, inclusif). */
  startPage?: number;
};

function resolveRustBinary(): string | null {
  const fromEnv = process.env.MAGAZINE_PAGES_RASTER_BIN?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    '/usr/local/bin/magazine-pages-raster',
    join(
      __dirname,
      '../../native/magazine-pages-raster/target/release/magazine-pages-raster',
    ),
    join(
      process.cwd(),
      'native/magazine-pages-raster/target/release/magazine-pages-raster',
    ),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function preferRust(): boolean {
  const mode = process.env.MAGAZINE_PAGES_RASTERIZER?.trim().toLowerCase();
  if (mode === 'node' || mode === 'pdfjs') return false;
  if (mode === 'rust') return true;
  // Auto : Rust si binaire dispo.
  return resolveRustBinary() != null;
}

type RustPageLine = {
  page?: number;
  total?: number;
  width?: number;
  height?: number;
  image?: string;
  thumb?: string;
  event?: string;
};

async function rasterizeWithRust(
  pdfBytes: Uint8Array,
  onPage: (
    page: RasterizedPage,
    done: number,
    total: number,
  ) => Promise<void> | void,
  options?: RasterizePdfOptions,
): Promise<number> {
  const bin = resolveRustBinary();
  if (!bin) {
    throw new Error('magazine-pages-raster binary not found');
  }

  const startPage = Math.max(1, options?.startPage ?? 1);
  const workDir = await mkdtemp(join(tmpdir(), 'opt1mum-pages-'));
  const pdfPath = join(workDir, 'source.pdf');
  const outDir = join(workDir, 'out');

  try {
    await writeFile(pdfPath, Buffer.from(pdfBytes));

    const args = [
      '--input',
      pdfPath,
      '--out-dir',
      outDir,
      '--start-page',
      String(startPage),
      '--width',
      String(PAGE_TARGET_WIDTH),
      '--thumb-width',
      String(THUMB_TARGET_WIDTH),
      '--quality',
      String(PAGE_WEBP_QUALITY),
      '--thumb-quality',
      String(THUMB_WEBP_QUALITY),
    ];
    const pdfiumDir = process.env.PDFIUM_DIR?.trim();
    if (pdfiumDir) {
      args.push('--pdfium', pdfiumDir);
    }

    // eslint-disable-next-line no-console
    console.log(`[magazine-pages] rasterizer=rust bin=${bin}`);

    let total = 0;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      const rl = createInterface({ input: child.stdout! });
      const pageQueue: Promise<void>[] = [];

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let parsed: RustPageLine;
        try {
          parsed = JSON.parse(trimmed) as RustPageLine;
        } catch {
          return;
        }

        if (parsed.event === 'meta' && typeof parsed.total === 'number') {
          total = parsed.total;
          return;
        }

        if (
          typeof parsed.page !== 'number' ||
          typeof parsed.image !== 'string' ||
          typeof parsed.thumb !== 'string'
        ) {
          return;
        }

        const pageNumber = parsed.page;
        const pageTotal = parsed.total ?? total;
        if (pageTotal > 0) total = pageTotal;

        const task = (async () => {
          const [image, thumb] = await Promise.all([
            readFile(parsed.image!),
            readFile(parsed.thumb!),
          ]);
          await onPage(
            {
              pageNumber,
              width: parsed.width ?? PAGE_TARGET_WIDTH,
              height: parsed.height ?? 1,
              image,
              thumb,
            },
            pageNumber,
            total || pageNumber,
          );
          // Free disk ASAP.
          await Promise.allSettled([
            rm(parsed.image!, { force: true }),
            rm(parsed.thumb!, { force: true }),
          ]);
        })();

        pageQueue.push(task);
        void task.catch(() => undefined);
      });

      child.on('error', reject);
      child.on('close', (code) => {
        void (async () => {
          try {
            await Promise.all(pageQueue);
            if (code === 0) resolve();
            else {
              reject(
                new Error(
                  `magazine-pages-raster exited ${code}: ${stderr.slice(0, 500)}`,
                ),
              );
            }
          } catch (err) {
            reject(err);
          }
        })();
      });
    });

    return total;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function rasterizeWithPdfJs(
  pdfBytes: Uint8Array,
  onPage: (
    page: RasterizedPage,
    done: number,
    total: number,
  ) => Promise<void> | void,
  options?: RasterizePdfOptions,
): Promise<number> {
  // eslint-disable-next-line no-console
  console.log('[magazine-pages] rasterizer=pdfjs');

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    disableFontFace: true,
    useSystemFonts: true,
    isEvalSupported: false,
    canvasFactory,
  } as Parameters<typeof pdfjs.getDocument>[0]);

  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const startPage = Math.max(1, Math.min(options?.startPage ?? 1, total + 1));

  try {
    for (let pageNumber = startPage; pageNumber <= total; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = PAGE_TARGET_WIDTH / base.width;
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.round(viewport.width));
      const height = Math.max(1, Math.round(viewport.height));

      const canvasAndContext = canvasFactory.create(width, height);
      const ctx = canvasAndContext.context;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      await page.render({
        canvas: canvasAndContext.canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        background: '#ffffff',
        intent: 'display',
        canvasFactory,
      } as unknown as Parameters<typeof page.render>[0]).promise;

      const png = Buffer.from(canvasAndContext.canvas.toBuffer('image/png'));
      canvasFactory.destroy(canvasAndContext);

      const image = await sharp(png)
        .webp({ quality: PAGE_WEBP_QUALITY, effort: 4 })
        .toBuffer();

      const thumb = await sharp(png)
        .resize({
          width: THUMB_TARGET_WIDTH,
          withoutEnlargement: true,
        })
        .webp({ quality: THUMB_WEBP_QUALITY, effort: 4 })
        .toBuffer();

      page.cleanup();

      await onPage({ pageNumber, width, height, image, thumb }, pageNumber, total);
    }
  } finally {
    await pdf.cleanup().catch(() => undefined);
  }

  return total;
}

/**
 * Rasterise page par page et appelle `onPage` immédiatement.
 * Préfère le binaire Rust (PDFium) si disponible — bien moins gourmand en RAM.
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  onPage: (
    page: RasterizedPage,
    done: number,
    total: number,
  ) => Promise<void> | void,
  options?: RasterizePdfOptions,
): Promise<number> {
  if (preferRust()) {
    try {
      return await rasterizeWithRust(pdfBytes, onPage, options);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[magazine-pages] rust rasterizer failed, falling back to pdfjs',
        err,
      );
    }
  }
  return rasterizeWithPdfJs(pdfBytes, onPage, options);
}

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

/**
 * Rasterise page par page et appelle `onPage` immédiatement
 * (évite de garder tout le magazine en RAM → concurrence worker plus sûre).
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  onPage: (page: RasterizedPage, done: number, total: number) => Promise<void> | void,
  options?: RasterizePdfOptions,
): Promise<number> {
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

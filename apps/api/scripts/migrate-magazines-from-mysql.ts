/**
 * Migration magazines legacy → Postgres (`magazines`).
 *
 * Sources (dans l’ordre) :
 *   1. LEGACY_MYSQL_URL  → table `magazine` (nécessite `mysql2`)
 *   2. LEGACY_SQL_DUMP   → fichier dump (défaut : database/schema.sql)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:magazines
 *   pnpm migrate:magazines -- --dry-run
 *
 * Env : DATABASE_URL, LEGACY_MYSQL_URL?, LEGACY_SQL_DUMP?
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { AccessType, Prisma, PrismaClient } from '@prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

type LegacyMagazine = {
  idmag: number;
  contenu: string | null;
  preview: string | null;
  file_download: string | null;
  coverMag: string | null;
  titreMag: string | null;
  description: string | null;
  vues: string | null;
  codeMag: string | null;
  dateAdd: Date | string | null;
  statusMag: number | null;
  typeMag: string | null;
  styleMag: string | null;
  priceMag: string | null;
  grande_entrevue: string | null;
  decryptage: string | null;
  entrevue_croisee: string | null;
  zoom: string | null;
  inspirationnel: string | null;
  game_changers: string | null;
  start_up: string | null;
  numeroMag: string | null;
  antidate: number | null;
  bgColor: string | null;
  themeColor: string | null;
  extraitMag: number | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function parseDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** "5,99" / "5.99" / "599" → centimes. */
function priceToCents(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  // Legacy stocke déjà des euros/dollars (ex. 5.99), pas des centimes.
  return Math.round(n * 100);
}

function mapAccessType(raw: string | null | undefined): AccessType {
  const t = (raw ?? '').trim().toUpperCase();
  if (t === 'FREE' || t === 'GRATUIT') return AccessType.FREE;
  return AccessType.PAID;
}

function mediaKey(
  raw: string | null | undefined,
  folder?: 'covers' | 'magazines/pdf',
): string | null {
  const t = clip(raw, 500);
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || t.includes('/')) return t;
  return folder ? `${folder}/${t}` : t;
}

function buildHighlights(row: LegacyMagazine): Prisma.InputJsonValue | undefined {
  const entries: Record<string, string> = {};
  const pairs: Array<[string, string | null]> = [
    ['grande_entrevue', row.grande_entrevue],
    ['decryptage', row.decryptage],
    ['entrevue_croisee', row.entrevue_croisee],
    ['zoom', row.zoom],
    ['inspirationnel', row.inspirationnel],
    ['game_changers', row.game_changers],
    ['start_up', row.start_up],
  ];
  for (const [key, value] of pairs) {
    const v = clip(value, 2000);
    if (v) entries[key] = v;
  }
  return Object.keys(entries).length ? entries : undefined;
}

function buildTheme(row: LegacyMagazine): Prisma.InputJsonValue | undefined {
  const theme: Record<string, string | number> = {};
  const bg = clip(row.bgColor, 40);
  const accent = clip(row.themeColor, 40);
  const style = clip(row.styleMag, 40);
  const code = clip(row.codeMag, 120);
  if (bg) theme.bgColor = bg;
  if (accent) theme.themeColor = accent;
  if (style) theme.styleMag = style;
  if (code) theme.codeMag = code;
  if (row.antidate != null) theme.antidate = Number(row.antidate) || 0;
  if (row.extraitMag != null) theme.extraitMag = Number(row.extraitMag) || 0;
  return Object.keys(theme).length ? theme : undefined;
}

function splitSqlValues(inner: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuote = false;
  let escape = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (inQuote) {
      if (escape) {
        cur += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        cur += ch;
        escape = true;
        continue;
      }
      if (ch === "'") {
        if (inner[i + 1] === "'") {
          cur += "''";
          i += 1;
          continue;
        }
        inQuote = false;
        cur += ch;
        continue;
      }
      cur += ch;
      continue;
    }

    if (ch === "'") {
      inQuote = true;
      cur += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function sqlLiteral(raw: string): string | null {
  const t = raw.trim();
  if (t.toUpperCase() === 'NULL') return null;
  if (t.startsWith("'") && t.endsWith("'")) {
    return t
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/\\\\/g, '\\');
  }
  return t;
}

function rowFromValues(cols: string[], values: string[]): LegacyMagazine | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const idmag = Number(map.get('idmag'));
  if (!Number.isFinite(idmag)) return null;
  return {
    idmag,
    contenu: map.get('contenu') ?? null,
    preview: map.get('preview') ?? null,
    file_download: map.get('file_download') ?? null,
    coverMag: map.get('coverMag') ?? null,
    titreMag: map.get('titreMag') ?? null,
    description: map.get('description') ?? null,
    vues: map.get('vues') ?? null,
    codeMag: map.get('codeMag') ?? null,
    dateAdd: map.get('dateAdd') ?? null,
    statusMag: map.get('statusMag') != null ? Number(map.get('statusMag')) : 1,
    typeMag: map.get('typeMag') ?? null,
    styleMag: map.get('styleMag') ?? null,
    priceMag: map.get('priceMag') ?? null,
    grande_entrevue: map.get('grande_entrevue') ?? null,
    decryptage: map.get('decryptage') ?? null,
    entrevue_croisee: map.get('entrevue_croisee') ?? null,
    zoom: map.get('zoom') ?? null,
    inspirationnel: map.get('inspirationnel') ?? null,
    game_changers: map.get('game_changers') ?? null,
    start_up: map.get('start_up') ?? null,
    numeroMag: map.get('numeroMag') ?? null,
    antidate: map.get('antidate') != null ? Number(map.get('antidate')) : 0,
    bgColor: map.get('bgColor') ?? null,
    themeColor: map.get('themeColor') ?? null,
    extraitMag: map.get('extraitMag') != null ? Number(map.get('extraitMag')) : 0,
  };
}

function parseInsertTable(sql: string, table: string): LegacyMagazine[] {
  const rows: LegacyMagazine[] = [];
  const insertRe = new RegExp(
    `INSERT\\s+INTO\\s+\`?${table}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*`,
    'gi',
  );
  let match: RegExpExecArray | null;

  while ((match = insertRe.exec(sql))) {
    const cols = match[1]!
      .split(',')
      .map((c) => c.trim().replace(/`/g, ''));
    let i = match.index + match[0].length;

    while (i < sql.length) {
      while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
      if (sql[i] !== '(') break;

      let depth = 0;
      let inQuote = false;
      let escape = false;
      const start = i;
      for (; i < sql.length; i++) {
        const ch = sql[i]!;
        if (inQuote) {
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === '\\') {
            escape = true;
            continue;
          }
          if (ch === "'") {
            if (sql[i + 1] === "'") {
              i += 1;
              continue;
            }
            inQuote = false;
          }
          continue;
        }
        if (ch === "'") {
          inQuote = true;
          continue;
        }
        if (ch === '(') depth += 1;
        if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }

      const tuple = sql.slice(start + 1, i - 1);
      const values = splitSqlValues(tuple);
      const row = rowFromValues(cols, values);
      if (row) rows.push(row);

      while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
      if (sql[i] === ',') {
        i += 1;
        continue;
      }
      if (sql[i] === ';') {
        i += 1;
        break;
      }
      break;
    }
  }

  return rows;
}

function loadFromSqlDump(filePath: string): LegacyMagazine[] {
  return parseInsertTable(readFileSync(filePath, 'utf8'), 'magazine');
}

async function loadFromMysql(url: string): Promise<LegacyMagazine[]> {
  let mysql: typeof import('mysql2/promise');
  try {
    mysql = await import('mysql2/promise');
  } catch {
    throw new Error(
      'Le package mysql2 est requis pour LEGACY_MYSQL_URL.\n' +
        '  pnpm --filter @studrc/api add mysql2\n' +
        'Ou utilisez LEGACY_SQL_DUMP=/chemin/vers/dump.sql',
    );
  }

  const conn = await mysql.createConnection(url);
  const [rows] = await conn.query(
    `SELECT
      idmag, contenu, preview, file_download, coverMag, titreMag, description,
      vues, codeMag, dateAdd, statusMag, typeMag, styleMag, priceMag,
      grande_entrevue, decryptage, entrevue_croisee, zoom, inspirationnel,
      game_changers, start_up, numeroMag, antidate, bgColor, themeColor, extraitMag
     FROM magazine
     ORDER BY idmag ASC`,
  );
  await conn.end();
  return rows as LegacyMagazine[];
}

async function loadRows(): Promise<{ rows: LegacyMagazine[]; source: string }> {
  const mysqlUrl = process.env.LEGACY_MYSQL_URL?.trim();
  if (mysqlUrl) {
    return { rows: await loadFromMysql(mysqlUrl), source: mysqlUrl };
  }

  const dumpPath = resolve(
    process.env.LEGACY_SQL_DUMP?.trim() ||
      resolve(process.cwd(), '../../../database/schema.sql'),
  );

  if (!existsSync(dumpPath)) {
    throw new Error(
      `Aucune source : définissez LEGACY_MYSQL_URL ou LEGACY_SQL_DUMP.\n` +
        `Dump introuvable : ${dumpPath}`,
    );
  }

  return { rows: loadFromSqlDump(dumpPath), source: dumpPath };
}

function toPayload(row: LegacyMagazine) {
  const title =
    clip(row.titreMag, 200) || `Magazine #${row.idmag}`;
  const accessType = mapAccessType(row.typeMag);
  const priceCents =
    accessType === AccessType.FREE ? null : priceToCents(row.priceMag);
  const isPublished = row.statusMag === 1 || row.statusMag === null;
  const createdAt = parseDate(row.dateAdd);
  const viewCount = Math.max(0, Number(row.vues) || 0);

  // contenu = fliphtml5 / lecteur ; file_download = PDF local
  const pdfKey =
    mediaKey(row.contenu) || mediaKey(row.file_download, 'magazines');
  const downloadKey = mediaKey(row.file_download, 'magazines');
  const previewKey = mediaKey(row.preview);
  // Couvertures → covers/{file} (servies via R2 CDN)
  const coverRaw = clip(row.coverMag, 500);
  const coverKey = coverRaw
    ? /^https?:\/\//i.test(coverRaw) || coverRaw.includes('/')
      ? coverRaw
      : `covers/${coverRaw}`
    : null;

  return {
    title,
    description: clip(row.description, 5000),
    issueNumber: clip(row.numeroMag, 40),
    accessType,
    priceCents,
    currency: 'USD',
    coverKey,
    pdfKey,
    previewKey,
    downloadKey,
    viewCount,
    theme: buildTheme(row),
    highlights: buildHighlights(row),
    isPublished,
    publishedAt: isPublished ? createdAt ?? new Date() : null,
    createdAt,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant (Postgres cible)');
  }

  console.log('— Migration magazines → Postgres —');
  console.log(`Mode : ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);

  const { rows, source } = await loadRows();
  console.log(`Source : ${source}`);
  console.log(`Lignes lues : ${rows.length}`);

  const stats = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const raw of rows) {
    const payload = toPayload(raw);
    const existing = await prisma.magazine.findUnique({
      where: { legacyId: raw.idmag },
    });

    if (DRY_RUN) {
      const action = existing ? 'update' : 'create';
      console.log(
        `[dry-run] ${action} legacyId=${raw.idmag} « ${payload.title} » ` +
          `(${payload.accessType}, ${payload.priceCents ?? 0}¢, ` +
          `${payload.isPublished ? 'publié' : 'brouillon'})`,
      );
      if (action === 'create') stats.created += 1;
      else stats.updated += 1;
      continue;
    }

    if (existing) {
      await prisma.magazine.update({
        where: { id: existing.id },
        data: {
          title: payload.title,
          description: payload.description,
          issueNumber: payload.issueNumber,
          accessType: payload.accessType,
          priceCents: payload.priceCents,
          currency: payload.currency,
          coverKey: payload.coverKey,
          pdfKey: payload.pdfKey,
          previewKey: payload.previewKey,
          downloadKey: payload.downloadKey,
          viewCount: payload.viewCount,
          theme: payload.theme ?? Prisma.JsonNull,
          highlights: payload.highlights ?? Prisma.JsonNull,
          isPublished: payload.isPublished,
          publishedAt: payload.publishedAt,
        },
      });
      stats.updated += 1;
      continue;
    }

    await prisma.magazine.create({
      data: {
        legacyId: raw.idmag,
        title: payload.title,
        description: payload.description,
        issueNumber: payload.issueNumber,
        accessType: payload.accessType,
        priceCents: payload.priceCents,
        currency: payload.currency,
        coverKey: payload.coverKey,
        pdfKey: payload.pdfKey,
        previewKey: payload.previewKey,
        downloadKey: payload.downloadKey,
        viewCount: payload.viewCount,
        theme: payload.theme,
        highlights: payload.highlights,
        isPublished: payload.isPublished,
        publishedAt: payload.publishedAt,
        ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
      },
    });
    stats.created += 1;
  }

  console.log('\n— Résumé —');
  console.log(stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

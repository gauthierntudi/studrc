/**
 * Migration actualités legacy → Postgres (`articles` + `article_blocks`).
 *
 * Mapping :
 *   titre        → Article.title
 *   contenu      → Article.excerpt (chapeau)
 *   cover        → Article.coverKey (`articles/{file}` — upload R2 ensuite)
 *   description  → ArticleBlock.content (1 section) + miroir Article.content
 *   categorie    → Article.category (slug v2)
 *
 * Sources (dans l’ordre) :
 *   1. LEGACY_MYSQL_URL  → table `actualites` (nécessite `mysql2`)
 *   2. LEGACY_SQL_DUMP   → fichier dump (défaut : database/schema.sql)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:articles
 *   pnpm migrate:articles -- --dry-run
 *
 * Ensuite : pnpm migrate:articles-r2
 *
 * Env : DATABASE_URL, LEGACY_MYSQL_URL?, LEGACY_SQL_DUMP?
 */
import { existsSync, readFileSync } from 'fs';
import { basename, resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

const CATEGORY_MAP: Record<string, string> = {
  '1': 'edito',
  '2': 'grandes-entrevues',
  '3': 'decryptages',
  '4': 'zoom',
  '5': 'entrevue-croisee',
  '6': 'start-up',
  '7': 'inspirationnel',
  '8': 'game-changers',
  '9': 'vus-sur-le-net',
};

type LegacyArticle = {
  id: number;
  titre: string | null;
  contenu: string | null;
  cover: string | null;
  description: string | null;
  typeActu: string | null;
  video: string | null;
  vues: string | null;
  categorie: string | null;
  idRedaction: number | null;
  status: number | null;
  dateAdd: Date | string | null;
  NumArticle: string | null;
  extrait_mag: string | null;
  antidate: number | null;
};

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = decodeBasicEntities(value).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/\\r\\n/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\r\n/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** HTML → texte pour le chapeau (legacy sans sections). */
function htmlToPlain(html: string): string {
  return decodeBasicEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/(div|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

function parseDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function mapCategory(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (CATEGORY_MAP[t]) return CATEGORY_MAP[t];
  const slug = slugify(t);
  return slug || null;
}

function coverKeyFromLegacy(raw: string | null | undefined): string | null {
  const t = clip(raw, 500);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const name = basename(t.replace(/\\/g, '/'));
  if (!name) return null;
  return `articles/${name}`;
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

function rowFromValues(cols: string[], values: string[]): LegacyArticle | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const id = Number(map.get('id'));
  if (!Number.isFinite(id)) return null;
  return {
    id,
    titre: map.get('titre') ?? null,
    contenu: map.get('contenu') ?? null,
    cover: map.get('cover') ?? null,
    description: map.get('description') ?? null,
    typeActu: map.get('typeActu') ?? null,
    video: map.get('video') ?? null,
    vues: map.get('vues') ?? null,
    categorie: map.get('categorie') ?? null,
    idRedaction:
      map.get('idRedaction') != null ? Number(map.get('idRedaction')) : null,
    status: map.get('status') != null ? Number(map.get('status')) : 1,
    dateAdd: map.get('dateAdd') ?? null,
    NumArticle: map.get('NumArticle') ?? null,
    extrait_mag: map.get('extrait_mag') ?? null,
    antidate: map.get('antidate') != null ? Number(map.get('antidate')) : 0,
  };
}

function parseInsertTable(sql: string, table: string): LegacyArticle[] {
  const rows: LegacyArticle[] = [];
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

function loadFromSqlDump(filePath: string): LegacyArticle[] {
  return parseInsertTable(readFileSync(filePath, 'utf8'), 'actualites');
}

async function loadFromMysql(url: string): Promise<LegacyArticle[]> {
  let mysql: typeof import('mysql2/promise');
  try {
    mysql = await import('mysql2/promise');
  } catch {
    throw new Error(
      'Le package mysql2 est requis pour LEGACY_MYSQL_URL.\n' +
        '  pnpm --filter @opt1mum/api add mysql2\n' +
        'Ou utilisez LEGACY_SQL_DUMP=/chemin/vers/dump.sql',
    );
  }

  const conn = await mysql.createConnection(url);
  const [rows] = await conn.query(
    `SELECT
      id, titre, contenu, cover, description, typeActu, video, vues,
      categorie, idRedaction, status, dateAdd, NumArticle, extrait_mag, antidate
     FROM actualites
     ORDER BY id ASC`,
  );
  await conn.end();
  return rows as LegacyArticle[];
}

async function loadRows(): Promise<{ rows: LegacyArticle[]; source: string }> {
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

async function ensureUniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base) || `article-${Date.now()}`;
  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const found = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!found || found.id === excludeId) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

function toPayload(row: LegacyArticle) {
  const title = clip(row.titre, 240) || `Article #${row.id}`;
  const description = decodeBasicEntities(row.description ?? '').trim();
  /**
   * Legacy = 1 seul corps HTML (`description`), pas de sections.
   * On met tout le texte dans le chapeau (excerpt) pour ne rien tronquer,
   * et on garde aussi le HTML dans la 1ʳᵉ section + miroir `content`.
   */
  const plainBody = htmlToPlain(description);
  const legacyLead = decodeBasicEntities(row.contenu ?? '').trim();
  const excerpt =
    [legacyLead, plainBody].filter(Boolean).join('\n\n') ||
    title;
  const isPublished = row.status === 1 || row.status === null;
  const createdAt = parseDate(row.dateAdd);
  const viewCount = Math.max(0, Number(row.vues) || 0);

  return {
    title,
    excerpt,
    content: description,
    coverKey: coverKeyFromLegacy(row.cover),
    category: mapCategory(row.categorie),
    viewCount,
    isPublished,
    publishedAt: isPublished ? createdAt ?? new Date() : null,
    createdAt,
  };
}

async function syncBodyBlock(articleId: string, html: string) {
  await prisma.articleBlock.deleteMany({ where: { articleId } });
  if (!html.trim()) return;
  await prisma.articleBlock.create({
    data: {
      articleId,
      position: 0,
      title: null,
      content: html,
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant (Postgres cible)');
  }

  console.log('— Migration actualités → Postgres —');
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
    const existing = await prisma.article.findUnique({
      where: { legacyId: raw.id },
      select: { id: true, slug: true },
    });

    if (DRY_RUN) {
      const action = existing ? 'update' : 'create';
      console.log(
        `[dry-run] ${action} legacyId=${raw.id} « ${payload.title} » ` +
          `(${payload.category ?? 'sans rubrique'}, ` +
          `${payload.isPublished ? 'publié' : 'brouillon'}, ` +
          `cover=${payload.coverKey ?? '—'})`,
      );
      if (action === 'create') stats.created += 1;
      else stats.updated += 1;
      continue;
    }

    if (existing) {
      const slug = await ensureUniqueSlug(payload.title, existing.id);
      await prisma.article.update({
        where: { id: existing.id },
        data: {
          title: payload.title,
          slug,
          excerpt: payload.excerpt,
          content: payload.content,
          coverKey: payload.coverKey,
          category: payload.category,
          viewCount: payload.viewCount,
          isPublished: payload.isPublished,
          publishedAt: payload.publishedAt,
        },
      });
      await syncBodyBlock(existing.id, payload.content);
      stats.updated += 1;
      continue;
    }

    const slug = await ensureUniqueSlug(
      `${payload.title}-${raw.id}`,
    );
    const created = await prisma.article.create({
      data: {
        legacyId: raw.id,
        title: payload.title,
        slug,
        excerpt: payload.excerpt,
        content: payload.content,
        coverKey: payload.coverKey,
        category: payload.category,
        viewCount: payload.viewCount,
        isPublished: payload.isPublished,
        publishedAt: payload.publishedAt,
        ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
      },
      select: { id: true },
    });
    await syncBodyBlock(created.id, payload.content);
    stats.created += 1;
  }

  console.log('\n— Résumé —');
  console.log(stats);
  console.log('\nEnsuite : pnpm migrate:articles-r2');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

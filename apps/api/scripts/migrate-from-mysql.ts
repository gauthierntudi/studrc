/**
 * Migration abonnés legacy → Postgres (`subscribers`).
 *
 * Sources (dans l’ordre) :
 *   1. LEGACY_MYSQL_URL  → table `abonne` (nécessite `pnpm add mysql2`)
 *   2. LEGACY_SQL_DUMP   → fichier dump (défaut : database/schema.sql)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:mysql
 *   pnpm migrate:mysql -- --dry-run
 *   pnpm migrate:mysql -- --force-reset   # hash factice → OTP obligatoire
 *
 * Env : DATABASE_URL, LEGACY_MYSQL_URL?, LEGACY_SQL_DUMP?
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE_RESET = args.has('--force-reset');

type LegacyAbonne = {
  idAb: number;
  nomAb: string | null;
  telAb: string | null;
  mailAb: string | null;
  mdp: string | null;
  pays: string | null;
  codePays: string | null;
  adresse_physique: string | null;
  codeAb: string | null;
  confirmation: string | null;
  dateAdd: Date | string | null;
  status: number | null;
};

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function isBcryptHash(hash: string | null | undefined): boolean {
  if (!hash) return false;
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

function parseDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

async function resolvePasswordHash(
  legacyHash: string | null,
): Promise<{ hash: string; keptLegacy: boolean; needsReset: boolean }> {
  if (FORCE_RESET || !isBcryptHash(legacyHash)) {
    const hash = await hashPassword(randomBytes(32).toString('hex'));
    return { hash, keptLegacy: false, needsReset: true };
  }
  return { hash: legacyHash!, keptLegacy: true, needsReset: false };
}

/** Parse une liste de littéraux SQL séparés par des virgules (niveau top). */
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
        // '' échappé SQL
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

function rowFromValues(cols: string[], values: string[]): LegacyAbonne | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const idAb = Number(map.get('idAb'));
  if (!Number.isFinite(idAb)) return null;
  return {
    idAb,
    nomAb: map.get('nomAb') ?? null,
    telAb: map.get('telAb') ?? null,
    mailAb: map.get('mailAb') ?? null,
    mdp: map.get('mdp') ?? null,
    pays: map.get('pays') ?? null,
    codePays: map.get('codePays') ?? null,
    adresse_physique: map.get('adresse_physique') ?? null,
    codeAb: map.get('codeAb') ?? null,
    confirmation: map.get('confirmation') ?? null,
    dateAdd: map.get('dateAdd') ?? null,
    status: map.get('status') != null ? Number(map.get('status')) : 1,
  };
}

/** Extrait les lignes `abonne` d’un dump mysqldump / phpMyAdmin. */
function loadFromSqlDump(filePath: string): LegacyAbonne[] {
  const sql = readFileSync(filePath, 'utf8');
  const rows: LegacyAbonne[] = [];

  const insertRe =
    /INSERT\s+INTO\s+`?abonne`?\s*\(([^)]+)\)\s*VALUES\s*/gi;
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

async function loadFromMysql(url: string): Promise<{
  rows: LegacyAbonne[];
  avatars: Map<number, string>;
}> {
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
      idAb, nomAb, telAb, mailAb, mdp, pays, codePays,
      adresse_physique, codeAb, confirmation, dateAdd, status
     FROM abonne
     ORDER BY idAb ASC`,
  );
  const [avatarRows] = await conn.query(
    `SELECT idAbonne, profilAbonne FROM images_abonne WHERE statusProfil = 1`,
  );
  await conn.end();

  const avatars = new Map<number, string>();
  for (const row of avatarRows as { idAbonne: string; profilAbonne: string }[]) {
    const id = Number(row.idAbonne);
    if (Number.isFinite(id) && row.profilAbonne) {
      avatars.set(id, row.profilAbonne);
    }
  }

  return { rows: rows as LegacyAbonne[], avatars };
}

function loadAvatarsFromSqlDump(filePath: string): Map<number, string> {
  const sql = readFileSync(filePath, 'utf8');
  const avatars = new Map<number, string>();
  const insertRe =
    /INSERT\s+INTO\s+`?images_abonne`?\s*\(([^)]+)\)\s*VALUES\s*/gi;
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

      const values = splitSqlValues(sql.slice(start + 1, i - 1));
      const map = new Map<string, string | null>();
      for (let c = 0; c < cols.length; c++) {
        map.set(cols[c]!, sqlLiteral(values[c] ?? 'NULL'));
      }
      const id = Number(map.get('idAbonne'));
      const file = map.get('profilAbonne');
      if (Number.isFinite(id) && file) avatars.set(id, file);

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

  return avatars;
}

async function loadRows(): Promise<{
  rows: LegacyAbonne[];
  avatars: Map<number, string>;
  source: string;
}> {
  const mysqlUrl = process.env.LEGACY_MYSQL_URL?.trim();
  if (mysqlUrl) {
    const data = await loadFromMysql(mysqlUrl);
    return { ...data, source: mysqlUrl };
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

  return {
    rows: loadFromSqlDump(dumpPath),
    avatars: loadAvatarsFromSqlDump(dumpPath),
    source: dumpPath,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant (Postgres cible)');
  }

  console.log('— Migration abonnés → Postgres —');
  console.log(`Mode : ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`);
  console.log(
    `Mots de passe : ${FORCE_RESET ? 'FORCE RESET (OTP)' : 'conserver bcrypt si valide'}`,
  );

  const { rows, avatars, source } = await loadRows();
  console.log(`Source : ${source}`);
  console.log(`Lignes lues : ${rows.length} · avatars : ${avatars.size}`);

  const stats = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    invalidEmail: 0,
    duplicateEmail: 0,
    keptHash: 0,
    needsReset: 0,
  };

  const seenEmails = new Set<string>();

  for (const raw of rows) {
    const email = normalizeEmail(raw.mailAb);
    if (!email) {
      stats.invalidEmail += 1;
      stats.skipped += 1;
      console.warn(`[skip] idAb=${raw.idAb} — email invalide (${raw.mailAb})`);
      continue;
    }

    if (seenEmails.has(email)) {
      stats.duplicateEmail += 1;
      stats.skipped += 1;
      console.warn(`[skip] idAb=${raw.idAb} — doublon email ${email}`);
      continue;
    }
    seenEmails.add(email);

    const { hash, keptLegacy, needsReset } = await resolvePasswordHash(raw.mdp);
    if (keptLegacy) stats.keptHash += 1;
    if (needsReset) stats.needsReset += 1;

    const name = clip(raw.nomAb, 120) || email.split('@')[0] || 'Abonné';
    const createdAt = parseDate(raw.dateAdd);
    const emailVerifiedAt =
      (raw.confirmation ?? '').toUpperCase() === 'OUI'
        ? createdAt ?? new Date()
        : null;

    const payload = {
      name,
      email,
      phone: clip(raw.telAb, 40),
      passwordHash: hash,
      country: clip(raw.pays, 120),
      countryCode: clip(raw.codePays, 16),
      address: clip(raw.adresse_physique, 500),
      subscriberCode: clip(raw.codeAb, 40),
      avatarKey: (() => {
        const file = avatars.get(raw.idAb);
        if (!file) return null;
        if (/^https?:\/\//i.test(file) || file.includes('/')) return file;
        return `profil/${file}`;
      })(),
      emailVerifiedAt,
      isActive: raw.status === 1 || raw.status === null,
    };

    const byLegacy = await prisma.subscriber.findUnique({
      where: { legacyId: raw.idAb },
    });
    const byEmail = await prisma.subscriber.findUnique({ where: { email } });

    if (DRY_RUN) {
      const action = byLegacy || byEmail ? 'update' : 'create';
      console.log(
        `[dry-run] ${action} ${email} (legacyId=${raw.idAb}, hash=${keptLegacy ? 'legacy' : 'reset'})`,
      );
      if (action === 'create') stats.created += 1;
      else stats.updated += 1;
      continue;
    }

    if (byLegacy) {
      await prisma.subscriber.update({
        where: { id: byLegacy.id },
        data: {
          name: payload.name,
          phone: payload.phone,
          country: payload.country,
          countryCode: payload.countryCode,
          address: payload.address,
          subscriberCode: payload.subscriberCode ?? byLegacy.subscriberCode,
          avatarKey: payload.avatarKey ?? byLegacy.avatarKey,
          emailVerifiedAt: payload.emailVerifiedAt ?? byLegacy.emailVerifiedAt,
          isActive: payload.isActive,
          passwordHash: payload.passwordHash,
        },
      });
      stats.updated += 1;
      continue;
    }

    if (byEmail) {
      await prisma.subscriber.update({
        where: { id: byEmail.id },
        data: {
          legacyId: raw.idAb,
          phone: byEmail.phone ?? payload.phone,
          country: byEmail.country ?? payload.country,
          countryCode: byEmail.countryCode ?? payload.countryCode,
          address: byEmail.address ?? payload.address,
          subscriberCode: byEmail.subscriberCode ?? payload.subscriberCode,
          avatarKey: byEmail.avatarKey ?? payload.avatarKey,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? payload.emailVerifiedAt,
        },
      });
      stats.updated += 1;
      console.log(`[link] ${email} → legacyId=${raw.idAb}`);
      continue;
    }

    await prisma.subscriber.create({
      data: {
        legacyId: raw.idAb,
        ...payload,
        ...(createdAt ? { createdAt } : {}),
      },
    });
    stats.created += 1;
  }

  console.log('\n— Résumé —');
  console.log(stats);
  if (stats.needsReset > 0) {
    console.log(
      `→ ${stats.needsReset} compte(s) devront utiliser « Mot de passe oublié » (OTP).`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

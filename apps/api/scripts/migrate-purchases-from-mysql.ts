/**
 * Migration achats magazines legacy → Postgres (`purchases` + `payments` PURCHASE).
 *
 * Prérequis :
 *   - abonnés migrés (`pnpm migrate:mysql`) avec `legacyId`
 *   - magazines migrés (`pnpm migrate:magazines`) avec `legacyId`
 *
 * Source (dans l’ordre) :
 *   1. LEGACY_MYSQL_URL  → table `paiement`
 *   2. LEGACY_SQL_DUMP   → dump (défaut : database/schema.sql)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:purchases
 *   pnpm migrate:purchases -- --dry-run
 *   pnpm migrate:purchases -- --skip-payments
 *
 * Env : DATABASE_URL, LEGACY_MYSQL_URL?, LEGACY_SQL_DUMP?
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const WITH_PAYMENTS = !args.has('--skip-payments');

type LegacyPaiement = {
  idpaie: number;
  price_Mag: string | null;
  id_Abonne: string | null;
  id_Mag: string | null;
  referenceTransactions: string | null;
  statusPaiement: string | null;
  dateAdd: Date | string | null;
  statusAchat: number | null;
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

function priceToCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function mapPaymentStatus(raw: string | null | undefined): PaymentStatus {
  const t = (raw ?? '').trim().toUpperCase();
  if (t === 'FINISH' || t === 'SUCCESS' || t === 'PAID' || t === 'OK') {
    return PaymentStatus.SUCCESS;
  }
  if (t === 'FAILED' || t === 'FAIL' || t === 'ERROR') {
    return PaymentStatus.FAILED;
  }
  if (t === 'CANCELLED' || t === 'CANCELED' || t === 'CANCEL') {
    return PaymentStatus.CANCELLED;
  }
  if (t === 'REFUNDED' || t === 'REFUND') {
    return PaymentStatus.REFUNDED;
  }
  return PaymentStatus.PENDING;
}

function parseLegacyInt(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function statusRank(status: PaymentStatus): number {
  switch (status) {
    case PaymentStatus.SUCCESS:
      return 4;
    case PaymentStatus.PENDING:
      return 3;
    case PaymentStatus.REFUNDED:
      return 2;
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELLED:
      return 1;
    default:
      return 0;
  }
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

function parseInsertTable<T>(
  sql: string,
  table: string,
  mapRow: (cols: string[], values: string[]) => T | null,
): T[] {
  const rows: T[] = [];
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
      const row = mapRow(cols, values);
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

function paiementFromValues(
  cols: string[],
  values: string[],
): LegacyPaiement | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const idpaie = Number(map.get('idpaie'));
  if (!Number.isFinite(idpaie)) return null;
  return {
    idpaie,
    price_Mag: map.get('price_Mag') ?? null,
    id_Abonne: map.get('id_Abonne') ?? null,
    id_Mag: map.get('id_Mag') ?? null,
    referenceTransactions: map.get('referenceTransactions') ?? null,
    statusPaiement: map.get('statusPaiement') ?? null,
    dateAdd: map.get('dateAdd') ?? null,
    statusAchat:
      map.get('statusAchat') != null ? Number(map.get('statusAchat')) : 1,
  };
}

function loadPaiementsFromDump(filePath: string): LegacyPaiement[] {
  return parseInsertTable(
    readFileSync(filePath, 'utf8'),
    'paiement',
    paiementFromValues,
  );
}

async function loadFromMysql(url: string): Promise<LegacyPaiement[]> {
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
  try {
    const [rows] = await conn.query(
      `SELECT idpaie, price_Mag, id_Abonne, id_Mag, referenceTransactions,
              statusPaiement, dateAdd, statusAchat
       FROM paiement
       ORDER BY idpaie ASC`,
    );
    return rows as LegacyPaiement[];
  } finally {
    await conn.end();
  }
}

async function resolveSource(): Promise<{
  paiements: LegacyPaiement[];
  sourceLabel: string;
}> {
  const mysqlUrl = process.env.LEGACY_MYSQL_URL?.trim();
  if (mysqlUrl) {
    return {
      paiements: await loadFromMysql(mysqlUrl),
      sourceLabel: 'LEGACY_MYSQL_URL',
    };
  }

  const dump =
    process.env.LEGACY_SQL_DUMP?.trim() ||
    resolve(process.cwd(), '../../../database/schema.sql');
  if (!existsSync(dump)) {
    throw new Error(
      `Dump introuvable : ${dump}\n` +
        'Définissez LEGACY_MYSQL_URL ou LEGACY_SQL_DUMP.',
    );
  }
  return {
    paiements: loadPaiementsFromDump(dump),
    sourceLabel: dump,
  };
}

async function migratePurchases(paiements: LegacyPaiement[]) {
  const [subscribers, magazines] = await Promise.all([
    prisma.subscriber.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true },
    }),
    prisma.magazine.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true },
    }),
  ]);

  const subscriberByLegacy = new Map<number, string>();
  for (const s of subscribers) {
    if (s.legacyId != null) subscriberByLegacy.set(s.legacyId, s.id);
  }
  const magazineByLegacy = new Map<number, string>();
  for (const m of magazines) {
    if (m.legacyId != null) magazineByLegacy.set(m.legacyId, m.id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingSubscriber = 0;
  let missingMagazine = 0;
  let invalidIds = 0;
  let paymentsUpserted = 0;
  let successCount = 0;

  // Déduplique (abonné+magazine) en gardant le meilleur statut / date.
  const bestByPair = new Map<string, LegacyPaiement>();
  for (const row of paiements) {
    const abonneId = parseLegacyInt(row.id_Abonne);
    const magId = parseLegacyInt(row.id_Mag);
    if (abonneId == null || magId == null) {
      invalidIds += 1;
      skipped += 1;
      continue;
    }
    const key = `${abonneId}:${magId}`;
    const prev = bestByPair.get(key);
    if (!prev) {
      bestByPair.set(key, row);
      continue;
    }
    const prevStatus = mapPaymentStatus(prev.statusPaiement);
    const nextStatus = mapPaymentStatus(row.statusPaiement);
    const prevRank = statusRank(prevStatus);
    const nextRank = statusRank(nextStatus);
    if (nextRank > prevRank) {
      bestByPair.set(key, row);
      continue;
    }
    if (nextRank === prevRank) {
      const prevDate = parseDate(prev.dateAdd)?.getTime() ?? 0;
      const nextDate = parseDate(row.dateAdd)?.getTime() ?? 0;
      if (nextDate >= prevDate) bestByPair.set(key, row);
    }
  }

  for (const row of bestByPair.values()) {
    const legacyAbonneId = parseLegacyInt(row.id_Abonne)!;
    const legacyMagId = parseLegacyInt(row.id_Mag)!;

    const subscriberId = subscriberByLegacy.get(legacyAbonneId);
    if (!subscriberId) {
      missingSubscriber += 1;
      skipped += 1;
      continue;
    }

    const magazineId = magazineByLegacy.get(legacyMagId);
    if (!magazineId) {
      missingMagazine += 1;
      skipped += 1;
      continue;
    }

    const paymentStatus = mapPaymentStatus(row.statusPaiement);
    if (paymentStatus === PaymentStatus.SUCCESS) successCount += 1;

    const amountCents = priceToCents(row.price_Mag) || 599;
    const createdAt = parseDate(row.dateAdd) ?? new Date('2020-01-01T00:00:00Z');
    const transactionRef = clip(row.referenceTransactions, 500);

    const existingByLegacy = await prisma.purchase.findUnique({
      where: { legacyId: row.idpaie },
      select: { id: true },
    });
    const existingByPair = await prisma.purchase.findUnique({
      where: {
        subscriberId_magazineId: { subscriberId, magazineId },
      },
      select: { id: true, legacyId: true, paymentStatus: true },
    });

    if (DRY_RUN) {
      if (existingByLegacy || existingByPair) updated += 1;
      else created += 1;
      if (WITH_PAYMENTS) paymentsUpserted += 1;
      continue;
    }

    let purchaseId: string;

    if (existingByLegacy) {
      const updatedPurchase = await prisma.purchase.update({
        where: { id: existingByLegacy.id },
        data: {
          subscriberId,
          magazineId,
          amountCents,
          currency: 'USD',
          paymentStatus,
          transactionRef,
          createdAt,
        },
        select: { id: true },
      });
      purchaseId = updatedPurchase.id;
      updated += 1;
    } else if (existingByPair) {
      // Même couple déjà migré sous un autre legacyId — on ne dégrade pas un SUCCESS.
      const keepSuccess =
        existingByPair.paymentStatus === PaymentStatus.SUCCESS &&
        paymentStatus !== PaymentStatus.SUCCESS;
      const updatedPurchase = await prisma.purchase.update({
        where: { id: existingByPair.id },
        data: {
          ...(keepSuccess
            ? {}
            : {
                paymentStatus,
                amountCents,
                transactionRef,
              }),
          ...(existingByPair.legacyId == null
            ? { legacyId: row.idpaie }
            : {}),
        },
        select: { id: true },
      });
      purchaseId = updatedPurchase.id;
      updated += 1;
    } else {
      const createdPurchase = await prisma.purchase.create({
        data: {
          legacyId: row.idpaie,
          subscriberId,
          magazineId,
          amountCents,
          currency: 'USD',
          paymentStatus,
          transactionRef,
          createdAt,
        },
        select: { id: true },
      });
      purchaseId = createdPurchase.id;
      created += 1;
    }

    if (WITH_PAYMENTS) {
      const providerRef = `paiement:${row.idpaie}`;
      try {
        await prisma.payment.upsert({
          where: {
            provider_providerRef: {
              provider: PaymentProvider.LEGACY,
              providerRef,
            },
          },
          create: {
            provider: PaymentProvider.LEGACY,
            providerRef,
            amountCents,
            currency: 'USD',
            status: paymentStatus,
            purpose: PaymentPurpose.PURCHASE,
            subscriberId,
            magazineId,
            metadata: {
              legacyPaiementId: row.idpaie,
              purchaseId,
              referenceTransactions: transactionRef,
              statusAchat: row.statusAchat,
            },
            createdAt,
          },
          update: {
            amountCents,
            status: paymentStatus,
            purpose: PaymentPurpose.PURCHASE,
            subscriberId,
            magazineId,
            metadata: {
              legacyPaiementId: row.idpaie,
              purchaseId,
              referenceTransactions: transactionRef,
              statusAchat: row.statusAchat,
            },
          },
        });
        paymentsUpserted += 1;
      } catch {
        /* collision rare */
      }
    }
  }

  return {
    created,
    updated,
    skipped,
    missingSubscriber,
    missingMagazine,
    invalidIds,
    paymentsUpserted,
    successCount,
    pairs: bestByPair.size,
  };
}

async function main() {
  console.log(
    DRY_RUN
      ? '=== Migration achats magazines (DRY-RUN) ==='
      : '=== Migration achats magazines ===',
  );

  const { paiements, sourceLabel } = await resolveSource();
  console.log(`Source : ${sourceLabel}`);
  console.log(`Paiements legacy (lignes) : ${paiements.length}`);

  const [subscriberCount, magazineCount] = await Promise.all([
    prisma.subscriber.count({ where: { legacyId: { not: null } } }),
    prisma.magazine.count({ where: { legacyId: { not: null } } }),
  ]);
  if (subscriberCount === 0) {
    throw new Error(
      'Aucun abonné avec legacyId. Lance d’abord : pnpm migrate:mysql',
    );
  }
  if (magazineCount === 0) {
    throw new Error(
      'Aucun magazine avec legacyId. Lance d’abord : pnpm migrate:magazines',
    );
  }
  console.log(
    `Mappables : ${subscriberCount} abonnés · ${magazineCount} magazines`,
  );

  const stats = await migratePurchases(paiements);
  console.log(`Paires abonné+magazine (après dédup) : ${stats.pairs}`);
  console.log(
    `Achats : ${stats.created} créés · ${stats.updated} mis à jour · ${stats.skipped} ignorés`,
  );
  console.log(`  ↳ SUCCESS (affichés dans Mes achats) : ${stats.successCount}`);
  if (stats.missingSubscriber) {
    console.log(`  ↳ abonné legacy introuvable : ${stats.missingSubscriber}`);
  }
  if (stats.missingMagazine) {
    console.log(`  ↳ magazine legacy introuvable : ${stats.missingMagazine}`);
  }
  if (stats.invalidIds) {
    console.log(`  ↳ id_Abonne / id_Mag invalide : ${stats.invalidIds}`);
  }
  if (WITH_PAYMENTS) {
    console.log(`Paiements LEGACY PURCHASE (upsert) : ${stats.paymentsUpserted}`);
  }

  if (!DRY_RUN) {
    const [purchaseTotal, successTotal] = await Promise.all([
      prisma.purchase.count(),
      prisma.purchase.count({
        where: { paymentStatus: PaymentStatus.SUCCESS },
      }),
    ]);
    console.log(
      `DB : ${purchaseTotal} purchases · ${successTotal} SUCCESS`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

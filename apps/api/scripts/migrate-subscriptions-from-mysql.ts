/**
 * Migration formules + abonnements legacy → Postgres (`plans`, `subscriptions`).
 *
 * Prérequis : abonnés déjà migrés (`pnpm migrate:mysql`) avec `legacyId`.
 *
 * Sources (dans l’ordre) :
 *   1. LEGACY_MYSQL_URL  → tables `formuleabonnement`, `abonnement`
 *   2. LEGACY_SQL_DUMP   → fichier dump (défaut : database/schema.sql)
 *
 * Usage (depuis v2/apps/api) :
 *   pnpm migrate:subscriptions
 *   pnpm migrate:subscriptions -- --dry-run
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
  SubscriptionStatus,
} from '@prisma/client';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const WITH_PAYMENTS = !args.has('--skip-payments');

type LegacyFormule = {
  idFormule: number;
  nomFormule: string | null;
  pricingFormule: string | null;
  durationFormule: number | null;
  descriptionFormule: string | null;
  statusFormule: number | null;
};

type LegacyAbonnement = {
  idabonnement: number;
  typeAbonnement: string | null;
  pricingAbonnement: string | null;
  statusPaiement: string | null;
  id_Abonne: string | null;
  id_Formule: string | null;
  referenceTransactions: string | null;
  delai: string | null;
  dateAdd: Date | string | null;
  dateExp: Date | string | null;
  deviceAbonne: string | null;
  statusAbonnement: number | null;
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

function mapSubscriptionStatus(
  rawStatus: number | null | undefined,
  expiresAt: Date,
  paymentStatus: PaymentStatus,
  now: Date,
): SubscriptionStatus {
  if (rawStatus === 0 || rawStatus === 2) {
    return SubscriptionStatus.CANCELLED;
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return SubscriptionStatus.EXPIRED;
  }
  if (paymentStatus !== PaymentStatus.SUCCESS) {
    // Legacy stocke souvent status=1 même si non payé.
    return SubscriptionStatus.ACTIVE;
  }
  return SubscriptionStatus.ACTIVE;
}

function parseLegacyAbonneId(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLegacyFormuleId(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
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

function formuleFromValues(
  cols: string[],
  values: string[],
): LegacyFormule | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const idFormule = Number(map.get('idFormule'));
  if (!Number.isFinite(idFormule)) return null;
  return {
    idFormule,
    nomFormule: map.get('nomFormule') ?? null,
    pricingFormule: map.get('pricingFormule') ?? null,
    durationFormule:
      map.get('durationFormule') != null
        ? Number(map.get('durationFormule'))
        : null,
    descriptionFormule: map.get('descriptionFormule') ?? null,
    statusFormule:
      map.get('statusFormule') != null ? Number(map.get('statusFormule')) : 1,
  };
}

function abonnementFromValues(
  cols: string[],
  values: string[],
): LegacyAbonnement | null {
  const map = new Map<string, string | null>();
  for (let i = 0; i < cols.length; i++) {
    map.set(cols[i]!, sqlLiteral(values[i] ?? 'NULL'));
  }
  const idabonnement = Number(map.get('idabonnement'));
  if (!Number.isFinite(idabonnement)) return null;
  return {
    idabonnement,
    typeAbonnement: map.get('typeAbonnement') ?? null,
    pricingAbonnement: map.get('pricingAbonnement') ?? null,
    statusPaiement: map.get('statusPaiement') ?? null,
    id_Abonne: map.get('id_Abonne') ?? null,
    id_Formule: map.get('id_Formule') ?? null,
    referenceTransactions: map.get('referenceTransactions') ?? null,
    delai: map.get('delai') ?? null,
    dateAdd: map.get('dateAdd') ?? null,
    dateExp: map.get('dateExp') ?? null,
    deviceAbonne: map.get('deviceAbonne') ?? null,
    statusAbonnement:
      map.get('statusAbonnement') != null
        ? Number(map.get('statusAbonnement'))
        : 1,
  };
}

function loadFormulesFromDump(filePath: string): LegacyFormule[] {
  return parseInsertTable(
    readFileSync(filePath, 'utf8'),
    'formuleabonnement',
    formuleFromValues,
  );
}

function loadAbonnementsFromDump(filePath: string): LegacyAbonnement[] {
  return parseInsertTable(
    readFileSync(filePath, 'utf8'),
    'abonnement',
    abonnementFromValues,
  );
}

async function loadFromMysql(url: string): Promise<{
  formules: LegacyFormule[];
  abonnements: LegacyAbonnement[];
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
  try {
    const [formuleRows] = await conn.query(
      `SELECT idFormule, nomFormule, pricingFormule, durationFormule,
              descriptionFormule, statusFormule
       FROM formuleabonnement
       ORDER BY idFormule ASC`,
    );
    const [aboRows] = await conn.query(
      `SELECT idabonnement, typeAbonnement, pricingAbonnement, statusPaiement,
              id_Abonne, id_Formule, referenceTransactions, delai,
              dateAdd, dateExp, deviceAbonne, statusAbonnement
       FROM abonnement
       ORDER BY idabonnement ASC`,
    );
    return {
      formules: formuleRows as LegacyFormule[],
      abonnements: aboRows as LegacyAbonnement[],
    };
  } finally {
    await conn.end();
  }
}

async function resolveSource(): Promise<{
  formules: LegacyFormule[];
  abonnements: LegacyAbonnement[];
  sourceLabel: string;
}> {
  const mysqlUrl = process.env.LEGACY_MYSQL_URL?.trim();
  if (mysqlUrl) {
    const data = await loadFromMysql(mysqlUrl);
    return { ...data, sourceLabel: 'LEGACY_MYSQL_URL' };
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
    formules: loadFormulesFromDump(dump),
    abonnements: loadAbonnementsFromDump(dump),
    sourceLabel: dump,
  };
}

async function migratePlans(formules: LegacyFormule[]) {
  let created = 0;
  let updated = 0;
  const planByLegacy = new Map<number, string>();

  for (const row of formules) {
    const name = clip(row.nomFormule, 200) || `Formule ${row.idFormule}`;
    const priceCents = priceToCents(row.pricingFormule);
    const durationDays =
      row.durationFormule && row.durationFormule > 0
        ? row.durationFormule
        : 365;
    const description = clip(row.descriptionFormule, 5000);
    const isActive = row.statusFormule !== 0;

    const existing = await prisma.plan.findUnique({
      where: { legacyId: row.idFormule },
      select: { id: true },
    });

    if (DRY_RUN) {
      planByLegacy.set(row.idFormule, existing?.id ?? `dry-plan-${row.idFormule}`);
      if (existing) updated += 1;
      else created += 1;
      continue;
    }

    const plan = await prisma.plan.upsert({
      where: { legacyId: row.idFormule },
      create: {
        legacyId: row.idFormule,
        name,
        description,
        priceCents,
        currency: 'USD',
        durationDays,
        isActive,
      },
      update: {
        name,
        description,
        priceCents,
        durationDays,
        isActive,
      },
      select: { id: true },
    });
    planByLegacy.set(row.idFormule, plan.id);
    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, planByLegacy };
}

async function migrateSubscriptions(
  abonnements: LegacyAbonnement[],
  planByLegacy: Map<number, string>,
) {
  const now = new Date();
  const subscribers = await prisma.subscriber.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const subscriberByLegacy = new Map<number, string>();
  for (const s of subscribers) {
    if (s.legacyId != null) subscriberByLegacy.set(s.legacyId, s.id);
  }

  // Fallback plan : première formule, ou créée à la volée.
  let fallbackPlanId = planByLegacy.values().next().value as string | undefined;
  if (!fallbackPlanId && !DRY_RUN) {
    const any = await prisma.plan.findFirst({ select: { id: true } });
    fallbackPlanId = any?.id;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingSubscriber = 0;
  let invalidAbonne = 0;
  let paymentsUpserted = 0;

  for (const row of abonnements) {
    const legacyAbonneId = parseLegacyAbonneId(row.id_Abonne);
    if (legacyAbonneId == null) {
      invalidAbonne += 1;
      skipped += 1;
      continue;
    }

    const subscriberId = subscriberByLegacy.get(legacyAbonneId);
    if (!subscriberId) {
      missingSubscriber += 1;
      skipped += 1;
      continue;
    }

    const legacyFormuleId = parseLegacyFormuleId(row.id_Formule) ?? 1;
    let planId = planByLegacy.get(legacyFormuleId) ?? fallbackPlanId;
    if (!planId) {
      skipped += 1;
      continue;
    }

    const paymentStatus = mapPaymentStatus(row.statusPaiement);
    const startsAt =
      parseDate(row.dateAdd) ??
      parseDate(row.dateExp) ??
      new Date('2020-01-01T00:00:00Z');
    let expiresAt = parseDate(row.dateExp);
    if (!expiresAt) {
      const days = Number(row.delai) || 365;
      expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const status = mapSubscriptionStatus(
      row.statusAbonnement,
      expiresAt,
      paymentStatus,
      now,
    );
    const transactionRef = clip(row.referenceTransactions, 500);

    const existing = await prisma.subscription.findUnique({
      where: { legacyId: row.idabonnement },
      select: { id: true },
    });

    if (DRY_RUN) {
      if (existing) updated += 1;
      else created += 1;
      if (WITH_PAYMENTS && transactionRef && paymentStatus === PaymentStatus.SUCCESS) {
        paymentsUpserted += 1;
      }
      continue;
    }

    const subscription = await prisma.subscription.upsert({
      where: { legacyId: row.idabonnement },
      create: {
        legacyId: row.idabonnement,
        subscriberId,
        planId,
        status,
        paymentStatus,
        transactionRef,
        startsAt,
        expiresAt,
      },
      update: {
        subscriberId,
        planId,
        status,
        paymentStatus,
        transactionRef,
        startsAt,
        expiresAt,
      },
      select: { id: true },
    });

    if (existing) updated += 1;
    else created += 1;

    if (
      WITH_PAYMENTS &&
      transactionRef &&
      (paymentStatus === PaymentStatus.SUCCESS ||
        paymentStatus === PaymentStatus.PENDING)
    ) {
      const amountCents = priceToCents(row.pricingAbonnement);
      try {
        await prisma.payment.upsert({
          where: {
            provider_providerRef: {
              provider: PaymentProvider.LEGACY,
              providerRef: transactionRef,
            },
          },
          create: {
            provider: PaymentProvider.LEGACY,
            providerRef: transactionRef,
            amountCents: amountCents || 1999,
            currency: 'USD',
            status: paymentStatus,
            purpose: PaymentPurpose.SUBSCRIPTION,
            subscriberId,
            planId,
            metadata: {
              legacySubscriptionId: row.idabonnement,
              subscriptionId: subscription.id,
              typeAbonnement: row.typeAbonnement,
              deviceAbonne: row.deviceAbonne,
            },
            createdAt: startsAt,
          },
          update: {
            amountCents: amountCents || 1999,
            status: paymentStatus,
            purpose: PaymentPurpose.SUBSCRIPTION,
            subscriberId,
            planId,
            metadata: {
              legacySubscriptionId: row.idabonnement,
              subscriptionId: subscription.id,
              typeAbonnement: row.typeAbonnement,
              deviceAbonne: row.deviceAbonne,
            },
          },
        });
        paymentsUpserted += 1;
      } catch {
        // Collision possible si même ref pour plusieurs lignes — ignore.
      }
    }
  }

  return {
    created,
    updated,
    skipped,
    missingSubscriber,
    invalidAbonne,
    paymentsUpserted,
  };
}

async function main() {
  console.log(
    DRY_RUN
      ? '=== Migration abonnements (DRY-RUN) ==='
      : '=== Migration abonnements ===',
  );

  const { formules, abonnements, sourceLabel } = await resolveSource();
  console.log(`Source : ${sourceLabel}`);
  console.log(`Formules legacy : ${formules.length}`);
  console.log(`Abonnements legacy : ${abonnements.length}`);

  const subscriberCount = await prisma.subscriber.count({
    where: { legacyId: { not: null } },
  });
  if (subscriberCount === 0) {
    throw new Error(
      'Aucun abonné avec legacyId. Lance d’abord : pnpm migrate:mysql',
    );
  }
  console.log(`Abonnés mappables (legacyId) : ${subscriberCount}`);

  const plans = await migratePlans(formules);
  console.log(
    `Plans : ${plans.created} créés · ${plans.updated} mis à jour`,
  );

  const subs = await migrateSubscriptions(abonnements, plans.planByLegacy);
  console.log(
    `Abonnements : ${subs.created} créés · ${subs.updated} mis à jour · ${subs.skipped} ignorés`,
  );
  if (subs.missingSubscriber) {
    console.log(`  ↳ abonné legacy introuvable : ${subs.missingSubscriber}`);
  }
  if (subs.invalidAbonne) {
    console.log(`  ↳ id_Abonne invalide (skip) : ${subs.invalidAbonne}`);
  }
  if (WITH_PAYMENTS) {
    console.log(`Paiements LEGACY (upsert) : ${subs.paymentsUpserted}`);
  }

  if (!DRY_RUN) {
    const [planTotal, subTotal, activeNow] = await Promise.all([
      prisma.plan.count(),
      prisma.subscription.count(),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          paymentStatus: PaymentStatus.SUCCESS,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    console.log(
      `DB : ${planTotal} plans · ${subTotal} abonnements · ${activeNow} en cours`,
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

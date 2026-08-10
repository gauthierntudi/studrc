import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRole, MagazinePagesStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { logSystemActivity } from '../activity/log-system-activity';
import {
  createMagazinePagesQueue,
  createMagazinePagesUrgentQueue,
  createRedisConnection,
} from '../magazines/pages/magazine-pages.queue';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { createR2ClientFromEnv, headR2Object } from '../storage/r2';
import {
  MONITORING_ALERT_COOLDOWN_KEY,
  MONITORING_ALERT_COOLDOWN_SEC,
  WORKER_HEARTBEAT_KEY,
} from './monitoring.constants';

export type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';

export type ServiceCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  latencyMs: number | null;
  detail: string | null;
};

export type PagesPipelineSnapshot = {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  queues: {
    urgent: Record<string, number>;
    bulk: Record<string, number>;
  };
  stuck: {
    id: string;
    title: string;
    pagesStatus: MagazinePagesStatus;
    generatedPageCount: number;
    pagesError: string | null;
    updatedAt: string;
  }[];
  recentFailed: {
    id: string;
    title: string;
    pagesError: string | null;
    updatedAt: string;
  }[];
};

export type MonitoringSnapshot = {
  overall: CheckStatus;
  checkedAt: string;
  services: ServiceCheck[];
  pages: PagesPipelineSnapshot;
  alertsEnabled: boolean;
};

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private alertTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>('MONITORING_ALERT_INTERVAL_MS')?.trim();
    const intervalMs = raw ? Number(raw) : 5 * 60_000;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

    // Boot delay then periodic alert evaluation (superadmins only).
    setTimeout(() => void this.evaluateAlerts().catch(() => undefined), 20_000);
    this.alertTimer = setInterval(
      () => void this.evaluateAlerts().catch(() => undefined),
      Math.max(60_000, Math.min(intervalMs, 60 * 60_000)),
    );
  }

  onModuleDestroy() {
    if (this.alertTimer) clearInterval(this.alertTimer);
  }

  async getSnapshot(): Promise<MonitoringSnapshot> {
    const [api, database, redis, r2, web, cdn, worker, pages] =
      await Promise.all([
        this.checkApiSelf(),
        this.checkDatabase(),
        this.checkRedis(),
        this.checkR2(),
        this.checkWeb(),
        this.checkCdn(),
        this.checkWorker(),
        this.snapshotPagesPipeline(),
      ]);

    const services = [api, database, redis, r2, web, cdn, worker];
    const overall = this.aggregateStatus([
      ...services.map((s) => s.status),
      pages.failed > 0 || pages.stuck.length > 0 ? 'degraded' : 'up',
    ]);

    return {
      overall,
      checkedAt: new Date().toISOString(),
      services,
      pages,
      alertsEnabled: this.alertsEnabled(),
    };
  }

  async evaluateAlerts(): Promise<{ sent: boolean; reason: string }> {
    if (!this.alertsEnabled()) {
      return { sent: false, reason: 'disabled' };
    }

    const snap = await this.getSnapshot();
    const issues = this.collectIssues(snap);
    if (issues.length === 0) {
      return { sent: false, reason: 'healthy' };
    }

    const connection = createRedisConnection();
    try {
      const cooling = await connection.get(MONITORING_ALERT_COOLDOWN_KEY);
      if (cooling) {
        return { sent: false, reason: 'cooldown' };
      }

      const supers = await this.prisma.adminUser.findMany({
        where: { role: AdminRole.SUPERADMIN, isActive: true },
        select: { email: true, name: true },
      });
      if (supers.length === 0) {
        return { sent: false, reason: 'no-superadmins' };
      }

      const subject = `[Opt1mum] Monitoring — ${snap.overall.toUpperCase()}`;
      const html = this.buildAlertHtml(snap, issues);
      for (const admin of supers) {
        await this.mail.sendRaw({
          to: admin.email,
          subject,
          html,
        });
      }

      await connection.set(
        MONITORING_ALERT_COOLDOWN_KEY,
        new Date().toISOString(),
        'EX',
        MONITORING_ALERT_COOLDOWN_SEC,
      );

      await logSystemActivity(this.prisma, {
        action: 'monitoring_alert_sent',
        entity: 'monitoring',
        entityId: snap.overall,
        meta: {
          overall: snap.overall,
          issues,
          recipients: supers.map((s) => s.email),
        },
      });

      this.logger.warn(
        `Monitoring alert sent to ${supers.length} superadmin(s): ${issues.join('; ')}`,
      );
      return { sent: true, reason: 'sent' };
    } finally {
      connection.disconnect();
    }
  }

  private alertsEnabled(): boolean {
    const raw = this.config.get<string>('MONITORING_ALERTS')?.trim().toLowerCase();
    if (!raw) return true; // on by default once Resend is configured
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  private collectIssues(snap: MonitoringSnapshot): string[] {
    const issues: string[] = [];
    for (const s of snap.services) {
      if (s.status === 'down') {
        issues.push(`${s.label}: down${s.detail ? ` (${s.detail})` : ''}`);
      } else if (s.status === 'degraded') {
        issues.push(`${s.label}: degraded${s.detail ? ` (${s.detail})` : ''}`);
      }
    }
    if (snap.pages.stuck.length > 0) {
      issues.push(
        `${snap.pages.stuck.length} magazine(s) PROCESSING bloqué(s)`,
      );
    }
    if (snap.pages.failed > 0) {
      issues.push(`${snap.pages.failed} magazine(s) FAILED`);
    }
    return issues;
  }

  private buildAlertHtml(snap: MonitoringSnapshot, issues: string[]): string {
    const appUrl = (
      this.config.get<string>('APP_URL') ?? 'https://opt1mum.com'
    ).replace(/\/$/, '');
    const rows = issues
      .map((i) => `<li style="margin:0.35rem 0;">${escapeHtml(i)}</li>`)
      .join('');
    return `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5;">
        <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#e9262a;">OPT1MUM MONITORING</p>
        <p style="margin:1rem 0 0.5rem;font-size:20px;font-weight:800;">État : ${escapeHtml(snap.overall)}</p>
        <p style="margin:0 0 1rem;color:#555;">Vérifié à ${escapeHtml(snap.checkedAt)}</p>
        <ul style="padding-left:1.2rem;">${rows}</ul>
        <p style="margin:1.5rem 0;">
          <a href="${escapeHtml(appUrl)}/admin/monitoring"
             style="display:inline-block;padding:12px 18px;background:#0d203d;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Ouvrir le monitoring
          </a>
        </p>
      </div>
    `;
  }

  private async checkApiSelf(): Promise<ServiceCheck> {
    const t0 = Date.now();
    return {
      id: 'api',
      label: 'API',
      status: 'up',
      latencyMs: Date.now() - t0,
      detail: 'opt1mum-api',
    };
  }

  private async checkDatabase(): Promise<ServiceCheck> {
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        id: 'database',
        label: 'PostgreSQL',
        status: 'up',
        latencyMs: Date.now() - t0,
        detail: null,
      };
    } catch (err) {
      return {
        id: 'database',
        label: 'PostgreSQL',
        status: 'down',
        latencyMs: Date.now() - t0,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'error',
      };
    }
  }

  private async checkRedis(): Promise<ServiceCheck> {
    const t0 = Date.now();
    let connection;
    try {
      connection = createRedisConnection();
      const pong = await connection.ping();
      return {
        id: 'redis',
        label: 'Redis',
        status: pong === 'PONG' ? 'up' : 'degraded',
        latencyMs: Date.now() - t0,
        detail: pong,
      };
    } catch (err) {
      return {
        id: 'redis',
        label: 'Redis',
        status: 'down',
        latencyMs: Date.now() - t0,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'error',
      };
    } finally {
      connection?.disconnect();
    }
  }

  private async checkR2(): Promise<ServiceCheck> {
    const t0 = Date.now();
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      return {
        id: 'r2',
        label: 'R2 (API)',
        status: 'down',
        latencyMs: null,
        detail: 'Credentials manquants',
      };
    }
    try {
      const probe = await this.prisma.magazine.findFirst({
        where: {
          OR: [
            { coverKey: { not: null } },
            { downloadKey: { not: null } },
          ],
        },
        select: { coverKey: true, downloadKey: true },
        orderBy: { updatedAt: 'desc' },
      });
      const key = probe?.coverKey || probe?.downloadKey;
      if (!key) {
        return {
          id: 'r2',
          label: 'R2 (API)',
          status: 'degraded',
          latencyMs: Date.now() - t0,
          detail: 'Config OK — aucun objet probe',
        };
      }
      const meta = await headR2Object(r2, key);
      return {
        id: 'r2',
        label: 'R2 (API)',
        status: meta ? 'up' : 'down',
        latencyMs: Date.now() - t0,
        detail: meta ? `bucket ${r2.bucket}` : `Objet introuvable: ${key}`,
      };
    } catch (err) {
      return {
        id: 'r2',
        label: 'R2 (API)',
        status: 'down',
        latencyMs: Date.now() - t0,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'error',
      };
    }
  }

  private async checkWeb(): Promise<ServiceCheck> {
    const appUrl = (
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      ''
    ).replace(/\/$/, '');
    if (!appUrl) {
      return {
        id: 'web',
        label: 'Web',
        status: 'unknown',
        latencyMs: null,
        detail: 'APP_URL non défini',
      };
    }
    return this.httpCheck('web', 'Web / Nginx', appUrl, [200, 301, 302, 308]);
  }

  private async checkCdn(): Promise<ServiceCheck> {
    const r2 = createR2ClientFromEnv();
    const publicUrl = r2?.publicUrl?.replace(/\/$/, '') ?? '';
    if (!publicUrl) {
      return {
        id: 'cdn',
        label: 'CDN R2',
        status: 'unknown',
        latencyMs: null,
        detail: 'R2_PUBLIC_URL non défini',
      };
    }

    const probe = await this.prisma.magazine.findFirst({
      where: { coverKey: { not: null } },
      select: { coverKey: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!probe?.coverKey) {
      return {
        id: 'cdn',
        label: 'CDN R2',
        status: 'degraded',
        latencyMs: null,
        detail: 'Aucune cover pour probe CDN',
      };
    }
    const url = `${publicUrl}/${probe.coverKey.replace(/^\//, '')}`;
    return this.httpCheck('cdn', 'CDN R2', url, [200]);
  }

  private async checkWorker(): Promise<ServiceCheck> {
    const t0 = Date.now();
    let connection;
    try {
      connection = createRedisConnection();
      const raw = await connection.get(WORKER_HEARTBEAT_KEY);
      if (!raw) {
        return {
          id: 'worker',
          label: 'Worker pages',
          status: 'down',
          latencyMs: Date.now() - t0,
          detail: 'Pas de heartbeat (worker down ou jamais démarré)',
        };
      }
      const parsed = JSON.parse(raw) as {
        at?: string;
        urgent?: number;
        bulk?: number;
      };
      const at = parsed.at ? new Date(parsed.at).getTime() : NaN;
      const ageSec = Number.isFinite(at)
        ? Math.round((Date.now() - at) / 1000)
        : null;
      const stale = ageSec != null && ageSec > 120;
      return {
        id: 'worker',
        label: 'Worker pages',
        status: stale ? 'degraded' : 'up',
        latencyMs: Date.now() - t0,
        detail:
          ageSec != null
            ? `heartbeat il y a ${ageSec}s` +
              (parsed.urgent != null
                ? ` · urgent×${parsed.urgent} bulk×${parsed.bulk}`
                : '')
            : 'heartbeat présent',
      };
    } catch (err) {
      return {
        id: 'worker',
        label: 'Worker pages',
        status: 'down',
        latencyMs: Date.now() - t0,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'error',
      };
    } finally {
      connection?.disconnect();
    }
  }

  private async snapshotPagesPipeline(): Promise<PagesPipelineSnapshot> {
    const [grouped, stuckRows, failedRows, queues] = await Promise.all([
      this.prisma.magazine.groupBy({
        by: ['pagesStatus'],
        _count: { _all: true },
        where: { downloadKey: { not: null } },
      }),
      this.prisma.magazine.findMany({
        where: {
          downloadKey: { not: null },
          pagesStatus: MagazinePagesStatus.PROCESSING,
          updatedAt: { lt: new Date(Date.now() - 15 * 60_000) },
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        select: {
          id: true,
          title: true,
          pagesStatus: true,
          pagesError: true,
          updatedAt: true,
          _count: { select: { pages: true } },
        },
      }),
      this.prisma.magazine.findMany({
        where: {
          downloadKey: { not: null },
          pagesStatus: MagazinePagesStatus.FAILED,
        },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: {
          id: true,
          title: true,
          pagesError: true,
          updatedAt: true,
        },
      }),
      this.getQueueCounts(),
    ]);

    const counts: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      READY: 0,
      FAILED: 0,
    };
    for (const row of grouped) {
      counts[row.pagesStatus] = row._count._all;
    }

    return {
      pending: counts.PENDING,
      processing: counts.PROCESSING,
      ready: counts.READY,
      failed: counts.FAILED,
      queues,
      stuck: stuckRows.map((m) => ({
        id: m.id,
        title: m.title,
        pagesStatus: m.pagesStatus,
        generatedPageCount: m._count.pages,
        pagesError: m.pagesError,
        updatedAt: m.updatedAt.toISOString(),
      })),
      recentFailed: failedRows.map((m) => ({
        id: m.id,
        title: m.title,
        pagesError: m.pagesError,
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  }

  private async getQueueCounts(): Promise<PagesPipelineSnapshot['queues']> {
    const empty = { waiting: 0, active: 0, delayed: 0, failed: 0 };
    let connection;
    let urgentQ: Queue | null = null;
    let bulkQ: Queue | null = null;
    try {
      connection = createRedisConnection();
      urgentQ = createMagazinePagesUrgentQueue(connection);
      bulkQ = createMagazinePagesQueue(connection);
      const [urgent, bulk] = await Promise.all([
        urgentQ.getJobCounts('waiting', 'active', 'delayed', 'failed', 'prioritized'),
        bulkQ.getJobCounts('waiting', 'active', 'delayed', 'failed', 'prioritized'),
      ]);
      return {
        urgent: {
          waiting: (urgent.waiting ?? 0) + (urgent.prioritized ?? 0),
          active: urgent.active ?? 0,
          delayed: urgent.delayed ?? 0,
          failed: urgent.failed ?? 0,
        },
        bulk: {
          waiting: (bulk.waiting ?? 0) + (bulk.prioritized ?? 0),
          active: bulk.active ?? 0,
          delayed: bulk.delayed ?? 0,
          failed: bulk.failed ?? 0,
        },
      };
    } catch {
      return { urgent: { ...empty }, bulk: { ...empty } };
    } finally {
      await Promise.all([urgentQ?.close(), bulkQ?.close()].filter(Boolean));
      connection?.disconnect();
    }
  }

  private async httpCheck(
    id: string,
    label: string,
    url: string,
    okStatuses: number[],
  ): Promise<ServiceCheck> {
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Opt1mum-Monitoring/1.0' },
      });
      const ok = okStatuses.includes(res.status);
      return {
        id,
        label,
        status: ok ? 'up' : 'degraded',
        latencyMs: Date.now() - t0,
        detail: `${res.status} ${url.replace(/^https?:\/\//, '').slice(0, 80)}`,
      };
    } catch (err) {
      return {
        id,
        label,
        status: 'down',
        latencyMs: Date.now() - t0,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'error',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private aggregateStatus(statuses: CheckStatus[]): CheckStatus {
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.includes('unknown')) return 'degraded';
    return 'up';
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const RETRY_MS = 15_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  async onModuleInit() {
    const connected = await this.tryConnect();
    if (!connected) {
      this.logger.error(
        'Postgres injoignable (localhost:5433). L’API reste allumée pour éviter un redémarrage en boucle. Lance `pnpm docker:dev` — reconnexion auto toutes les 15s.',
      );
      this.scheduleReconnect();
    }
  }

  async onModuleDestroy() {
    this.clearReconnect();
    await this.$disconnect();
  }

  private async tryConnect(): Promise<boolean> {
    try {
      await this.$connect();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Connexion Postgres échouée: ${message}`);
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(() => {
      void this.tryConnect().then((ok) => {
        if (!ok) return;
        this.logger.log('Postgres reconnecté');
        this.clearReconnect();
      });
    }, RETRY_MS);
    this.reconnectTimer.unref();
  }

  private clearReconnect() {
    if (!this.reconnectTimer) return;
    clearInterval(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

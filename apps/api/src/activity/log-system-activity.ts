import {
  ActivityActorType,
  Prisma,
  type PrismaClient,
} from '@prisma/client';

export type SystemActivityInput = {
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  meta?: Prisma.InputJsonValue;
};

/**
 * Log activité acteur SYSTEM (worker / jobs / reaper).
 * Ne throw jamais — le flux métier reste prioritaire.
 */
export async function logSystemActivity(
  prisma: PrismaClient,
  input: SystemActivityInput,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorType: ActivityActorType.SYSTEM,
        adminId: null,
        subscriberId: null,
        action: input.action,
        entity: input.entity ?? null,
        entityId:
          input.entityId === undefined || input.entityId === null
            ? null
            : String(input.entityId),
        meta: input.meta ?? undefined,
        ip: null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[activity] system log failed', err);
  }
}

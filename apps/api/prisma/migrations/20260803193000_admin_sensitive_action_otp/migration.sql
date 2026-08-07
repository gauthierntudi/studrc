-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "sensitiveActionOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sensitiveActionOtpContext" TEXT,
ADD COLUMN     "sensitiveActionOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sensitiveActionOtpHash" TEXT;

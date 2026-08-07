-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "passwordResetOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetOtpHash" TEXT;

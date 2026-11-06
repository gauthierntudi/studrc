-- CreateEnum
CREATE TYPE "StatusImageFit" AS ENUM ('COVER', 'FIT');

-- AlterTable
ALTER TABLE "statuses" ADD COLUMN "imageFit" "StatusImageFit" NOT NULL DEFAULT 'COVER';

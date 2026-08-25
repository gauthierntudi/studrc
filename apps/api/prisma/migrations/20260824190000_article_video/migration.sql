-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "videoSourceKey" TEXT,
ADD COLUMN "videoHlsKey" TEXT,
ADD COLUMN "videoPosterKey" TEXT,
ADD COLUMN "videoStatus" "VideoStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "videoError" TEXT,
ADD COLUMN "videoDurationSec" INTEGER;

-- CreateIndex
CREATE INDEX "articles_videoStatus_idx" ON "articles"("videoStatus");

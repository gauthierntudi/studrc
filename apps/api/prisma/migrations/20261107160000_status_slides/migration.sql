-- Un statut (bulle) contient désormais une ou plusieurs diapos.

-- CreateTable
CREATE TABLE "status_slides" (
    "id" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "mediaType" "StatusMediaType",
    "mediaKey" TEXT,
    "posterKey" TEXT,
    "imageFit" "StatusImageFit" NOT NULL DEFAULT 'COVER',
    "caption" TEXT,
    "articleId" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_slides_statusId_position_idx" ON "status_slides"("statusId", "position");

-- CreateIndex
CREATE INDEX "status_slides_articleId_idx" ON "status_slides"("articleId");

-- AddForeignKey
ALTER TABLE "status_slides" ADD CONSTRAINT "status_slides_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_slides" ADD CONSTRAINT "status_slides_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise : chaque statut existant devient un statut à une diapo
INSERT INTO "status_slides" ("id", "statusId", "position", "mediaType", "mediaKey", "posterKey", "imageFit", "caption", "articleId", "durationSec", "createdAt", "updatedAt")
SELECT 'slide_' || "id", "id", 0, "mediaType", "mediaKey", "posterKey", "imageFit", "caption", "articleId", "durationSec", "createdAt", "updatedAt"
FROM "statuses";

-- DropForeignKey
ALTER TABLE "statuses" DROP CONSTRAINT "statuses_articleId_fkey";

-- DropIndex
DROP INDEX "statuses_articleId_idx";

-- AlterTable
ALTER TABLE "statuses" DROP COLUMN "articleId",
DROP COLUMN "caption",
DROP COLUMN "durationSec",
DROP COLUMN "imageFit",
DROP COLUMN "mediaKey",
DROP COLUMN "mediaType",
DROP COLUMN "posterKey";

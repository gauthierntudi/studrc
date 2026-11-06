-- CreateEnum
CREATE TYPE "StatusMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "statuses" (
    "id" TEXT NOT NULL,
    "mediaType" "StatusMediaType",
    "mediaKey" TEXT,
    "posterKey" TEXT,
    "caption" TEXT,
    "articleId" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 6,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "statuses_isPublished_expiresAt_idx" ON "statuses"("isPublished", "expiresAt");

-- CreateIndex
CREATE INDEX "statuses_articleId_idx" ON "statuses"("articleId");

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoKey" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "sponsorId" TEXT;

-- CreateIndex
CREATE INDEX "articles_sponsorId_idx" ON "articles"("sponsorId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "avatarKey" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "authors_adminUserId_key" ON "authors"("adminUserId");

-- AddForeignKey
ALTER TABLE "authors" ADD CONSTRAINT "authors_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "bylineAuthorId" TEXT;

-- Backfill: un auteur par compte staff, même id pour le picker « vous »
INSERT INTO "authors" ("id", "name", "title", "avatarKey", "adminUserId", "createdAt", "updatedAt")
SELECT "id", "name", "title", "avatarKey", "id", "createdAt", "updatedAt"
FROM "admin_users"
ON CONFLICT ("id") DO NOTHING;

UPDATE "articles"
SET "bylineAuthorId" = "authorId"
WHERE "authorId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "articles_bylineAuthorId_idx" ON "articles"("bylineAuthorId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_bylineAuthorId_fkey" FOREIGN KEY ("bylineAuthorId") REFERENCES "authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

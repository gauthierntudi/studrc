-- CreateEnum
CREATE TYPE "MagazinePagesStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "magazines" ADD COLUMN "pagesStatus" "MagazinePagesStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "magazines" ADD COLUMN "pagesCount" INTEGER;
ALTER TABLE "magazines" ADD COLUMN "pagesError" TEXT;

-- CreateTable
CREATE TABLE "magazine_pages" (
    "id" TEXT NOT NULL,
    "magazineId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "magazine_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "magazine_pages_magazineId_idx" ON "magazine_pages"("magazineId");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_pages_magazineId_pageNumber_key" ON "magazine_pages"("magazineId", "pageNumber");

-- AddForeignKey
ALTER TABLE "magazine_pages" ADD CONSTRAINT "magazine_pages_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

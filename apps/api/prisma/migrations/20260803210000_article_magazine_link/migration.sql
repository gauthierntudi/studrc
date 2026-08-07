-- AlterTable
ALTER TABLE "articles" ADD COLUMN "magazineId" TEXT;

-- CreateIndex
CREATE INDEX "articles_magazineId_idx" ON "articles"("magazineId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "statuses" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "statuses_sortOrder_idx" ON "statuses"("sortOrder");

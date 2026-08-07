-- AlterTable
ALTER TABLE "articles" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "articles_isFeatured_isPublished_idx" ON "articles"("isFeatured", "isPublished");

-- AlterTable
ALTER TABLE "articles" ALTER COLUMN "content" SET DEFAULT '';

-- CreateTable
CREATE TABLE "article_blocks" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "coverKey" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_blocks_articleId_position_idx" ON "article_blocks"("articleId", "position");

-- AddForeignKey
ALTER TABLE "article_blocks" ADD CONSTRAINT "article_blocks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

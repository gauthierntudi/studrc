-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_reads_subscriberId_idx" ON "notification_reads"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_subscriberId_notificationId_key" ON "notification_reads"("subscriberId", "notificationId");

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

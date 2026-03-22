-- CreateTable
CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting-admin',
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "lastMessageAt" TEXT NOT NULL DEFAULT '',
    "lastMessageFrom" TEXT NOT NULL DEFAULT 'user',
    "lastMessageText" TEXT NOT NULL DEFAULT '',
    "adminSeenAt" TEXT NOT NULL DEFAULT '',
    "userSeenAt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportThread_ownerUserId_updatedAt_idx" ON "SupportThread"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportThread_status_updatedAt_idx" ON "SupportThread"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

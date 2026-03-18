-- CreateTable
CREATE TABLE "SharedAccess" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sharedUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inviteToken" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "SharedAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedAccess_inviteToken_key" ON "SharedAccess"("inviteToken");

-- CreateIndex
CREATE INDEX "SharedAccess_ownerUserId_status_idx" ON "SharedAccess"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "SharedAccess_sharedUserId_idx" ON "SharedAccess"("sharedUserId");

-- CreateIndex
CREATE INDEX "SharedAccess_invitedEmail_idx" ON "SharedAccess"("invitedEmail");

-- AddForeignKey
ALTER TABLE "SharedAccess" ADD CONSTRAINT "SharedAccess_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedAccess" ADD CONSTRAINT "SharedAccess_sharedUserId_fkey" FOREIGN KEY ("sharedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

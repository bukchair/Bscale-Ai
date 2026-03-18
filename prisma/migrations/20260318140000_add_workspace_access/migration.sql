-- CreateTable: WorkspaceInvitation
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserWorkspaceAccess
CREATE TABLE "UserWorkspaceAccess" (
    "id" TEXT NOT NULL,
    "guestUserId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWorkspaceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_inviteToken_key" ON "WorkspaceInvitation"("inviteToken");
CREATE INDEX "WorkspaceInvitation_ownerUserId_idx" ON "WorkspaceInvitation"("ownerUserId");
CREATE INDEX "WorkspaceInvitation_invitedEmail_idx" ON "WorkspaceInvitation"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkspaceAccess_guestUserId_ownerUserId_key" ON "UserWorkspaceAccess"("guestUserId", "ownerUserId");
CREATE INDEX "UserWorkspaceAccess_guestUserId_idx" ON "UserWorkspaceAccess"("guestUserId");

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWorkspaceAccess" ADD CONSTRAINT "UserWorkspaceAccess_guestUserId_fkey"
    FOREIGN KEY ("guestUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWorkspaceAccess" ADD CONSTRAINT "UserWorkspaceAccess_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

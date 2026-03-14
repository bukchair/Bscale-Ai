-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('GOOGLE_ADS', 'GA4', 'SEARCH_CONSOLE', 'GMAIL', 'META', 'TIKTOK');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'ERROR', 'EXPIRED', 'DISCONNECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('DISCOVER', 'TEST', 'MANUAL_SYNC', 'REFRESH');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OAuthStateStatus" AS ENUM ('ISSUED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "tokenType" TEXT,
    "externalUserId" TEXT,
    "externalBusinessId" TEXT,
    "metadata" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformConnectionId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalParentId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "timezone" TEXT,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "connectionId" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "syncJobId" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultSummary" JSONB,
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "platform" "Platform",
    "connectionId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierEnc" TEXT NOT NULL,
    "redirectPath" TEXT,
    "status" "OAuthStateStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

CREATE UNIQUE INDEX "PlatformConnection_userId_platform_key" ON "PlatformConnection"("userId", "platform");
CREATE INDEX "PlatformConnection_userId_platform_status_idx" ON "PlatformConnection"("userId", "platform", "status");
CREATE INDEX "PlatformConnection_status_updatedAt_idx" ON "PlatformConnection"("status", "updatedAt");
CREATE INDEX "PlatformConnection_updatedAt_idx" ON "PlatformConnection"("updatedAt");

CREATE UNIQUE INDEX "ConnectedAccount_platformConnectionId_externalAccountId_key" ON "ConnectedAccount"("platformConnectionId", "externalAccountId");
CREATE INDEX "ConnectedAccount_userId_platform_idx" ON "ConnectedAccount"("userId", "platform");
CREATE INDEX "ConnectedAccount_platformConnectionId_isSelected_idx" ON "ConnectedAccount"("platformConnectionId", "isSelected");
CREATE INDEX "ConnectedAccount_updatedAt_idx" ON "ConnectedAccount"("updatedAt");

CREATE INDEX "SyncJob_userId_platform_status_idx" ON "SyncJob"("userId", "platform", "status");
CREATE INDEX "SyncJob_connectionId_createdAt_idx" ON "SyncJob"("connectionId", "createdAt");
CREATE INDEX "SyncJob_updatedAt_idx" ON "SyncJob"("updatedAt");

CREATE INDEX "SyncRun_syncJobId_startedAt_idx" ON "SyncRun"("syncJobId", "startedAt");

CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_platform_createdAt_idx" ON "AuditLog"("platform", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");
CREATE INDEX "OAuthState_userId_platform_status_idx" ON "OAuthState"("userId", "platform", "status");
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_platformConnectionId_fkey"
FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_syncJobId_fkey"
FOREIGN KEY ("syncJobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

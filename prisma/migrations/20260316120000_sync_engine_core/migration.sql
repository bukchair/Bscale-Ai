-- Expand SyncJobType for background engine jobs
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_ACCOUNTS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_CAMPAIGNS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SYNC_METRICS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'SNAPSHOT_DAILY';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'REFRESH_TOKENS';
ALTER TYPE "SyncJobType" ADD VALUE IF NOT EXISTS 'ACTION';

-- New enum for action request lifecycle
CREATE TYPE "ActionRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- Extend SyncJob tracking
ALTER TABLE "SyncJob"
  ADD COLUMN "bullmqJobId" TEXT,
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "priority" INTEGER,
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

CREATE UNIQUE INDEX "SyncJob_bullmqJobId_key" ON "SyncJob"("bullmqJobId");

-- Unified campaign entities
CREATE TABLE "UnifiedCampaign" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "connectionId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "externalCampaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "objective" TEXT,
  "currency" TEXT,
  "timezone" TEXT,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnifiedCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnifiedCampaignMetricDaily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unifiedCampaignId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "spend" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "conversions" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "revenue" DECIMAL(65,30),
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnifiedCampaignMetricDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnifiedCampaignMetricHourly" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unifiedCampaignId" TEXT NOT NULL,
  "hour" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "spend" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "conversions" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "revenue" DECIMAL(65,30),
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnifiedCampaignMetricHourly_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnifiedSnapshotDaily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "totalSpend" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "totalRevenue" DECIMAL(65,30),
  "totalConversions" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "totalClicks" INTEGER NOT NULL DEFAULT 0,
  "totalImpressions" INTEGER NOT NULL DEFAULT 0,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnifiedSnapshotDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncErrorLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "Platform",
  "connectionId" TEXT,
  "syncJobId" TEXT,
  "syncRunId" TEXT,
  "category" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "Platform" NOT NULL,
  "connectionId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetExternalId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ActionRequestStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionRequest_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "UnifiedCampaign_platform_connectedAccountId_externalCampaignId_key"
  ON "UnifiedCampaign"("platform", "connectedAccountId", "externalCampaignId");
CREATE INDEX "UnifiedCampaign_userId_platform_idx" ON "UnifiedCampaign"("userId", "platform");
CREATE INDEX "UnifiedCampaign_connectionId_updatedAt_idx" ON "UnifiedCampaign"("connectionId", "updatedAt");

CREATE UNIQUE INDEX "UnifiedCampaignMetricDaily_unifiedCampaignId_date_key"
  ON "UnifiedCampaignMetricDaily"("unifiedCampaignId", "date");
CREATE INDEX "UnifiedCampaignMetricDaily_userId_date_idx" ON "UnifiedCampaignMetricDaily"("userId", "date");

CREATE UNIQUE INDEX "UnifiedCampaignMetricHourly_unifiedCampaignId_hour_key"
  ON "UnifiedCampaignMetricHourly"("unifiedCampaignId", "hour");
CREATE INDEX "UnifiedCampaignMetricHourly_userId_hour_idx" ON "UnifiedCampaignMetricHourly"("userId", "hour");

CREATE UNIQUE INDEX "UnifiedSnapshotDaily_userId_date_key" ON "UnifiedSnapshotDaily"("userId", "date");
CREATE INDEX "UnifiedSnapshotDaily_date_idx" ON "UnifiedSnapshotDaily"("date");

CREATE INDEX "SyncErrorLog_userId_occurredAt_idx" ON "SyncErrorLog"("userId", "occurredAt");
CREATE INDEX "SyncErrorLog_platform_occurredAt_idx" ON "SyncErrorLog"("platform", "occurredAt");
CREATE INDEX "SyncErrorLog_connectionId_occurredAt_idx" ON "SyncErrorLog"("connectionId", "occurredAt");

CREATE INDEX "ActionRequest_userId_platform_createdAt_idx"
  ON "ActionRequest"("userId", "platform", "createdAt");

-- Foreign keys
ALTER TABLE "UnifiedCampaign"
  ADD CONSTRAINT "UnifiedCampaign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnifiedCampaign"
  ADD CONSTRAINT "UnifiedCampaign_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnifiedCampaign"
  ADD CONSTRAINT "UnifiedCampaign_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnifiedCampaignMetricDaily"
  ADD CONSTRAINT "UnifiedCampaignMetricDaily_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnifiedCampaignMetricDaily"
  ADD CONSTRAINT "UnifiedCampaignMetricDaily_unifiedCampaignId_fkey"
  FOREIGN KEY ("unifiedCampaignId") REFERENCES "UnifiedCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnifiedCampaignMetricHourly"
  ADD CONSTRAINT "UnifiedCampaignMetricHourly_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnifiedCampaignMetricHourly"
  ADD CONSTRAINT "UnifiedCampaignMetricHourly_unifiedCampaignId_fkey"
  FOREIGN KEY ("unifiedCampaignId") REFERENCES "UnifiedCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UnifiedSnapshotDaily"
  ADD CONSTRAINT "UnifiedSnapshotDaily_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncErrorLog"
  ADD CONSTRAINT "SyncErrorLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionRequest"
  ADD CONSTRAINT "ActionRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionRequest"
  ADD CONSTRAINT "ActionRequest_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionRequest"
  ADD CONSTRAINT "ActionRequest_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

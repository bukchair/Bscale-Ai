-- Add subscription fields to User
ALTER TABLE "User"
  ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN "plan"               TEXT NOT NULL DEFAULT 'trial_3_days',
  ADD COLUMN "trialStartedAt"     TIMESTAMP(3),
  ADD COLUMN "trialEndsAt"        TIMESTAMP(3),
  ADD COLUMN "settings"           JSONB;

-- SavedAd
CREATE TABLE "SavedAd" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "productName" TEXT,
  "payload"     JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedAd_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "SavedAd_userId_createdAt_idx" ON "SavedAd"("userId", "createdAt");

-- Audience
CREATE TABLE "Audience" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "platform"              TEXT NOT NULL,
  "description"           TEXT,
  "rules"                 JSONB NOT NULL,
  "estimatedSize"         INTEGER,
  "status"                TEXT NOT NULL DEFAULT 'draft',
  "syncedToPlatform"      BOOLEAN NOT NULL DEFAULT false,
  "externalId"            TEXT,
  "syncedPlatforms"       JSONB,
  "syncStatusByPlatform"  JSONB,
  "externalIdsByPlatform" JSONB,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Audience_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Audience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "Audience_userId_platform_idx" ON "Audience"("userId", "platform");

-- SalesLead
CREATE TABLE "SalesLead" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "email"              TEXT,
  "phone"              TEXT,
  "website"            TEXT,
  "sourcePath"         TEXT,
  "message"            TEXT,
  "assignedAdminEmail" TEXT,
  "status"             TEXT NOT NULL DEFAULT 'new',
  "readBy"             JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");

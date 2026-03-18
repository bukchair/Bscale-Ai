-- CreateTable
CREATE TABLE "OneClickCampaignRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "platforms" JSONB NOT NULL,
    "objective" TEXT NOT NULL,
    "dailyBudget" DOUBLE PRECISION NOT NULL,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "productInfo" JSONB,
    "aiStrategy" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "results" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneClickCampaignRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OneClickCampaignRequest_idempotencyKey_key" ON "OneClickCampaignRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OneClickCampaignRequest_userId_createdAt_idx" ON "OneClickCampaignRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OneClickCampaignRequest_idempotencyKey_idx" ON "OneClickCampaignRequest"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "OneClickCampaignRequest" ADD CONSTRAINT "OneClickCampaignRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

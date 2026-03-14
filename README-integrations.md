# Integrations Module (Connections Center)

This document tracks the production-grade integrations module implementation for:

- Google Ads
- Google Analytics 4
- Google Search Console
- Gmail
- Meta Marketing API
- TikTok for Business

## Tech stack

- Next.js App Router compatible module layout
- TypeScript
- Tailwind UI components (App Router page)
- Prisma + PostgreSQL models
- Zod validation
- Secure token encryption at rest
- Audit logging + sync history
- Provider abstraction for future extensibility

---

## Phase log

### Phase 1 - Architecture + schema + provider contracts ✅

Implemented:

- `prisma/schema.prisma` with required models:
  - `User`
  - `PlatformConnection`
  - `ConnectedAccount`
  - `SyncJob`
  - `SyncRun`
  - `AuditLog`
  - plus `OAuthState` for CSRF state and callback idempotency
- SQL migration scaffold:
  - `prisma/migrations/20260311120000_connections_center/migration.sql`
- Core contracts and typed model:
  - `src/lib/integrations/core/types.ts`
  - `src/lib/integrations/core/interfaces.ts`
  - `src/lib/integrations/core/errors.ts`
- Security and server-only foundations:
  - `src/lib/crypto/token-encryption.ts` (AES-256-GCM with rotation-ready keyring)
  - `src/lib/auth/session.ts` (custom session guard, separated from platform OAuth)
  - `src/lib/env/integrations-env.ts` (strict env validation with Zod)
  - `src/lib/db/prisma.ts`
- Reusable utilities and services:
  - `src/lib/http/http-client.ts`
  - `src/lib/integrations/utils/oauth-state.ts`
  - `src/lib/integrations/utils/scope-utils.ts`
  - `src/lib/integrations/utils/platform-utils.ts`
  - `src/lib/integrations/utils/api-response.ts`
  - `src/lib/integrations/utils/logger.ts`
  - `src/lib/integrations/services/audit-service.ts`
  - `src/lib/integrations/services/rate-limit-service.ts`
  - `src/lib/integrations/services/token-service.ts`
  - `src/lib/integrations/services/connection-service.ts`
  - `src/lib/integrations/services/sync-service.ts`
  - `src/lib/integrations/services/account-discovery-service.ts`

Security notes in Phase 1:

- Tokens are encrypted before DB persistence.
- Raw tokens are never logged in logger utility.
- OAuth state and PKCE verifier are stored server-side and consumed once.
- User authentication/session is separate from provider OAuth.

---

### Phase 2 - Google providers ✅

Implemented provider modules:

- `src/lib/integrations/providers/google-shared/oauth.ts`
  - OAuth URL builder with PKCE + state
  - Authorization code exchange
  - Refresh token exchange
- `src/lib/integrations/providers/google-shared/provider-base.ts`
  - Shared callback logic
  - Scope validation
  - server-side token refresh flow
  - connection-safe token retrieval
- `src/lib/integrations/providers/google-ads/provider.ts`
  - account discovery via `customers:listAccessibleCustomers`
  - campaign summary test query via Google Ads `searchStream`
  - developer token + optional login-customer-id support
- `src/lib/integrations/providers/ga4/provider.ts`
  - property discovery via Analytics Admin API
  - `runReport` test endpoint logic with typed summary
- `src/lib/integrations/providers/search-console/provider.ts`
  - verified site discovery
  - `searchAnalytics.query` test logic (top query/page rows)
- `src/lib/integrations/providers/gmail/provider.ts`
  - profile + recent message refs test logic
  - read-only default scope
  - optional send scope via `ENABLE_GMAIL_SEND_SCOPE` feature flag
- provider registry:
  - `src/lib/integrations/core/provider-factory.ts`

### Phase 3 - Meta + TikTok providers ✅

Implemented:

- `src/lib/integrations/providers/meta/provider.ts`
  - OAuth start/callback
  - secure token persistence
  - ad account discovery
  - test insights for last 7 days (`spend`, `impressions`, `clicks`, `ctr`, `cpc`)
  - token refresh using Meta long-lived exchange
- `src/lib/integrations/providers/tiktok/provider.ts`
  - OAuth start/callback
  - secure token persistence
  - advertiser discovery via OAuth advertiser endpoint
  - reporting test endpoint integration scaffold (`report/integrated/get`)
  - capability flag behavior:
    - `REPORTING_TEST` enabled only when `TIKTOK_REPORTING_ENABLED=true`
  - actionable typed errors for missing permission/app review cases
- provider registry now includes Meta + TikTok.

### Phase 4 - App Router API routes + UI page ✅

Implemented App Router API routes:

- `GET /api/connections`
- `POST /api/connections/[platform]/start`
- `GET /api/connections/[platform]/callback`
- `GET /api/connections/[platform]/accounts`
- `POST /api/connections/[platform]/select-accounts`
- `POST /api/connections/[platform]/test`
- `POST /api/connections/[platform]/sync`
- `POST /api/connections/[platform]/disconnect`

Route files:

- `src/app/api/connections/route.ts`
- `src/app/api/connections/[platform]/start/route.ts`
- `src/app/api/connections/[platform]/callback/route.ts`
- `src/app/api/connections/[platform]/accounts/route.ts`
- `src/app/api/connections/[platform]/select-accounts/route.ts`
- `src/app/api/connections/[platform]/test/route.ts`
- `src/app/api/connections/[platform]/sync/route.ts`
- `src/app/api/connections/[platform]/disconnect/route.ts`

Orchestration layer:

- `src/lib/integrations/services/integration-orchestrator.ts`

UI module (single-site mode):

- `src/app/dashboard/connections/page.tsx` (redirects to `/connections`)
- `src/components/connections/ConnectionsPage.tsx`
- `src/components/connections/ConnectionCard.tsx`
- `src/components/connections/AccountPickerDialog.tsx`
- `src/components/connections/ConnectionStatusBadge.tsx`
- `src/components/connections/SyncHistoryTable.tsx`
- `src/components/connections/ErrorPanel.tsx`
- plus minimal Next root files:
  - `src/app/layout.tsx`
  - `src/app/page.tsx`

### Phase 5 - Docs and credential setup guides ✅

Implemented:

- `SETUP-CREDENTIALS.md`
  - Google Cloud setup
  - Google Ads developer token setup
  - Meta app setup
  - TikTok app setup
- `.env.example` expanded with:
  - DB/session/encryption secrets
  - Google/Meta/TikTok credentials
  - feature flags (`ENABLE_GMAIL_SEND_SCOPE`, `TIKTOK_REPORTING_ENABLED`)
- `next.config.ts` + `next-env.d.ts` + package scripts for Next/Prisma:
  - `next:dev`, `next:build`, `next:start`
  - `prisma:generate`, `prisma:migrate`

---

## How to run (integrations module)

1. Fill `.env` values based on `.env.example`.
2. Generate Prisma client:
   - `npm run prisma:generate`
3. Apply migrations:
   - `npm run prisma:migrate`
4. Start Next module:
   - `npm run next:dev`
5. Open:
   - `/connections`

---

## Security checklist implemented

- ✅ OAuth state + PKCE (Google) and single-use state consumption
- ✅ Token encryption at rest (AES-256-GCM)
- ✅ No raw token response to client
- ✅ Secret scrubbing in logs
- ✅ Server-side refresh flow
- ✅ Audit logs for critical actions
- ✅ Rate limiting on connect/test/sync/disconnect endpoints

---

## Known platform limitations

- TikTok reporting test endpoint is capability-gated by env flag:
  - `TIKTOK_REPORTING_ENABLED=true`
  - Requires app review/approval in TikTok ecosystem.
- Gmail send is disabled by default:
  - Enable only when required using `ENABLE_GMAIL_SEND_SCOPE=true`.

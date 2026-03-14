# SETUP-CREDENTIALS.md

This guide explains exactly what credentials you must create for the Integrations module.

---

## 1) Google Cloud (OAuth client)

You need one **OAuth 2.0 Web Application** client in Google Cloud.

### Steps

1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Configure OAuth consent screen (External/Internal depending your org).
3. Add required scopes:
   - Google Ads: `https://www.googleapis.com/auth/adwords`
   - GA4: `https://www.googleapis.com/auth/analytics.readonly`
   - Search Console: `https://www.googleapis.com/auth/webmasters.readonly`
   - Gmail read-only: `https://www.googleapis.com/auth/gmail.readonly`
   - Optional Gmail send (feature flag): `https://www.googleapis.com/auth/gmail.send`
4. Create OAuth Client ID -> Web application.
5. Add authorized redirect URIs:
   - `https://YOUR_APP_BASE_URL/api/connections/google-ads/callback`
   - `https://YOUR_APP_BASE_URL/api/connections/ga4/callback`
   - `https://YOUR_APP_BASE_URL/api/connections/search-console/callback`
   - `https://YOUR_APP_BASE_URL/api/connections/gmail/callback`
6. Put values into env:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (legacy/global; keep a valid callback URL)

---

## 2) Google Ads manager/developer token

You need a Google Ads Developer Token for production API access.

### Steps

1. Open Google Ads Manager account.
2. Navigate to API Center.
3. Request/approve Developer Token.
4. Set:
   - `GOOGLE_ADS_DEVELOPER_TOKEN`
5. Optional:
   - `GOOGLE_ADS_MANAGER_CUSTOMER_ID` for manager-level login-customer-id behavior.

---

## 3) Meta for Developers (Marketing API)

### Steps

1. Create app in Meta for Developers.
2. Add Facebook Login product + Marketing API permissions.
3. Configure OAuth redirect URI:
   - `https://YOUR_APP_BASE_URL/api/connections/meta/callback`
4. Request app review for required permissions:
   - `ads_read`
   - `ads_management`
   - `business_management`
5. Set env:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_REDIRECT_URI`

---

## 4) TikTok for Developers / TikTok for Business

### Steps

1. Create TikTok developer app.
2. Enable TikTok Ads/Business APIs for the app.
3. Configure redirect URI:
   - `https://YOUR_APP_BASE_URL/api/connections/tiktok/callback`
4. Request scopes/approvals used by module:
   - advertiser/account read
   - reporting read (if you want reporting tests)
5. Set env:
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `TIKTOK_REDIRECT_URI`
6. Enable reporting test capability only after app approval:
   - `TIKTOK_REPORTING_ENABLED=true`

---

## 5) Security secrets you must set

1. `ENCRYPTION_KEY`: AES-256 key in base64 (32 bytes)
   - Generate: `openssl rand -base64 32`
2. `SESSION_SIGNING_SECRET`: long random value (32+ chars)
3. `DATABASE_URL`: PostgreSQL connection URL
4. `APP_BASE_URL`: production/public base URL

---

## 6) Required callback routes to allowlist

- `/api/connections/google-ads/callback`
- `/api/connections/ga4/callback`
- `/api/connections/search-console/callback`
- `/api/connections/gmail/callback`
- `/api/connections/meta/callback`
- `/api/connections/tiktok/callback`

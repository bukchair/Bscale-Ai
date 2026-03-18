/**
 * Cron request authentication helpers.
 *
 * Two verification modes are supported:
 *
 * 1. Bearer token (existing, always accepted when HMAC is not required)
 *    Authorization: Bearer <CRON_SECRET>
 *
 * 2. HMAC-SHA256 signature (optional, enabled via CRON_REQUIRE_HMAC=true)
 *    X-Cron-Timestamp: <unix-seconds>
 *    X-Cron-Signature: sha256=<hex>
 *
 *    The signature is computed as:
 *      HMAC-SHA256(CRON_SECRET, "<timestamp>\n<raw-body>")
 *
 *    The timestamp must be within ±5 minutes of server time to prevent
 *    replay attacks.
 *
 * Migration path:
 *   - Set CRON_REQUIRE_HMAC=true once all cron callers send signed requests.
 *   - Until then, both modes are accepted so existing jobs keep working.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { syncEnv } from './env';

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
const REQUIRE_HMAC = process.env.CRON_REQUIRE_HMAC === 'true';

if (process.env.NODE_ENV === 'production' && !REQUIRE_HMAC) {
  console.warn(
    '[cron-auth] SECURITY WARNING: CRON_REQUIRE_HMAC is not enabled in production. ' +
      'Bearer token mode is active. Set CRON_REQUIRE_HMAC=true for HMAC-signed requests.'
  );
}

/**
 * Verify a cron request using Bearer token or HMAC-SHA256 signature.
 *
 * @param request  The incoming Next.js Request.
 * @param rawBody  The raw request body as a string (required for HMAC verification).
 *                 Pass an empty string for requests without a body.
 * @returns `true` if the request is authenticated, `false` otherwise.
 */
export async function verifyCronRequest(request: Request, rawBody = ''): Promise<boolean> {
  const secret = syncEnv.CRON_SECRET;
  if (!secret) return false;

  const signature = request.headers.get('x-cron-signature');
  const timestamp = request.headers.get('x-cron-timestamp');

  // --- HMAC verification ---
  if (signature && timestamp) {
    return verifyHmac(secret, signature, timestamp, rawBody);
  }

  // --- Bearer fallback ---
  if (REQUIRE_HMAC) {
    // HMAC is required but headers are missing — reject.
    return false;
  }

  const auth = request.headers.get('authorization');
  if (!auth) return false;

  const expected = `Bearer ${secret}`;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    // Buffers differ in length — not equal.
    return false;
  }
}

function verifyHmac(secret: string, signature: string, timestamp: string, body: string): boolean {
  // 1. Validate timestamp to prevent replay attacks.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const drift = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (drift > TIMESTAMP_TOLERANCE_SECONDS) return false;

  // 2. Verify signature format: "sha256=<hex>"
  if (!signature.startsWith('sha256=')) return false;
  const receivedHex = signature.slice('sha256='.length);

  // 3. Compute expected HMAC.
  const payload = `${timestamp}\n${body}`;
  const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');

  // 4. Constant-time comparison.
  try {
    return timingSafeEqual(Buffer.from(receivedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  } catch {
    return false;
  }
}

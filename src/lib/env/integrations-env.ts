import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          const key = Buffer.from(value, 'base64');
          return key.length === 32;
        } catch {
          return false;
        }
      },
      { message: 'ENCRYPTION_KEY must be a base64-encoded 32-byte key.' }
    ),
  SESSION_SIGNING_SECRET: z.string().min(32),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  ENABLE_GMAIL_SEND_SCOPE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  TIKTOK_REPORTING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1),
  GOOGLE_ADS_MANAGER_CUSTOMER_ID: z.string().optional(),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_REDIRECT_URI: z.string().url(),
  TIKTOK_CLIENT_KEY: z.string().min(1),
  TIKTOK_CLIENT_SECRET: z.string().min(1),
  TIKTOK_REDIRECT_URI: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid integrations environment configuration:\n${message}`);
}

export const integrationsEnv = parsed.data;

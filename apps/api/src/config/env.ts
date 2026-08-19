import { z } from 'zod';

/**
 * Single source of truth for configuration (NFR-SEC-02). Validated at boot;
 * the process refuses to start with anything required missing or malformed.
 * Secrets arrive via env only — never from code, files in repo, or defaults.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    // One image, two roles (D-013): api = HTTP, worker = BullMQ consumers.
    API_ROLE: z.enum(['api', 'worker']).default('api'),

    // app connects as non-owner app_user (RLS-bound, ADR-002)
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),

    // 32-byte hex — encrypts per-tenant secrets like WABA tokens (D-024)
    MASTER_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex chars (32 bytes)'),

    // Auth (D-017) — optional in dev, required in production (refined below)
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    // Public dashboard origin used in Clerk organization invitation links.
    APP_PUBLIC_URL: z.url().default('http://localhost:3002'),

    // Evolution API — third-party WhatsApp transport (replaces pilot + official Meta).
    // Always required: Wakeel delegates all WhatsApp messaging to Evolution.
    EVOLUTION_API_BASE_URL: z.url().default('http://localhost:8080'),
    EVOLUTION_API_KEY: z.string().min(1),
    EVOLUTION_SERVER_URL: z.url().default('http://localhost:8080'),
    EVOLUTION_WEBHOOK_SECRET: z.string().min(1),

    // Legacy WhatsApp providers — DEPRECATED. Left optional for migration-only.
    META_APP_ID: z.string().min(1).optional(),
    META_APP_SECRET: z.string().min(1).optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
    META_GRAPH_BASE_URL: z.url().default('https://graph.facebook.com/v22.0'),
    META_REDIRECT_URI: z.url().optional(),
    META_USE_REAL_API: z.string().optional(),

    // Pilot bridge — DEPRECATED. Evolution handles Baileys/Cloud API internally.
    PILOT_BRIDGE_ENABLED: z.string().optional(),
    PILOT_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    PILOT_MAX_ALLOWLIST: z.coerce.number().int().min(1).max(500).default(25),
    PILOT_QR_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),

    // Payments legal gate (D-096): electronic rails (JazzCash/Easypaisa/cards)
    // only initiate when the operator has signed the merchant agreements.
    PAYMENTS_ELECTRONIC_ENABLED: z.string().optional(),

    // Legacy official WhatsApp upgrade pricing — DEPRECATED, kept for migration compatibility.
    OFFICIAL_WHATSAPP_PRICE_CENTS: z.coerce.number().int().min(0).default(50000),
    OFFICIAL_WHATSAPP_CURRENCY: z.string().length(3).default('PKR'),

    // Local media storage for dev (Phase 6b); production uses object storage.
    MEDIA_STORAGE_PATH: z.string().min(1).default('/tmp/opencode/wakeel-media'),

    // Google Calendar OAuth (Phase 3). Optional in dev; required for calendar sync.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.url().optional(),
    GOOGLE_CALENDAR_REMINDER_MINUTES: z.coerce.number().int().min(0).default(60),

    // AI providers (Phase 7) — optional at boot; model router checks at call time
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.url().default('https://api.openai.com/v1'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    AI_DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'google']).default('openai'),
    AI_DEFAULT_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),

    // Embeddings (Phase 8) — OpenAI text-embedding-3-large, 1536 dims
    OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-large'),
    OPENAI_EMBEDDING_BASE_URL: z.url().default('https://api.openai.com/v1'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().min(1).default(1536),

    // Object storage — auto uses Supabase when configured, filesystem fallback on failure
    OBJECT_STORAGE_DRIVER: z.enum(['auto', 'filesystem', 'supabase']).default('auto'),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).default('tenant-documents'),

    // Voice (STT/TTS) — optional at boot; checked at call time
    ELEVENLABS_API_KEY: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_MALE: z.string().min(1).optional(),
    ELEVENLABS_VOICE_ID_FEMALE: z.string().min(1).optional(),
    // Whisper STT — optional overrides when chat uses Groq but STT should hit OpenAI (or vice versa)
    OPENAI_WHISPER_API_KEY: z.string().min(1).optional(),
    OPENAI_WHISPER_BASE_URL: z.url().optional(),
    OPENAI_WHISPER_MODEL: z.string().min(1).optional(),

    // Observability (D-016)
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    SENTRY_DSN: z.string().optional(),

    // Notification channels (Phase 12) — optional in dev, required for production push/email
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().min(1).optional(),
    EMAIL_FROM: z.string().email().optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of [
      'CLERK_SECRET_KEY',
      'EVOLUTION_API_KEY',
      'EVOLUTION_WEBHOOK_SECRET',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT',
      'EMAIL_FROM',
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  // Convention: an empty env var is the same as an unset one (dotenv loads
  // `KEY=` as ''), so optional keys never fail min() checks on empties.
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    // Fail fast with specifics — but never echo the offending values (they may be secrets).
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

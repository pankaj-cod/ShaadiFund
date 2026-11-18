import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    PAYMENTS_MODE: z.enum(["mock", "test", "live"]).default("mock"),
    RAZORPAY_KEY_ID: optionalString,
    RAZORPAY_KEY_SECRET: optionalString,
    RAZORPAY_WEBHOOK_SECRET: optionalString,
    LIVE_SETTLEMENT_APPROVED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    // Sign-in
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    // Email: "file" writes messages to .data/outbox (development and tests only).
    EMAIL_TRANSPORT: z.enum(["file", "resend"]).default("file"),
    EMAIL_FROM: z.string().min(3).default("ShaadiFund <hello@shaadifund.test>"),
    RESEND_API_KEY: optionalString,

    // Shared secret that scheduled jobs send as a bearer token to /api/internal/cron/*.
    CRON_SECRET: optionalString,

    // Media: "local" stores images on this machine's disk (development and tests only);
    // "blob" stores them in Vercel Blob.
    MEDIA_STORAGE: z.enum(["local", "blob"]).default("local"),
    BLOB_READ_WRITE_TOKEN: optionalString,
    BLOB_STORE_ID: optionalString,

    // Shared rate limits (Upstash Redis). Vercel's Upstash integration names them KV_REST_API_*.
    UPSTASH_REDIS_REST_URL: optionalString,
    UPSTASH_REDIS_REST_TOKEN: optionalString,

    // Set by Vercel itself. Used to refuse settings that cannot work there.
    VERCEL: optionalString,
  })
  .superRefine((env, ctx) => {
    const require = (path: string, ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    require("BLOB_READ_WRITE_TOKEN", env.MEDIA_STORAGE !== "blob" ||
      Boolean(
        env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID,
      ), "MEDIA_STORAGE=blob needs a connected Vercel Blob store (BLOB_READ_WRITE_TOKEN)");
    require("UPSTASH_REDIS_REST_TOKEN", Boolean(env.UPSTASH_REDIS_REST_URL) ===
      Boolean(env.UPSTASH_REDIS_REST_TOKEN), "The Upstash REST URL and token must be set together");
    // On Vercel there is no lasting disk and many server instances run at once, so the
    // local fallbacks would silently lose photos and emails and not limit abuse.
    if (env.VERCEL === "1") {
      require("MEDIA_STORAGE", env.MEDIA_STORAGE === "blob", "must be blob on Vercel");
      require("EMAIL_TRANSPORT", env.EMAIL_TRANSPORT === "resend", "must be resend on Vercel");
      require("UPSTASH_REDIS_REST_URL", Boolean(
        env.UPSTASH_REDIS_REST_URL,
      ), "connect Upstash Redis for shared rate limits on Vercel");
      require("CRON_SECRET", Boolean(env.CRON_SECRET), "is required on Vercel for scheduled jobs");
      require("EMAIL_FROM", !/@[^>]*\.test>?$/.test(
        env.EMAIL_FROM.trim(),
      ), "set a real sender on Vercel, e.g. ShaadiFund <onboarding@resend.dev> or an address on your verified domain");
    }
    if (env.EMAIL_TRANSPORT === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "EMAIL_TRANSPORT=resend requires RESEND_API_KEY",
      });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
    if (env.PAYMENTS_MODE === "mock") return;

    const expectedPrefix = env.PAYMENTS_MODE === "live" ? "rzp_live_" : "rzp_test_";
    if (!env.RAZORPAY_KEY_ID?.startsWith(expectedPrefix)) {
      ctx.addIssue({
        code: "custom",
        path: ["RAZORPAY_KEY_ID"],
        message: `PAYMENTS_MODE=${env.PAYMENTS_MODE} requires a key id starting with ${expectedPrefix}`,
      });
    }
    if (!env.RAZORPAY_KEY_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["RAZORPAY_KEY_SECRET"],
        message: `PAYMENTS_MODE=${env.PAYMENTS_MODE} requires RAZORPAY_KEY_SECRET`,
      });
    }
    // Real money is refused until the settlement model is approved (ADR 0003).
    if (env.PAYMENTS_MODE === "live" && !env.LIVE_SETTLEMENT_APPROVED) {
      ctx.addIssue({
        code: "custom",
        path: ["LIVE_SETTLEMENT_APPROVED"],
        message: "PAYMENTS_MODE=live is refused unless LIVE_SETTLEMENT_APPROVED=true",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * The value of the first variable (in name order) whose name matches, if any.
 * Vercel can prefix integration variables (for example "STORAGE_KV_REST_API_URL"),
 * so these are found by their ending rather than their full name.
 */
function findBySuffix(
  raw: Record<string, string | undefined>,
  pattern: RegExp,
  valueCheck: (value: string) => boolean = () => true,
): string | undefined {
  return Object.keys(raw)
    .sort()
    .filter((key) => pattern.test(key))
    .map((key) => raw[key]?.trim())
    .find((value): value is string => Boolean(value) && valueCheck(value as string));
}

/**
 * Fills in values that hosting integrations provide under their own names, so
 * they do not have to be copied by hand. Explicit settings always win.
 */
function withPlatformDefaults(raw: Record<string, string | undefined>) {
  const productionHost = raw.VERCEL_PROJECT_PRODUCTION_URL;
  const onVercel = raw.VERCEL === "1";
  return {
    ...raw,
    APP_URL: raw.APP_URL || (productionHost ? `https://${productionHost}` : undefined),
    // On Vercel only the cloud options can work, so they are the defaults there.
    MEDIA_STORAGE: raw.MEDIA_STORAGE || (onVercel ? "blob" : undefined),
    EMAIL_TRANSPORT: raw.EMAIL_TRANSPORT || (onVercel ? "resend" : undefined),
    // Neon's connection may add a prefix ("STORAGE_" by default in some accounts).
    DATABASE_URL: raw.DATABASE_URL || raw.STORAGE_DATABASE_URL,
    // Upstash: KV_REST_API_* from Vercel's integration, UPSTASH_REDIS_REST_* from Upstash
    // itself, either possibly with a prefix. The read-only token is never picked.
    UPSTASH_REDIS_REST_URL:
      raw.UPSTASH_REDIS_REST_URL ||
      raw.KV_REST_API_URL ||
      findBySuffix(raw, /_(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/, (v) =>
        v.startsWith("https://"),
      ),
    UPSTASH_REDIS_REST_TOKEN:
      raw.UPSTASH_REDIS_REST_TOKEN ||
      raw.KV_REST_API_TOKEN ||
      findBySuffix(raw, /_(KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/),
    // Vercel Blob tokens always start with "vercel_blob_rw_", whatever the variable is called.
    BLOB_READ_WRITE_TOKEN:
      raw.BLOB_READ_WRITE_TOKEN ||
      findBySuffix(raw, /READ_WRITE_TOKEN$/, (v) => v.startsWith("vercel_blob_rw_")),
  };
}

/** Parses raw environment variables. Throws a readable error listing every problem. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(withPlatformDefaults(raw));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated environment, parsed once per process. Server-side only. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** True whenever no real money can move. Drives the "Demo mode" notices. */
export function isDemoPayments(env: Pick<Env, "PAYMENTS_MODE">): boolean {
  return env.PAYMENTS_MODE !== "live";
}

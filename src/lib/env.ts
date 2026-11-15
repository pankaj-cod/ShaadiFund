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
    EMAIL_FROM: z.string().min(3).default("VowFund <hello@vowfund.test>"),
    RESEND_API_KEY: optionalString,

    // Shared secret that scheduled jobs send as a bearer token to /api/internal/cron/*.
    CRON_SECRET: optionalString,

    // Media: "local" stores images on this machine's disk (development and tests only).
    MEDIA_STORAGE: z.enum(["local"]).default("local"),
  })
  .superRefine((env, ctx) => {
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

/** Parses raw environment variables. Throws a readable error listing every problem. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
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

import { describe, expect, it } from "vitest";
import { isDemoPayments, parseEnv } from "./env";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("defaults to mock payments with no keys", () => {
    const env = parseEnv(base);
    expect(env.PAYMENTS_MODE).toBe("mock");
    expect(env.LIVE_SETTLEMENT_APPROVED).toBe(false);
    expect(isDemoPayments(env)).toBe(true);
  });

  it("lists every missing required variable", () => {
    expect(() => parseEnv({})).toThrow(/APP_URL[\s\S]*DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it("accepts test mode with test keys", () => {
    const env = parseEnv({
      ...base,
      PAYMENTS_MODE: "test",
      RAZORPAY_KEY_ID: "rzp_test_abc",
      RAZORPAY_KEY_SECRET: "s",
    });
    expect(env.PAYMENTS_MODE).toBe("test");
    expect(isDemoPayments(env)).toBe(true);
  });

  it("refuses test mode with live keys", () => {
    expect(() =>
      parseEnv({
        ...base,
        PAYMENTS_MODE: "test",
        RAZORPAY_KEY_ID: "rzp_live_abc",
        RAZORPAY_KEY_SECRET: "s",
      }),
    ).toThrow(/rzp_test_/);
  });

  it("refuses test mode without a secret", () => {
    expect(() =>
      parseEnv({ ...base, PAYMENTS_MODE: "test", RAZORPAY_KEY_ID: "rzp_test_abc" }),
    ).toThrow(/RAZORPAY_KEY_SECRET/);
  });

  it("refuses live mode until settlement is approved", () => {
    expect(() =>
      parseEnv({
        ...base,
        PAYMENTS_MODE: "live",
        RAZORPAY_KEY_ID: "rzp_live_abc",
        RAZORPAY_KEY_SECRET: "s",
      }),
    ).toThrow(/LIVE_SETTLEMENT_APPROVED/);
  });

  it("refuses live mode with test keys even when approved", () => {
    expect(() =>
      parseEnv({
        ...base,
        PAYMENTS_MODE: "live",
        RAZORPAY_KEY_ID: "rzp_test_abc",
        RAZORPAY_KEY_SECRET: "s",
        LIVE_SETTLEMENT_APPROVED: "true",
      }),
    ).toThrow(/rzp_live_/);
  });

  it("allows live mode only with live keys and approval", () => {
    const env = parseEnv({
      ...base,
      PAYMENTS_MODE: "live",
      RAZORPAY_KEY_ID: "rzp_live_abc",
      RAZORPAY_KEY_SECRET: "s",
      LIVE_SETTLEMENT_APPROVED: "true",
    });
    expect(isDemoPayments(env)).toBe(false);
  });

  it("refuses the Resend transport without an API key", () => {
    expect(() => parseEnv({ ...base, EMAIL_TRANSPORT: "resend" })).toThrow(/RESEND_API_KEY/);
  });

  it("refuses a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  describe("on Vercel", () => {
    const vercel = {
      ...base,
      VERCEL: "1",
      MEDIA_STORAGE: "blob",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
      EMAIL_TRANSPORT: "resend",
      RESEND_API_KEY: "re_x",
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "t",
      CRON_SECRET: "c",
      EMAIL_FROM: "ShaadiFund <onboarding@resend.dev>",
    };

    it("accepts a complete configuration, reading Vercel's own variable names", () => {
      const env = parseEnv(vercel);
      expect(env.UPSTASH_REDIS_REST_URL).toBe("https://example.upstash.io");
      expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("t");
    });

    it("refuses local photo storage, file email, no shared rate limits, or no cron secret", () => {
      expect(() => parseEnv({ ...vercel, MEDIA_STORAGE: "local" })).toThrow(/MEDIA_STORAGE/);
      expect(() => parseEnv({ ...vercel, EMAIL_TRANSPORT: "file" })).toThrow(/EMAIL_TRANSPORT/);
      expect(() =>
        parseEnv({ ...vercel, KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined }),
      ).toThrow(/UPSTASH_REDIS_REST_URL/);
      expect(() => parseEnv({ ...vercel, CRON_SECRET: undefined })).toThrow(/CRON_SECRET/);
    });

    it("refuses the placeholder sender address, which Resend would reject", () => {
      const { EMAIL_FROM: _unused, ...withoutSender } = vercel;
      expect(() => parseEnv(withoutSender)).toThrow(/EMAIL_FROM/);
      expect(() => parseEnv({ ...vercel, EMAIL_FROM: "hello@shaadifund.test" })).toThrow(
        /EMAIL_FROM/,
      );
    });

    it("refuses blob storage without a connected store", () => {
      expect(() => parseEnv({ ...vercel, BLOB_READ_WRITE_TOKEN: undefined })).toThrow(
        /BLOB_READ_WRITE_TOKEN/,
      );
    });

    it("finds the database under the STORAGE_ prefix Vercel may add", () => {
      const { DATABASE_URL: _unused, ...withoutDb } = vercel;
      expect(
        parseEnv({ ...withoutDb, STORAGE_DATABASE_URL: "postgresql://neon/pooled" }).DATABASE_URL,
      ).toBe("postgresql://neon/pooled");
      expect(() => parseEnv(withoutDb)).toThrow(/DATABASE_URL/);
    });

    it("defaults to cloud photo storage and Resend on Vercel, and finds prefixed integration variables", () => {
      const env = parseEnv({
        ...base,
        VERCEL: "1",
        RESEND_API_KEY: "re_x",
        CRON_SECRET: "c",
        EMAIL_FROM: "ShaadiFund <onboarding@resend.dev>",
        STORAGE_KV_REST_API_URL: "https://prefixed.upstash.io",
        STORAGE_KV_REST_API_TOKEN: "write-token",
        STORAGE_KV_REST_API_READ_ONLY_TOKEN: "read-only-token",
        STORAGE_READ_WRITE_TOKEN: "vercel_blob_rw_abc",
        SOME_OTHER_READ_WRITE_TOKEN: "not-a-blob-token",
      });
      expect(env.MEDIA_STORAGE).toBe("blob");
      expect(env.EMAIL_TRANSPORT).toBe("resend");
      expect(env.UPSTASH_REDIS_REST_URL).toBe("https://prefixed.upstash.io");
      expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("write-token");
      expect(env.BLOB_READ_WRITE_TOKEN).toBe("vercel_blob_rw_abc");
    });

    it("still lets an explicit choice win, and keeps local defaults off Vercel", () => {
      expect(() => parseEnv({ ...vercel, MEDIA_STORAGE: "local" })).toThrow(/MEDIA_STORAGE/);
      expect(parseEnv(base).MEDIA_STORAGE).toBe("local");
      expect(parseEnv(base).EMAIL_TRANSPORT).toBe("file");
    });

    it("uses the production domain when APP_URL is not set, and an explicit APP_URL wins", () => {
      const { APP_URL: _ignored, ...withoutUrl } = vercel;
      expect(
        parseEnv({ ...withoutUrl, VERCEL_PROJECT_PRODUCTION_URL: "shaadifund.vercel.app" }).APP_URL,
      ).toBe("https://shaadifund.vercel.app");
      expect(
        parseEnv({ ...vercel, VERCEL_PROJECT_PRODUCTION_URL: "shaadifund.vercel.app" }).APP_URL,
      ).toBe("http://localhost:3000");
    });
  });
});

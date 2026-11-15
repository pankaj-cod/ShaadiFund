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
});

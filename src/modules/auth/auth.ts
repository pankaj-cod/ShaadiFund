import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { track } from "@/modules/analytics/analytics.service";
import { sendEmail } from "@/modules/notification/email";
import { magicLinkEmail } from "@/modules/notification/templates";

const MAGIC_LINK_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    advanced: { database: { generateId: "uuid" } },
    session: { expiresIn: SESSION_TTL_SECONDS, updateAge: 24 * 60 * 60 },
    user: {
      additionalFields: {
        // Never settable through any sign-up or profile API (ADR 0002).
        role: { type: "string", defaultValue: "COUPLE", input: false },
      },
    },
    databaseHooks: {
      user: { create: { after: async () => track("user_registered") } },
    },
    // A failed or cancelled Google sign-in comes back to our own sign-in page with a message.
    onAPIError: { errorURL: `${env.APP_URL}/sign-in` },
    account: {
      // Signing in with Google using the same address as an existing account joins the two,
      // but only when that account's email was already verified (by an emailed link).
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              // Always let the person choose which Google account to use.
              prompt: "select_account",
            },
          }
        : {},
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({ to: email, ...magicLinkEmail(url) });
        },
      }),
      // Must stay last: lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** The auth instance, created on first use so builds do not need a database. */
export function getAuth(): ReturnType<typeof createAuth> {
  instance ??= createAuth();
  return instance;
}

export function isGoogleSignInEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Where the "file" transport writes messages. Read by end-to-end tests. */
export const OUTBOX_DIR = path.join(process.cwd(), ".data", "outbox");

async function sendToFile(message: EmailMessage, from: string): Promise<void> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomUUID()}.json`;
  await writeFile(
    path.join(OUTBOX_DIR, name),
    JSON.stringify({ from, ...message, writtenAt: new Date().toISOString() }, null, 2),
  );
  logger.info("Email written to local outbox (not sent)", { subject: message.subject, file: name });

  // Development convenience only: show the first link (e.g. the sign-in link) in the
  // terminal so it can be clicked. Never in production, where logs are not private.
  const link = message.text.match(/https?:\/\/\S+/)?.[0];
  if (process.env.NODE_ENV === "development" && link) {
    console.warn(`\n  Email to ${message.to} was not sent. Open this link instead:\n  ${link}\n`);
  }
}

async function sendWithResend(message: EmailMessage, from: string, apiKey: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...message }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
  }
}

/** Sends one transactional email through the configured transport. Throws on failure. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getEnv();
  if (env.EMAIL_TRANSPORT === "resend" && env.RESEND_API_KEY) {
    await sendWithResend(message, env.EMAIL_FROM, env.RESEND_API_KEY);
    return;
  }
  await sendToFile(message, env.EMAIL_FROM);
}

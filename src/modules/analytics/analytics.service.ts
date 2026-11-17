import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { assertWithinRateLimit } from "@/lib/rate-limit";
import { BROWSER_EVENTS, type AnalyticsEvent } from "./analytics.events";
import { findPublishedWeddingId, insertAnalyticsEvent } from "./analytics.repository";

/**
 * Records a product event. Analytics must never break the thing being measured,
 * so this never throws: a failure is logged and swallowed deliberately.
 */
export async function track(
  name: AnalyticsEvent,
  data: {
    weddingId?: string | null;
    dreamId?: string | null;
    sessionHash?: string | null;
    properties?: Record<string, string | number | boolean>;
  } = {},
): Promise<void> {
  try {
    await insertAnalyticsEvent({ name, ...data });
  } catch (error) {
    logger.warn("Analytics event was not recorded", { name, error });
  }
}

/**
 * A visitor identifier that cannot be traced back to a person or followed
 * across days: a hash of address, browser and today's date, keyed with a server
 * secret. We store only this hash, never the IP address or user agent.
 */
export function sessionHash(
  clientAddress: string,
  userAgent: string,
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${getEnv().BETTER_AUTH_SECRET}|${day}|${clientAddress}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

const browserEventSchema = z.object({
  name: z.enum(BROWSER_EVENTS),
  slug: z.string().min(3).max(60),
  dreamId: z.uuid().optional(),
});

/** A page view or dream selection reported by a guest's browser. Unknown pages are ignored. */
export async function recordBrowserEvent(
  input: unknown,
  client: { address: string; userAgent: string },
): Promise<void> {
  await assertWithinRateLimit(`events:${client.address}`, 120, 10 * 60 * 1000);
  const parsed = browserEventSchema.safeParse(input);
  if (!parsed.success) return;
  const weddingId = await findPublishedWeddingId(parsed.data.slug);
  if (!weddingId) return;
  await track(parsed.data.name, {
    weddingId,
    dreamId: parsed.data.dreamId,
    sessionHash: sessionHash(client.address, client.userAgent),
  });
}

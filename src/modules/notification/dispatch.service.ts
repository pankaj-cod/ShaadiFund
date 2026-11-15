import "server-only";
import { logger } from "@/lib/logger";
import { sendEmail } from "./email";
import {
  claimDueNotifications,
  markNotificationFailed,
  markNotificationSent,
} from "./notification.repository";
import { giftReceiptEmail, giftReceivedEmail, type GiftEmailData } from "./templates";

function render(type: string, payload: unknown) {
  const data = payload as GiftEmailData;
  if (type === "gift_receipt") return giftReceiptEmail(data);
  if (type === "gift_received") return giftReceivedEmail(data);
  throw new Error(`Unknown notification type: ${type}`);
}

/**
 * Sends queued emails. Safe to run from several places at once (after a
 * request, and from the scheduled job): each message is claimed by one runner.
 * A message that fails is retried later with a growing delay, up to five times.
 */
export async function dispatchNotifications(limit = 20): Promise<{ sent: number; failed: number }> {
  const batch = await claimDueNotifications(limit);
  let sent = 0;
  let failed = 0;
  for (const message of batch) {
    try {
      await sendEmail({ to: message.recipient, ...render(message.type, message.payload) });
      await markNotificationSent(message.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error("Notification failed to send", { notificationId: message.id, error });
      await markNotificationFailed(
        message.id,
        message.attempts,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { sent, failed };
}

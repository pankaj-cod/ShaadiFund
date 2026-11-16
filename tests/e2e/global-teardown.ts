import { config } from "dotenv";
import { Client } from "pg";

const E2E_EMAIL_PATTERN = "%@e2e.vowfund.test";

/**
 * Removes the accounts the browser tests created, so the development database
 * stays clean. Uses plain SQL because Playwright cannot load the generated
 * Prisma client.
 */
export default async function globalTeardown(): Promise<void> {
  config({ path: [".env.local", ".env"], quiet: true });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TEMP TABLE doomed ON COMMIT DROP AS
         SELECT u.id AS user_id, m."coupleId" AS couple_id
         FROM "User" u LEFT JOIN "CoupleMember" m ON m."userId" = u.id
         WHERE u.email LIKE $1`,
      [E2E_EMAIL_PATTERN],
    );
    const weddings = `(SELECT id FROM "Wedding" WHERE "coupleId" IN (SELECT couple_id FROM doomed))`;
    const contributions = `(SELECT id FROM "Contribution" WHERE "weddingId" IN ${weddings})`;
    const payments = `(SELECT id FROM "Payment" WHERE "contributionId" IN ${contributions})`;
    await client.query(`DELETE FROM "AnalyticsEvent" WHERE "weddingId" IN ${weddings}`);
    await client.query(`DELETE FROM "PaymentStatusTransition" WHERE "paymentId" IN ${payments}`);
    await client.query(`DELETE FROM "PaymentEvent" WHERE "paymentId" IN ${payments}`);
    await client.query(`DELETE FROM "Refund" WHERE "paymentId" IN ${payments}`);
    await client.query(`DELETE FROM "Payment" WHERE "contributionId" IN ${contributions}`);
    await client.query(`DELETE FROM "GuestMessage" WHERE "weddingId" IN ${weddings}`);
    await client.query(`DELETE FROM "Contribution" WHERE "weddingId" IN ${weddings}`);
    await client.query(`DELETE FROM "Notification" WHERE recipient LIKE $1`, [E2E_EMAIL_PATTERN]);
    await client.query(
      `DELETE FROM "Dream" WHERE "weddingId" IN
         (SELECT id FROM "Wedding" WHERE "coupleId" IN (SELECT couple_id FROM doomed))`,
    );
    await client.query(`DELETE FROM "Wedding" WHERE "coupleId" IN (SELECT couple_id FROM doomed)`);
    await client.query(`DELETE FROM "Couple" WHERE id IN (SELECT couple_id FROM doomed)`);
    await client.query(
      `DELETE FROM "AuditLog" WHERE "actorUserId" IN (SELECT user_id FROM doomed)`,
    );
    await client.query(`DELETE FROM "Verification" WHERE identifier LIKE $1`, [E2E_EMAIL_PATTERN]);
    await client.query(`DELETE FROM "User" WHERE id IN (SELECT user_id FROM doomed)`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

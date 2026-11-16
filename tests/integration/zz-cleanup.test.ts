import { afterAll, describe, expect, it } from "vitest";
import { createTestDb, deleteTestUsers, hasDatabase } from "../support/db";

/**
 * Clears test accounts that an interrupted earlier run left behind. Only
 * accounts older than ten minutes are touched, so data belonging to test files
 * running at the same moment is never removed.
 */
describe.skipIf(!hasDatabase)("leftover test data", () => {
  const db = createTestDb();
  afterAll(() => db.$disconnect());

  it("removes accounts from interrupted runs older than ten minutes", async () => {
    const stale = await db.user.findMany({
      where: {
        email: { endsWith: ".shaadifund.test" },
        createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { email: true },
    });
    for (const { email } of stale) await deleteTestUsers(db, email);
    await db.notification.deleteMany({
      where: {
        recipient: { endsWith: ".shaadifund.test" },
        createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    expect(
      await db.user.count({
        where: {
          email: { endsWith: ".shaadifund.test" },
          createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
      }),
    ).toBe(0);
  });
});

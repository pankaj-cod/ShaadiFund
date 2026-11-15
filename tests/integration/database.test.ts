import { afterAll, describe, expect, it } from "vitest";
import { createTestDb, hasDatabase } from "../support/db";

/**
 * Proves the migrations applied and that the database itself rejects impossible
 * financial states. Runs against the local or CI Postgres; skipped without one.
 */
describe.skipIf(!hasDatabase)("database integrity", () => {
  const db = createTestDb();
  const suffix = crypto.randomUUID().slice(0, 8);

  afterAll(async () => {
    await db.dream.deleteMany({ where: { wedding: { slug: { endsWith: suffix } } } });
    await db.wedding.deleteMany({ where: { slug: { endsWith: suffix } } });
    await db.couple.deleteMany({ where: { partnerOneName: `test-${suffix}` } });
    await db.$disconnect();
  });

  async function createWedding(slug: string) {
    const couple = await db.couple.create({ data: { partnerOneName: `test-${suffix}` } });
    return db.wedding.create({ data: { coupleId: couple.id, slug } });
  }

  it("creates a wedding with a UUID id and safe defaults", async () => {
    const wedding = await createWedding(`riya-and-rahul-${suffix}`);
    expect(wedding.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(wedding.status).toBe("DRAFT");
    expect(wedding.showAmounts).toBe(false);
    expect(wedding.allowIndexing).toBe(false);
  });

  it("rejects a duplicate slug", async () => {
    await createWedding(`dupe-${suffix}`);
    await expect(createWedding(`dupe-${suffix}`)).rejects.toThrow();
  });

  it("rejects a malformed slug", async () => {
    await expect(createWedding(`Bad Slug!-${suffix}`)).rejects.toThrow();
  });

  it("rejects a dream with a zero target or negative funding", async () => {
    const wedding = await createWedding(`checks-${suffix}`);
    const dream = {
      weddingId: wedding.id,
      title: "t",
      description: "d",
      category: "TRAVEL",
    } as const;
    await expect(db.dream.create({ data: { ...dream, targetPaise: 0 } })).rejects.toThrow();
    await expect(
      db.dream.create({ data: { ...dream, targetPaise: 100, fundedPaise: -1 } }),
    ).rejects.toThrow();
  });

  it("increments funding atomically under concurrency", async () => {
    const wedding = await createWedding(`concurrent-${suffix}`);
    const dream = await db.dream.create({
      data: {
        weddingId: wedding.id,
        title: "t",
        description: "d",
        category: "TRAVEL",
        targetPaise: 1_000_000,
      },
    });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        db.dream.update({
          where: { id: dream.id },
          data: { fundedPaise: { increment: 5_000 }, contributionCount: { increment: 1 } },
        }),
      ),
    );
    const after = await db.dream.findUniqueOrThrow({ where: { id: dream.id } });
    expect(after.fundedPaise).toBe(100_000);
    expect(after.contributionCount).toBe(20);
  });
});

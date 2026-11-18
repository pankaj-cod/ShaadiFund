import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, RateLimitedError } from "@/lib/errors";
import { resetRateLimits } from "@/lib/rate-limit";
import type { Actor } from "@/modules/auth/session";
import {
  csvCell,
  exportWaitlistCsv,
  getWaitlist,
  joinWaitlist,
} from "@/modules/waitlist/waitlist.service";
import { createTestDb, hasDatabase } from "../support/db";

const run = crypto.randomUUID().slice(0, 8);
const DOMAIN = `@wl-${run}.shaadifund.test`;

describe("csv cells", () => {
  it("quotes values and stops them being read as spreadsheet formulas", () => {
    expect(csvCell('Riya "R" Rao')).toBe('"Riya ""R"" Rao"');
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+91 99999")).toBe('"\'+91 99999"');
    expect(csvCell(null)).toBe('""');
  });
});

describe.skipIf(!hasDatabase)("waitlist", () => {
  const db = createTestDb();
  let admin: Actor;
  let couple: Actor;

  beforeEach(() => resetRateLimits());

  beforeAll(async () => {
    const make = async (name: string, role: "ADMIN" | "COUPLE") => {
      const email = `${name}${DOMAIN}`;
      const user = await db.user.create({ data: { email, emailVerified: true, role } });
      return { userId: user.id, email };
    };
    admin = await make("admin", "ADMIN");
    couple = await make("couple", "COUPLE");
  });

  afterAll(async () => {
    await db.waitlistEntry.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await db.analyticsEvent.deleteMany({
      where: { name: "waitlist_joined", properties: { path: ["source"], equals: `test-${run}` } },
    });
    await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await db.$disconnect();
  });

  const join = (overrides: Record<string, unknown>, client = "client-a") =>
    joinWaitlist(
      {
        email: `meera${DOMAIN}`,
        role: "COUPLE",
        consent: true,
        source: `test-${run}`,
        ...overrides,
      },
      client,
    );

  it("adds someone once, keeps their first sign-up date, and updates their details", async () => {
    await join({ name: "Meera", weddingMonth: "2027-02" });
    const first = await db.waitlistEntry.findUniqueOrThrow({ where: { email: `meera${DOMAIN}` } });
    expect(first).toMatchObject({
      name: "Meera",
      role: "COUPLE",
      weddingMonth: "2027-02",
      source: `test-${run}`,
    });

    await join({ email: `MEERA${DOMAIN.toUpperCase()}`, name: "Meera Iyer", city: "Pune" });
    const rows = await db.waitlistEntry.findMany({ where: { email: `meera${DOMAIN}` } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Meera Iyer", city: "Pune" });
    expect(rows[0]!.createdAt.getTime()).toBe(first.createdAt.getTime());
  });

  it("counts a new sign-up in analytics once, not on repeats", async () => {
    await join({ email: `once${DOMAIN}` });
    await join({ email: `once${DOMAIN}` });
    const events = await db.analyticsEvent.count({
      where: { name: "waitlist_joined", properties: { path: ["source"], equals: `test-${run}` } },
    });
    expect(events).toBe(2); // meera (first test) and once
  });

  it("handles the same new address arriving twice at once", async () => {
    await Promise.all([join({ email: `race${DOMAIN}` }), join({ email: `race${DOMAIN}` })]);
    expect(await db.waitlistEntry.count({ where: { email: `race${DOMAIN}` } })).toBe(1);
  });

  it("refuses sign-ups without consent and rate limits one client", async () => {
    await expect(join({ email: `noconsent${DOMAIN}`, consent: false })).rejects.toThrow();
    expect(await db.waitlistEntry.count({ where: { email: `noconsent${DOMAIN}` } })).toBe(0);

    const results = await Promise.allSettled(
      Array.from({ length: 11 }, (_, i) => join({ email: `burst${i}${DOMAIN}` }, "client-burst")),
    );
    const limited = results.filter(
      (r) =>
        r.status === "rejected" && (r as PromiseRejectedResult).reason instanceof RateLimitedError,
    );
    expect(limited).toHaveLength(1);
  });

  it("is visible to admins only", async () => {
    await expect(getWaitlist(couple)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(exportWaitlistCsv(couple)).rejects.toBeInstanceOf(ForbiddenError);

    const page = await getWaitlist(admin);
    expect(page.items.some((entry) => entry.email === `meera${DOMAIN}`)).toBe(true);
    expect(page.total).toBeGreaterThanOrEqual(3);
    expect(page.byRole.COUPLE).toBeGreaterThanOrEqual(1);

    const csv = await exportWaitlistCsv(admin);
    expect(csv.split("\r\n")[0]).toBe(
      '"Joined","Email","Name","Role","Wedding month","City","Source"',
    );
    expect(csv).toContain(`"meera${DOMAIN}","Meera Iyer","COUPLE","2027-02","Pune","test-${run}"`);
  });
});

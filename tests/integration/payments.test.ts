import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, PaymentError } from "@/lib/errors";
import { fundingPercent } from "@/lib/money";
import { resetRateLimits } from "@/lib/rate-limit";
import type { Actor } from "@/modules/auth/session";
import {
  expireAbandonedContributions,
  getGiftView,
  startContribution,
} from "@/modules/contribution/contribution.service";
import { createDream } from "@/modules/dream/dream.service";
import { dispatchNotifications } from "@/modules/notification/dispatch.service";
import { handleProviderWebhook, verifyCheckout } from "@/modules/payment/payment.service";
import { getMockProvider } from "@/modules/payment/providers";
import { InvalidSignatureError } from "@/modules/payment/providers/types";
import {
  getPublicWedding,
  getWorkspace,
  publishWedding,
  saveNames,
  updateSettings,
} from "@/modules/wedding/wedding.service";
import { createTestDb, deleteTestUsers, hasDatabase } from "../support/db";

const run = crypto.randomUUID().slice(0, 8);
const EMAIL_SUFFIX = `@pay-${run}.vowfund.test`;
const FEE_BPS = 250;

describe.skipIf(!hasDatabase)("guest contributions and payments", () => {
  const db = createTestDb();
  const mock = getMockProvider();
  let couple: Actor;
  let slug: string;
  let dreamId: string;

  const gift = (overrides: Record<string, unknown> = {}) => ({
    dreamId,
    amountRupees: 5_000,
    guestName: "Ananya Rao",
    guestEmail: `ananya-${crypto.randomUUID().slice(0, 6)}${EMAIL_SUFFIX}`,
    isAnonymous: false,
    message: "Wishing you both a lifetime of adventures.",
    messageVisibility: "PUBLIC",
    consent: true,
    idempotencyKey: crypto.randomUUID(),
    ...overrides,
  });

  const dream = () => db.dream.findUniqueOrThrow({ where: { id: dreamId } });
  const start = (input: Record<string, unknown>) => startContribution(slug, input, "test-client");

  /** Pays through the browser-callback path. */
  async function pay(
    session: Awaited<ReturnType<typeof start>>,
    outcome: "captured" | "failed" = "captured",
  ) {
    const callback = mock.simulatePayment(session.payment.orderId, session.totalPaise, outcome);
    return verifyCheckout(session.contributionId, session.acknowledgmentToken, callback);
  }

  beforeAll(async () => {
    const email = `couple${EMAIL_SUFFIX}`;
    const user = await db.user.create({ data: { email, emailVerified: true } });
    couple = { userId: user.id, email };
    slug = (
      await saveNames(couple, { partnerOneName: `Meera${run}`, partnerTwoName: `Kabir${run}` })
    ).slug;
    dreamId = (
      await createDream(couple, {
        title: "A week in the Swiss Alps",
        description: "Train rides through the mountains and a first snowfall together.",
        category: "HONEYMOON",
        targetRupees: 300_000,
        coverImageId: null,
        isActive: true,
      })
    ).dream.id;
    await publishWedding(couple);
  });

  // Every test here shares one client key; the limiter has its own test below.
  beforeEach(() => resetRateLimits());

  afterAll(async () => {
    await deleteTestUsers(db, EMAIL_SUFFIX);
    await db.$disconnect();
  });

  describe("starting checkout", () => {
    it("records a pending gift with the fee computed on the server, and counts nothing yet", async () => {
      const session = await start(gift({ totalPaise: 1, platformFeePaise: 0, amountPaise: 1 }));
      expect(session).toMatchObject({
        status: "PENDING",
        amountPaise: 500_000,
        platformFeePaise: (500_000 * FEE_BPS) / 10_000,
        totalPaise: 512_500,
        payment: { provider: "MOCK", mode: "TEST" },
      });
      expect(await dream()).toMatchObject({ fundedPaise: 0, contributionCount: 0 });
      expect((await getPublicWedding(slug))!.gifts).toEqual([]);
    });

    it("returns the same gift and order when the form is submitted repeatedly, even at once", async () => {
      const input = gift();
      const sessions = await Promise.all(Array.from({ length: 6 }, () => start(input)));
      expect(new Set(sessions.map((session) => session.contributionId)).size).toBe(1);
      expect(new Set(sessions.map((session) => session.payment.orderId)).size).toBe(1);
      expect(await db.contribution.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(
        1,
      );
      expect(
        await db.payment.count({ where: { contributionId: sessions[0]!.contributionId } }),
      ).toBe(1);
    });

    it.each([
      ["an amount below the minimum", { amountRupees: 99 }],
      ["an amount above the maximum", { amountRupees: 500_001 }],
      ["a fractional amount", { amountRupees: 500.5 }],
      ["a missing consent", { consent: false }],
      ["an invalid email", { guestEmail: "not-an-email" }],
      ["a blank name", { guestName: " " }],
      ["an over-long message", { message: "x".repeat(501) }],
    ])("rejects %s", async (_label, overrides) => {
      await expect(start(gift(overrides))).rejects.toThrow();
    });

    it("refuses a dream that does not exist, is hidden, or belongs to an unpublished page", async () => {
      await expect(start(gift({ dreamId: crypto.randomUUID() }))).rejects.toBeInstanceOf(
        NotFoundError,
      );

      const hidden = await createDream(couple, {
        title: "Hidden dream",
        description: "Not open for contributions.",
        category: "OTHER",
        targetRupees: 10_000,
        coverImageId: null,
        isActive: false,
      });
      await expect(start(gift({ dreamId: hidden.dream.id }))).rejects.toBeInstanceOf(NotFoundError);

      // A real dream, but reached through the wrong wedding address.
      await expect(startContribution("some-other-wedding", gift(), "c")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("rate limits one client that starts too many checkouts", async () => {
      resetRateLimits();
      const attempts = Array.from({ length: 21 }, () =>
        startContribution(slug, gift(), "greedy-client").then(
          () => "ok",
          (error: Error) => error.name,
        ),
      );
      const results = await Promise.all(attempts);
      expect(results.filter((result) => result === "RateLimitedError")).toHaveLength(1);
      resetRateLimits();
    });
  });

  describe("verifying payment", () => {
    it("rejects a forged callback and counts nothing", async () => {
      const session = await start(gift());
      const before = await dream();
      const callback = mock.simulatePayment(
        session.payment.orderId,
        session.totalPaise,
        "captured",
      );

      await expect(
        verifyCheckout(session.contributionId, session.acknowledgmentToken, {
          ...callback,
          signature: "0".repeat(64),
        }),
      ).rejects.toBeInstanceOf(PaymentError);
      // A valid signature for a different order must not confirm this one.
      const elsewhere = mock.simulatePayment(
        "mockorder_someone_else",
        session.totalPaise,
        "captured",
      );
      await expect(
        verifyCheckout(session.contributionId, session.acknowledgmentToken, elsewhere),
      ).rejects.toBeInstanceOf(PaymentError);
      // The wrong private token cannot even find the contribution.
      await expect(
        verifyCheckout(session.contributionId, "x".repeat(43), callback),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(await dream()).toMatchObject({
        fundedPaise: before.fundedPaise,
        contributionCount: before.contributionCount,
      });
      expect((await getGiftView(session.acknowledgmentToken))!.status).toBe("PENDING");
    });

    it("refuses to credit a payment captured for a different amount", async () => {
      const session = await start(gift());
      const before = await dream();
      const underpaid = mock.simulatePayment(session.payment.orderId, 100, "captured");
      await expect(
        verifyCheckout(session.contributionId, session.acknowledgmentToken, underpaid),
      ).rejects.toThrow(/does not match/);

      const webhook = mock.buildWebhook(underpaid);
      await expect(handleProviderWebhook(webhook.rawBody, webhook.signature)).rejects.toThrow(
        /does not match/,
      );
      const event = await db.paymentEvent.findFirstOrThrow({
        where: { payload: { path: ["paymentId"], equals: underpaid.providerPaymentId } },
      });
      expect(event.status).toBe("FAILED");
      expect((await dream()).fundedPaise).toBe(before.fundedPaise);
    });

    it("confirms a captured payment and adds the gift, not the fee, to the dream", async () => {
      const before = await dream();
      const session = await start(gift());
      const outcome = await pay(session);
      expect(outcome).toEqual({ slug, status: "CONFIRMED" });
      expect(await dream()).toMatchObject({
        fundedPaise: before.fundedPaise + 500_000,
        contributionCount: before.contributionCount + 1,
      });
      expect((await getGiftView(session.acknowledgmentToken))!.status).toBe("CONFIRMED");

      const transitions = await db.paymentStatusTransition.findMany({
        where: { payment: { contributionId: session.contributionId } },
        orderBy: { createdAt: "asc" },
      });
      expect(transitions.map((t) => `${t.fromStatus}>${t.toStatus}:${t.source}`)).toEqual([
        "null>CREATED:SYSTEM",
        "CREATED>CAPTURED:CHECKOUT_VERIFY",
      ]);
    });

    it("a failed payment counts nothing, and a retry on the same order can still succeed", async () => {
      const before = await dream();
      const session = await start(gift());
      expect((await pay(session, "failed")).status).toBe("FAILED");
      expect((await getGiftView(session.acknowledgmentToken))!.status).toBe("FAILED");
      expect((await dream()).fundedPaise).toBe(before.fundedPaise);

      expect((await pay(session, "captured")).status).toBe("CONFIRMED");
      expect((await dream()).fundedPaise).toBe(before.fundedPaise + 500_000);
    });
  });

  describe("webhooks", () => {
    it("rejects an invalid signature without storing anything", async () => {
      const session = await start(gift());
      const callback = mock.simulatePayment(
        session.payment.orderId,
        session.totalPaise,
        "captured",
      );
      const { rawBody } = mock.buildWebhook(callback, `evt-bad-${run}`);
      await expect(handleProviderWebhook(rawBody, "bad-signature")).rejects.toBeInstanceOf(
        InvalidSignatureError,
      );
      expect(await db.paymentEvent.count({ where: { providerEventId: `evt-bad-${run}` } })).toBe(0);
      expect((await getGiftView(session.acknowledgmentToken))!.status).toBe("PENDING");
    });

    it("processes a delivery once however many times it arrives", async () => {
      const before = await dream();
      const session = await start(gift());
      const callback = mock.simulatePayment(
        session.payment.orderId,
        session.totalPaise,
        "captured",
      );
      const webhook = mock.buildWebhook(callback, `evt-dupe-${run}`);

      const first = await handleProviderWebhook(webhook.rawBody, webhook.signature);
      expect(first).toEqual({ outcome: "processed", slug });
      for (let i = 0; i < 3; i += 1) {
        expect(await handleProviderWebhook(webhook.rawBody, webhook.signature)).toEqual({
          outcome: "duplicate",
        });
      }
      // A second, different event about the same payment is also harmless.
      const again = mock.buildWebhook(callback, `evt-dupe2-${run}`);
      expect(await handleProviderWebhook(again.rawBody, again.signature)).toEqual({
        outcome: "processed",
        slug: null,
      });

      expect(await dream()).toMatchObject({
        fundedPaise: before.fundedPaise + 500_000,
        contributionCount: before.contributionCount + 1,
      });
      expect(await db.paymentEvent.count({ where: { providerEventId: `evt-dupe-${run}` } })).toBe(
        1,
      );
    });

    it("ignores an event for an order it does not know", async () => {
      const stray = mock.buildWebhook(mock.simulatePayment("mockorder_unknown", 100, "captured"));
      expect(await handleProviderWebhook(stray.rawBody, stray.signature)).toEqual({
        outcome: "ignored",
      });
    });
  });

  describe("concurrency", () => {
    it("counts a payment once when the callback and many webhooks race", async () => {
      const before = await dream();
      const session = await start(gift());
      const callback = mock.simulatePayment(
        session.payment.orderId,
        session.totalPaise,
        "captured",
      );
      const sameEvent = mock.buildWebhook(callback, `evt-race-${run}`);

      const results = await Promise.allSettled([
        ...Array.from({ length: 4 }, () =>
          verifyCheckout(session.contributionId, session.acknowledgmentToken, callback),
        ),
        ...Array.from({ length: 4 }, () =>
          handleProviderWebhook(sameEvent.rawBody, sameEvent.signature),
        ),
        ...Array.from({ length: 4 }, () => {
          const fresh = mock.buildWebhook(callback);
          return handleProviderWebhook(fresh.rawBody, fresh.signature);
        }),
      ]);
      expect(results.filter((result) => result.status === "rejected")).toEqual([]);

      expect(await dream()).toMatchObject({
        fundedPaise: before.fundedPaise + 500_000,
        contributionCount: before.contributionCount + 1,
      });
      const captures = await db.paymentStatusTransition.count({
        where: { payment: { contributionId: session.contributionId }, toStatus: "CAPTURED" },
      });
      expect(captures).toBe(1);
    });

    it("adds up exactly when many guests pay for the same dream at once", async () => {
      const before = await dream();
      const amounts = [1_100, 2_100, 5_100, 11_000, 501, 999, 25_000, 100, 7_777, 51_000];
      const sessions = await Promise.all(
        amounts.map((amountRupees) => start(gift({ amountRupees }))),
      );
      await Promise.all(sessions.map((session) => pay(session)));

      const expected = amounts.reduce((sum, rupees) => sum + rupees * 100, 0);
      expect(await dream()).toMatchObject({
        fundedPaise: before.fundedPaise + expected,
        contributionCount: before.contributionCount + amounts.length,
      });
    });
  });

  it("allows a dream to be overfunded and caps the displayed progress at 100%", async () => {
    const small = await createDream(couple, {
      title: "A picnic",
      description: "A small dream that one gift can exceed.",
      category: "EXPERIENCES",
      targetRupees: 1_000,
      coverImageId: null,
      isActive: true,
    });
    await pay(await start(gift({ dreamId: small.dream.id, amountRupees: 5_000 })));
    const funded = await db.dream.findUniqueOrThrow({ where: { id: small.dream.id } });
    expect(funded.fundedPaise).toBe(500_000);
    expect(funded.fundedPaise).toBeGreaterThan(funded.targetPaise);
    expect(fundingPercent(funded.fundedPaise, funded.targetPaise)).toBe(100);
  });

  it("the stored totals always equal the sum of captured gifts", async () => {
    const dreams = await db.dream.findMany({ where: { wedding: { slug } } });
    for (const each of dreams) {
      const captured = await db.contribution.aggregate({
        where: {
          dreamId: each.id,
          payment: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } },
        },
        _sum: { amountPaise: true },
        _count: true,
      });
      expect(each.fundedPaise).toBe(captured._sum.amountPaise ?? 0);
      expect(each.contributionCount).toBe(captured._count);
    }
    const confirmed = await db.contribution.count({
      where: { wedding: { slug }, status: "CONFIRMED" },
    });
    const capturedPayments = await db.payment.count({
      where: { contribution: { wedding: { slug } }, status: "CAPTURED" },
    });
    expect(confirmed).toBe(capturedPayments);
  });

  describe("emails", () => {
    it("queues one receipt for the guest and one notice for the couple, then sends them", async () => {
      const input = gift();
      const session = await start(input);
      const callback = mock.simulatePayment(
        session.payment.orderId,
        session.totalPaise,
        "captured",
      );
      await verifyCheckout(session.contributionId, session.acknowledgmentToken, callback);
      const webhook = mock.buildWebhook(callback);
      await handleProviderWebhook(webhook.rawBody, webhook.signature);

      const queued = await db.notification.findMany({
        where: { dedupeKey: { contains: session.contributionId } },
      });
      expect(queued.map((n) => `${n.type}:${n.recipient}`).sort()).toEqual([
        `gift_receipt:${input.guestEmail}`,
        `gift_received:${couple.email}`,
      ]);
      expect(JSON.stringify(queued[0]!.payload)).toContain("₹5,000");

      await dispatchNotifications(200);
      const after = await db.notification.findMany({
        where: { dedupeKey: { contains: session.contributionId } },
      });
      expect(after.every((n) => n.status === "SENT" && n.sentAt !== null)).toBe(true);
      // Running the dispatcher again sends nothing twice.
      const sentAt = after.map((n) => n.sentAt?.getTime());
      await dispatchNotifications(200);
      const again = await db.notification.findMany({
        where: { dedupeKey: { contains: session.contributionId } },
      });
      expect(again.map((n) => n.sentAt?.getTime())).toEqual(sentAt);
    });
  });

  describe("what other guests can see", () => {
    it("honours anonymity, private messages and the couple's privacy settings", async () => {
      await pay(
        await start(
          gift({ guestName: "Secret Santa", isAnonymous: true, message: "From an admirer." }),
        ),
      );
      await pay(
        await start(
          gift({
            guestName: "Private Priya",
            message: "For your eyes only.",
            messageVisibility: "COUPLE_ONLY",
          }),
        ),
      );
      const pendingOnly = await start(
        gift({ guestName: "Never Paid", message: "Unpaid message." }),
      );

      let page = (await getPublicWedding(slug))!;
      const serialised = JSON.stringify(page);
      expect(serialised).not.toContain("Secret Santa");
      expect(serialised).toContain("From an admirer.");
      expect(serialised).toContain("Private Priya");
      expect(serialised).not.toContain("For your eyes only.");
      expect(serialised).not.toContain("Never Paid");
      expect(serialised).not.toContain("Unpaid message.");
      expect(serialised).not.toContain(EMAIL_SUFFIX);
      expect(serialised).not.toContain(pendingOnly.acknowledgmentToken);
      expect(page.gifts.every((entry) => entry.amountPaise === null)).toBe(true);
      expect(page.gifts.length).toBeLessThanOrEqual(12);

      const { wedding, couple: names } = await getWorkspace(couple);
      const settings = {
        partnerOneName: names.partnerOneName,
        partnerTwoName: names.partnerTwoName,
        slug,
        weddingDate: "",
        venueName: "",
        city: "",
        welcomeMessage: "",
        thankYouMessage: "",
        theme: wedding!.theme,
        showProgress: true,
        showGuestNames: false,
        showGuestMessages: true,
        showAmounts: true,
        allowIndexing: false,
      };
      await updateSettings(couple, settings);
      page = (await getPublicWedding(slug))!;
      expect(JSON.stringify(page)).not.toContain("Private Priya");
      expect(page.gifts.some((entry) => entry.name === "A guest")).toBe(true);
      expect(page.gifts.some((entry) => entry.name === "Anonymous")).toBe(true);
      expect(page.gifts.every((entry) => typeof entry.amountPaise === "number")).toBe(true);

      await updateSettings(couple, { ...settings, showGuestMessages: false });
      expect((await getPublicWedding(slug))!.gifts).toEqual([]);
      await updateSettings(couple, { ...settings, showGuestNames: true, showAmounts: false });
    });

    it("a guest's private link shows their own gift and nothing for a wrong token", async () => {
      const session = await start(gift({ guestName: "Link Holder" }));
      await pay(session);
      expect(await getGiftView(session.acknowledgmentToken)).toMatchObject({
        status: "CONFIRMED",
        guestName: "Link Holder",
        amountPaise: 500_000,
        totalPaise: 512_500,
        demo: true,
      });
      expect(await getGiftView("a".repeat(43))).toBeNull();
      expect(await getGiftView("../../etc/passwd")).toBeNull();
    });
  });

  it("closes checkouts abandoned for over an hour, but never a paid one", async () => {
    const abandoned = await start(gift());
    const paid = await start(gift());
    await pay(paid);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await db.contribution.updateMany({
      where: { id: { in: [abandoned.contributionId, paid.contributionId] } },
      data: { createdAt: twoHoursAgo },
    });
    expect(await expireAbandonedContributions()).toBeGreaterThanOrEqual(1);
    expect((await getGiftView(abandoned.acknowledgmentToken))!.status).toBe("EXPIRED");
    expect((await getGiftView(paid.acknowledgmentToken))!.status).toBe("CONFIRMED");
  });
});

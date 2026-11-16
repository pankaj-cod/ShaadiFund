import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { resetRateLimits } from "@/lib/rate-limit";
import * as admin from "@/modules/admin/admin.service";
import { recordBrowserEvent, sessionHash } from "@/modules/analytics/analytics.service";
import type { Actor } from "@/modules/auth/session";
import { getGiftView, startContribution } from "@/modules/contribution/contribution.service";
import {
  listGifts,
  sendThankYou,
  setGiftMessageHidden,
} from "@/modules/contribution/gifts.service";
import { createDream } from "@/modules/dream/dream.service";
import { verifyCheckout } from "@/modules/payment/payment.service";
import { getMockProvider } from "@/modules/payment/providers";
import { getPublicWedding, publishWedding, saveNames } from "@/modules/wedding/wedding.service";
import { createTestDb, deleteTestUsers, hasDatabase } from "../support/db";

const run = crypto.randomUUID().slice(0, 8);
const EMAIL_SUFFIX = `@ga-${run}.vowfund.test`;

describe.skipIf(!hasDatabase)("couple gifts, admin console and analytics", () => {
  const db = createTestDb();
  const mock = getMockProvider();
  let couple: Actor;
  let stranger: Actor;
  let staff: Actor;
  let slug: string;
  let weddingId: string;
  let dreamId: string;
  let publicGift: Awaited<ReturnType<typeof give>>;
  let anonymousGift: Awaited<ReturnType<typeof give>>;

  async function createActor(name: string, role: "COUPLE" | "ADMIN" = "COUPLE"): Promise<Actor> {
    const email = `${name}${EMAIL_SUFFIX}`;
    const user = await db.user.create({ data: { email, emailVerified: true, role } });
    return { userId: user.id, email };
  }

  async function give(overrides: Record<string, unknown> = {}) {
    const session = await startContribution(
      slug,
      {
        dreamId,
        amountRupees: 5_000,
        guestName: "Ananya Rao",
        guestEmail: `ananya-${crypto.randomUUID().slice(0, 6)}${EMAIL_SUFFIX}`,
        isAnonymous: false,
        message: "Wishing you a lifetime of adventures.",
        messageVisibility: "PUBLIC",
        consent: true,
        idempotencyKey: crypto.randomUUID(),
        ...overrides,
      },
      "test-client",
    );
    await verifyCheckout(
      session.contributionId,
      session.acknowledgmentToken,
      mock.simulatePayment(session.payment.orderId, session.totalPaise, "captured"),
    );
    return session;
  }

  beforeEach(() => resetRateLimits());

  beforeAll(async () => {
    couple = await createActor("couple");
    stranger = await createActor("stranger");
    staff = await createActor("staff", "ADMIN");
    slug = (await saveNames(couple, { partnerOneName: `Tara${run}`, partnerTwoName: `Dev${run}` }))
      .slug;
    await saveNames(stranger, { partnerOneName: `Other${run}`, partnerTwoName: `Pair${run}` });
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
    weddingId = (await db.wedding.findUniqueOrThrow({ where: { slug } })).id;
    publicGift = await give();
    anonymousGift = await give({ guestName: "Secret Santa", isAnonymous: true, message: "" });
  });

  afterAll(async () => {
    await deleteTestUsers(db, EMAIL_SUFFIX);
    await db.$disconnect();
  });

  describe("the couple's gifts page", () => {
    it("shows every paid gift with the guest's details, including anonymous ones", async () => {
      const page = await listGifts(couple);
      expect(page.summary).toEqual({ totalPaise: 1_000_000, count: 2 });
      expect(page.nextCursor).toBeNull();
      expect(page.gifts.map((gift) => gift.guestName).sort()).toEqual([
        "Ananya Rao",
        "Secret Santa",
      ]);
      const anonymous = page.gifts.find((gift) => gift.isAnonymous)!;
      expect(anonymous.guestEmail).toContain(EMAIL_SUFFIX);
      expect(anonymous.message).toBeNull();
    });

    it("never shows an unpaid checkout", async () => {
      await startContribution(
        slug,
        {
          dreamId,
          amountRupees: 900,
          guestName: "Never Paid",
          guestEmail: `never${EMAIL_SUFFIX}`,
          isAnonymous: false,
          message: "",
          messageVisibility: "PUBLIC",
          consent: true,
          idempotencyKey: crypto.randomUUID(),
        },
        "test-client",
      );
      const page = await listGifts(couple);
      expect(page.gifts.map((gift) => gift.guestName)).not.toContain("Never Paid");
      expect(page.summary.count).toBe(2);
    });

    it("another couple sees none of it and cannot act on it", async () => {
      expect((await listGifts(stranger)).gifts).toEqual([]);
      await expect(
        sendThankYou(stranger, publicGift.contributionId, { note: "Not mine to thank." }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        setGiftMessageHidden(stranger, publicGift.contributionId, true),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await getGiftView(publicGift.acknowledgmentToken))!.coupleReply).toBeNull();
    });

    it("sends a thank-you once and lets it be edited without a second email", async () => {
      await expect(
        sendThankYou(couple, publicGift.contributionId, { note: " " }),
      ).rejects.toThrow();
      await sendThankYou(couple, publicGift.contributionId, { note: "Thank you so much, Ananya!" });
      expect((await getGiftView(publicGift.acknowledgmentToken))!.coupleReply).toBe(
        "Thank you so much, Ananya!",
      );
      await sendThankYou(couple, publicGift.contributionId, { note: "Thank you, dear Ananya!" });
      expect((await getGiftView(publicGift.acknowledgmentToken))!.coupleReply).toBe(
        "Thank you, dear Ananya!",
      );
      const emails = await db.notification.findMany({
        where: { dedupeKey: `thank_you:${publicGift.contributionId}` },
      });
      expect(emails).toHaveLength(1);
      expect(emails[0]!.type).toBe("thank_you");
      // A guest who left no message can still be thanked.
      await sendThankYou(couple, anonymousGift.contributionId, {
        note: "Thank you, whoever you are.",
      });
      expect((await listGifts(couple)).gifts.every((gift) => gift.thankYouNote)).toBe(true);
    });

    it("hiding a message removes it from the public page but not from the couple", async () => {
      const text = "Wishing you a lifetime of adventures.";
      expect(JSON.stringify(await getPublicWedding(slug))).toContain(text);
      await setGiftMessageHidden(couple, publicGift.contributionId, true);
      expect(JSON.stringify(await getPublicWedding(slug))).not.toContain(text);
      const mine = (await listGifts(couple)).gifts.find(
        (gift) => gift.id === publicGift.contributionId,
      )!;
      expect(mine.message).toMatchObject({ body: text, isHidden: true });
      await setGiftMessageHidden(couple, publicGift.contributionId, false);
      expect(JSON.stringify(await getPublicWedding(slug))).toContain(text);
      // A gift with no message has nothing to hide.
      await expect(
        setGiftMessageHidden(couple, anonymousGift.contributionId, true),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("admin console", () => {
    const paymentIdOf = async (contributionId: string) =>
      (await db.payment.findUniqueOrThrow({ where: { contributionId } })).id;

    it("refuses every admin function to a signed-in user who is not staff", async () => {
      const paymentId = await paymentIdOf(publicGift.contributionId);
      const attempts = [
        admin.getMetrics(couple, null),
        admin.getCouples(couple),
        admin.getPayments(couple, {}),
        admin.getPayment(couple, paymentId),
        admin.getPaymentEvents(couple, {}),
        admin.getAuditLogs(couple),
        admin.suspendWedding(couple, weddingId, { reason: "I should not be able to" }),
        admin.restoreWedding(couple, weddingId),
        admin.refundAsAdmin(couple, paymentId, { reason: "Refund my own guest" }),
      ];
      for (const result of await Promise.allSettled(attempts)) {
        expect(result.status).toBe("rejected");
        expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenError);
      }
      expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe(
        "CAPTURED",
      );
    });

    it("loses access the moment the role is removed", async () => {
      const temp = await createActor("temp-staff", "ADMIN");
      await expect(admin.getMetrics(temp, null)).resolves.toBeDefined();
      await db.user.update({ where: { id: temp.userId }, data: { role: "COUPLE" } });
      await expect(admin.getMetrics(temp, null)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("reports platform metrics", async () => {
      const metrics = await admin.getMetrics(staff, "TEST");
      expect(metrics.couples).toBeGreaterThanOrEqual(2);
      expect(metrics.publishedWeddings).toBeGreaterThanOrEqual(1);
      expect(metrics.contributions).toBeGreaterThanOrEqual(2);
      expect(metrics.guests).toBeGreaterThanOrEqual(2);
      expect(metrics.volumePaise).toBeGreaterThanOrEqual(1_000_000);
      expect(metrics.feesPaise).toBeGreaterThanOrEqual(25_000);
      expect(metrics.checkouts).toBeGreaterThanOrEqual(metrics.contributions);
      for (const rate of [metrics.checkoutConversion, metrics.paymentSuccessRate]) {
        expect(rate).not.toBeNull();
        expect(rate!).toBeGreaterThan(0);
        expect(rate!).toBeLessThanOrEqual(1);
      }
      expect(metrics.categories.map((row) => row.category)).toContain("HONEYMOON");
      // Nothing here has been paid in live mode.
      const live = await admin.getMetrics(staff, "LIVE");
      expect(live.contributions).toBe(0);
      expect(live.volumePaise).toBe(0);
    });

    it("lists couples, payments and a payment's full history", async () => {
      const couples = await admin.getCouples(staff);
      const mine = couples.items.find((item) => item.wedding?.slug === slug)!;
      expect(mine).toMatchObject({
        emails: [couple.email],
        wedding: { status: "PUBLISHED", dreamCount: 1 },
      });
      expect(mine.wedding!.raisedPaise).toBe(1_000_000);

      const captured = await admin.getPayments(staff, { status: "CAPTURED" });
      expect(captured.items.every((payment) => payment.status === "CAPTURED")).toBe(true);
      const paymentId = await paymentIdOf(publicGift.contributionId);
      const detail = await admin.getPayment(staff, paymentId);
      expect(detail!.transitions.map((t) => t.toStatus)).toEqual(["CREATED", "CAPTURED"]);
      expect(await admin.getPayment(staff, "not-a-uuid")).toBeNull();
      expect((await admin.getAuditLogs(staff)).items.length).toBeGreaterThan(0);
    });

    it("suspends a page so guests cannot see it and the couple cannot republish, then restores it", async () => {
      await expect(admin.suspendWedding(staff, weddingId, { reason: "no" })).rejects.toThrow();
      await admin.suspendWedding(staff, weddingId, { reason: "Reported content under review" });
      expect(await getPublicWedding(slug)).toBeNull();
      await expect(publishWedding(couple)).rejects.toBeInstanceOf(ConflictError);
      await expect(
        admin.suspendWedding(staff, weddingId, { reason: "Suspending it twice" }),
      ).rejects.toBeInstanceOf(ConflictError);

      await admin.restoreWedding(staff, weddingId);
      expect(await getPublicWedding(slug)).toBeNull();
      await publishWedding(couple);
      expect(await getPublicWedding(slug)).not.toBeNull();

      const actions = (
        await db.auditLog.findMany({ where: { entityId: weddingId, actorUserId: staff.userId } })
      ).map((entry) => `${entry.actorType}:${entry.action}`);
      expect(actions).toEqual(
        expect.arrayContaining(["ADMIN:wedding.suspended", "ADMIN:wedding.restored"]),
      );
    });

    it("refunds a payment, recording which admin did it and why", async () => {
      const paymentId = await paymentIdOf(anonymousGift.contributionId);
      await expect(admin.refundAsAdmin(staff, paymentId, { reason: "x" })).rejects.toThrow();
      await admin.refundAsAdmin(staff, paymentId, { reason: "Guest paid twice by mistake" });

      const refund = await db.refund.findFirstOrThrow({ where: { paymentId } });
      expect(refund).toMatchObject({
        status: "PROCESSED",
        initiatedByUserId: staff.userId,
        reason: "Guest paid twice by mistake",
      });
      const page = await listGifts(couple);
      expect(page.summary).toEqual({ totalPaise: 500_000, count: 1 });
      expect(page.gifts.find((gift) => gift.id === anonymousGift.contributionId)!.status).toBe(
        "REFUNDED",
      );
      expect((await db.dream.findUniqueOrThrow({ where: { id: dreamId } })).fundedPaise).toBe(
        500_000,
      );
    });
  });

  describe("analytics", () => {
    const count = (name: string) => db.analyticsEvent.count({ where: { name, weddingId } });

    it("recorded the journey's events on the server", async () => {
      expect(await count("wedding_published")).toBeGreaterThanOrEqual(1);
      expect(await count("onboarding_completed")).toBe(1);
      expect(await count("wishlist_created")).toBe(1);
      expect(await count("checkout_initiated")).toBe(3);
      expect(await count("guest_message_submitted")).toBe(1);
      expect(await count("contribution_succeeded")).toBe(2);
    });

    it("accepts page views from browsers for published pages only, storing no address", async () => {
      const client = { address: "203.0.113.7", userAgent: "TestBrowser/1.0" };
      await recordBrowserEvent({ name: "wedding_page_viewed", slug }, client);
      await recordBrowserEvent({ name: "dream_selected", slug, dreamId }, client);
      await recordBrowserEvent({ name: "contribution_succeeded", slug }, client);
      await recordBrowserEvent({ name: "wedding_page_viewed", slug: "no-such-wedding" }, client);
      await recordBrowserEvent("garbage", client);

      expect(await count("wedding_page_viewed")).toBe(1);
      expect(await count("dream_selected")).toBe(1);
      expect(await count("contribution_succeeded")).toBe(2);
      const view = await db.analyticsEvent.findFirstOrThrow({
        where: { name: "wedding_page_viewed", weddingId },
      });
      expect(view.sessionHash).toMatch(/^[0-9a-f]{32}$/);
      expect(JSON.stringify(view)).not.toContain("203.0.113.7");
      expect(JSON.stringify(view)).not.toContain("TestBrowser");
    });

    it("gives a visitor the same hash within a day and a different one the next day", () => {
      const monday = new Date("2026-11-16T10:00:00Z");
      const a = sessionHash("203.0.113.7", "UA", monday);
      expect(sessionHash("203.0.113.7", "UA", new Date("2026-11-16T23:59:00Z"))).toBe(a);
      expect(sessionHash("203.0.113.7", "UA", new Date("2026-11-17T00:01:00Z"))).not.toBe(a);
      expect(sessionHash("203.0.113.8", "UA", monday)).not.toBe(a);
    });
  });
});

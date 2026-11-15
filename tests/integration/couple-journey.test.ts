import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/modules/auth/session";
import {
  createDream,
  deleteDream,
  reorderDreams,
  updateDream,
} from "@/modules/dream/dream.service";
import { processImage, uploadImage } from "@/modules/media/media.service";
import {
  getPublicWedding,
  getWorkspace,
  publishWedding,
  saveNames,
  saveTheme,
  saveVenue,
  saveWeddingDate,
  unpublishWedding,
  updateSettings,
} from "@/modules/wedding/wedding.service";
import { createTestDb, deleteTestUsers, hasDatabase } from "../support/db";

const run = crypto.randomUUID().slice(0, 8);
const EMAIL_SUFFIX = `@it-${run}.vowfund.test`;
// Names unique to this run so generated addresses never collide with other data.
const A = `Asha${run}`;
const B = `Bharat${run}`;

const dreamInput = {
  title: "A week in the Swiss Alps",
  description: "Train rides through the mountains and a first snowfall together.",
  category: "HONEYMOON",
  targetRupees: 300_000,
  coverImageId: null,
  isActive: true,
} as const;

describe.skipIf(!hasDatabase)("couple journey (services against the database)", () => {
  const db = createTestDb();
  let riya: Actor;
  let stranger: Actor;

  async function createActor(name: string): Promise<Actor> {
    const email = `${name}${EMAIL_SUFFIX}`;
    const user = await db.user.create({ data: { email, emailVerified: true } });
    return { userId: user.id, email };
  }

  beforeAll(async () => {
    riya = await createActor("riya");
    stranger = await createActor("stranger");
  });

  afterAll(async () => {
    await deleteTestUsers(db, EMAIL_SUFFIX);
    await db.$disconnect();
  });

  it("starts a new user with an empty workspace at the first step", async () => {
    const workspace = await getWorkspace(riya);
    expect(workspace.wedding).toBeNull();
    expect(workspace.dreams).toEqual([]);
    expect(workspace.couple.onboardingStep).toBe(2);
    expect(workspace.couple.onboardingCompleted).toBe(false);
  });

  it("creates exactly one couple even when requests race", async () => {
    await Promise.all(Array.from({ length: 5 }, () => getWorkspace(stranger)));
    expect(await db.coupleMember.count({ where: { userId: stranger.userId } })).toBe(1);
  });

  it("saving names creates the wedding with a readable address and advances onboarding", async () => {
    const { slug } = await saveNames(riya, { partnerOneName: `${A}x`, partnerTwoName: B });
    expect(slug).toBe(`${A}x-and-${B}`.toLowerCase());
    const workspace = await getWorkspace(riya);
    expect(workspace.wedding?.status).toBe("DRAFT");
    expect(workspace.couple.onboardingStep).toBe(3);
  });

  it("correcting a name while still a draft corrects the address too", async () => {
    const { slug, replacedSlugs } = await saveNames(riya, { partnerOneName: A, partnerTwoName: B });
    expect(slug).toBe(`${A}-and-${B}`.toLowerCase());
    expect(replacedSlugs).toEqual([`${A}x-and-${B}`.toLowerCase()]);
  });

  it("gives a second couple with the same names a different address", async () => {
    const { slug } = await saveNames(stranger, { partnerOneName: A, partnerTwoName: B });
    expect(slug).not.toBe(`${A}-and-${B}`.toLowerCase());
    expect(slug.startsWith(`${A}-and-${B}`.toLowerCase())).toBe(true);
  });

  it("rejects invalid step input with field messages", async () => {
    await expect(saveNames(riya, { partnerOneName: "", partnerTwoName: B })).rejects.toThrow();
    await expect(saveWeddingDate(riya, { weddingDate: "14/02/2027" })).rejects.toThrow();
    await expect(saveTheme(riya, { theme: "NEON" })).rejects.toThrow();
  });

  it("saves date, venue and theme", async () => {
    await saveWeddingDate(riya, { weddingDate: "2027-02-14" });
    await saveVenue(riya, { venueName: "The Leela Palace", city: "Udaipur" });
    await saveTheme(riya, { theme: "ROYAL_INDIAN" });
    const { wedding, couple } = await getWorkspace(riya);
    expect(wedding).toMatchObject({
      weddingDate: "2027-02-14",
      venueName: "The Leela Palace",
      city: "Udaipur",
      theme: "ROYAL_INDIAN",
    });
    expect(couple.onboardingStep).toBe(7);
  });

  it("refuses to publish without a dream, and a draft is invisible to guests", async () => {
    await expect(publishWedding(riya)).rejects.toThrow(/at least one dream/);
    const { wedding } = await getWorkspace(riya);
    expect(await getPublicWedding(wedding!.slug)).toBeNull();
  });

  it("creates a dream with the target stored in paise", async () => {
    const { dream } = await createDream(riya, dreamInput);
    expect(dream.targetPaise).toBe(30_000_000);
    expect(dream.fundedPaise).toBe(0);
  });

  it("rejects a dream below the minimum, above the maximum, or with a fractional target", async () => {
    await expect(createDream(riya, { ...dreamInput, targetRupees: 999 })).rejects.toThrow();
    await expect(createDream(riya, { ...dreamInput, targetRupees: 10_000_001 })).rejects.toThrow();
    await expect(createDream(riya, { ...dreamInput, targetRupees: 5000.5 })).rejects.toThrow();
  });

  it("publishes, and the public view contains only guest-safe fields", async () => {
    const { slug } = await publishWedding(riya);
    const page = await getPublicWedding(slug);
    expect(page).not.toBeNull();
    expect(page!.dreams).toHaveLength(1);
    const serialised = JSON.stringify(page);
    expect(serialised).not.toContain(riya.email);
    expect(serialised).not.toContain(riya.userId);
    expect(Object.keys(page!)).not.toContain("coupleId");
    expect((await getWorkspace(riya)).couple.onboardingCompleted).toBe(true);
  });

  it("hides inactive dreams and, when asked, funding progress from guests", async () => {
    const { dream: hidden } = await createDream(riya, {
      ...dreamInput,
      title: "Hidden dream",
      isActive: false,
    });
    const { wedding, couple } = await getWorkspace(riya);
    let page = await getPublicWedding(wedding!.slug);
    expect(page!.dreams.map((dream) => dream.title)).not.toContain("Hidden dream");
    expect(page!.dreams[0]!.fundedPaise).toBe(0);

    await updateSettings(riya, {
      partnerOneName: couple.partnerOneName,
      partnerTwoName: couple.partnerTwoName,
      slug: wedding!.slug,
      weddingDate: wedding!.weddingDate ?? "",
      venueName: wedding!.venueName ?? "",
      city: wedding!.city ?? "",
      welcomeMessage: "Welcome!",
      thankYouMessage: "",
      theme: wedding!.theme,
      showProgress: false,
      showGuestNames: true,
      showGuestMessages: true,
      showAmounts: false,
      allowIndexing: false,
    });
    page = await getPublicWedding(wedding!.slug);
    expect(page!.dreams[0]!.fundedPaise).toBeNull();
    expect(page!.dreams[0]!.contributionCount).toBeNull();
    expect(page!.welcomeMessage).toBe("Welcome!");
    await deleteDream(riya, hidden.id);
  });

  it("refuses an address that another couple already uses", async () => {
    const theirs = (await getWorkspace(stranger)).wedding!;
    const { wedding, couple } = await getWorkspace(riya);
    await expect(
      updateSettings(riya, {
        partnerOneName: couple.partnerOneName,
        partnerTwoName: couple.partnerTwoName,
        slug: theirs.slug,
        weddingDate: "",
        venueName: "",
        city: "",
        welcomeMessage: "",
        thankYouMessage: "",
        theme: wedding!.theme,
        showProgress: true,
        showGuestNames: true,
        showGuestMessages: true,
        showAmounts: false,
        allowIndexing: false,
      }),
    ).rejects.toMatchObject({ fields: { slug: "That address is already taken" } });
  });

  describe("ownership", () => {
    it("a stranger cannot edit, delete or reorder another couple's dreams", async () => {
      const [dream] = (await getWorkspace(riya)).dreams;
      await expect(updateDream(stranger, dream!.id, dreamInput)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(deleteDream(stranger, dream!.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(reorderDreams(stranger, { ids: [dream!.id] })).rejects.toBeInstanceOf(
        ValidationError,
      );
      const after = (await getWorkspace(riya)).dreams;
      expect(after[0]!.title).toBe(dream!.title);
    });

    it("a stranger cannot attach another couple's photo to their dream", async () => {
      const png = await sharp({
        create: { width: 40, height: 30, channels: 3, background: "#b3924f" },
      })
        .png()
        .toBuffer();
      const image = await uploadImage(riya, "DREAM_COVER", png);
      await expect(
        createDream(stranger, { ...dreamInput, coverImageId: image.id }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  it("reorders dreams", async () => {
    const { dream: second } = await createDream(riya, { ...dreamInput, title: "Second dream" });
    const first = (await getWorkspace(riya)).dreams[0]!;
    await reorderDreams(riya, { ids: [second.id, first.id] });
    expect((await getWorkspace(riya)).dreams.map((dream) => dream.title)).toEqual([
      "Second dream",
      first.title,
    ]);
  });

  it("deletes an unfunded dream outright but keeps a funded one on record", async () => {
    const [unfunded, funded] = (await getWorkspace(riya)).dreams;
    await deleteDream(riya, unfunded!.id);
    expect(await db.dream.findUnique({ where: { id: unfunded!.id } })).toBeNull();

    await db.dream.update({
      where: { id: funded!.id },
      data: { fundedPaise: 500_000, contributionCount: 1 },
    });
    await deleteDream(riya, funded!.id);
    const kept = await db.dream.findUnique({ where: { id: funded!.id } });
    expect(kept?.deletedAt).not.toBeNull();
    expect(kept?.fundedPaise).toBe(500_000);
    expect((await getWorkspace(riya)).dreams).toHaveLength(0);
  });

  it("unpublishing hides the page from guests again", async () => {
    const { slug } = await unpublishWedding(riya);
    expect(await getPublicWedding(slug)).toBeNull();
  });

  it("writes an audit trail for what the couple did", async () => {
    const actions = (
      await db.auditLog.findMany({ where: { actorUserId: riya.userId }, select: { action: true } })
    ).map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "wedding.created",
        "wedding.published",
        "wedding.unpublished",
        "wedding.settings_updated",
        "dream.created",
        "dream.deleted",
        "dream.archived",
      ]),
    );
  });
});

describe("image processing", () => {
  it("re-encodes a real photo as WebP and caps its size", async () => {
    const big = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#6b1a22" },
    })
      .jpeg()
      .toBuffer();
    const result = await processImage(big, "DREAM_COVER");
    expect(result.width).toBe(1600);
    expect(result.height).toBe(1200);
    expect((await sharp(result.data).metadata()).format).toBe("webp");
  });

  it("rejects a file that is not an image, whatever it claims to be", async () => {
    const fake = Buffer.from("<script>alert(1)</script> definitely-a-photo.jpg");
    await expect(processImage(fake, "HERO")).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects image formats that are not allowed", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
      .gif()
      .toBuffer();
    await expect(processImage(gif, "HERO")).rejects.toThrow(/JPEG, PNG or WebP/);
  });

  it("rejects empty and oversized uploads", async () => {
    await expect(processImage(Buffer.alloc(0), "HERO")).rejects.toThrow(/empty/);
    await expect(processImage(Buffer.alloc(8 * 1024 * 1024 + 1), "HERO")).rejects.toThrow(/8 MB/);
  });
});

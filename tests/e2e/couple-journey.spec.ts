import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const OUTBOX = path.join(process.cwd(), ".data", "outbox");

/** Reads the sign-in link from the local email outbox (the "file" email transport). */
async function magicLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    for (const file of files.sort().reverse()) {
      const message = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8")) as {
        to: string;
        text: string;
      };
      const link = message.text.match(/https?:\/\/\S+/)?.[0];
      if (message.to === email && link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

/** Text of the newest email to an address whose subject contains the given words. */
async function emailTextFor(email: string, subjectPart: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const files = await readdir(OUTBOX).catch(() => [] as string[]);
    for (const file of files.sort().reverse()) {
      const message = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8")) as {
        to: string;
        subject: string;
        text: string;
      };
      if (message.to === email && message.subject.includes(subjectPart)) return message.text;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No "${subjectPart}" email arrived for ${email}`);
}

async function fillGift(
  guest: Page,
  gift: {
    name: string;
    email: string;
    message: string;
    anonymous?: boolean;
    privateMessage?: boolean;
  },
): Promise<void> {
  await guest.getByRole("button", { name: "₹5,100", exact: true }).click();
  await guest.getByRole("textbox", { name: "Your name" }).fill(gift.name);
  await guest.getByRole("textbox", { name: "Email address" }).fill(gift.email);
  await guest.getByRole("textbox", { name: "Your message (optional)" }).fill(gift.message);
  if (gift.anonymous) await guest.getByRole("checkbox", { name: /Give anonymously/ }).check();
  if (gift.privateMessage) {
    await guest.getByRole("checkbox", { name: /Keep my message private/ }).check();
  }
  await guest.getByRole("checkbox", { name: /I agree that VowFund/ }).check();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await magicLinkFor(email));
}

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("an unknown or unpublished wedding address shows a friendly not-found page", async ({
  page,
}) => {
  await page.goto("/wedding/nobody-and-no-one");
  await expect(
    page.getByRole("heading", { name: "We could not find that wedding page" }),
  ).toBeVisible();
});

test("sign-in rejects an invalid email without sending anything", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Please enter a valid email address")).toBeVisible();
});

test("a couple signs in, completes onboarding, publishes, and a guest sees the page", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const id = `${testInfo.project.name}${Date.now().toString(36)}`;
  const email = `couple-${id}@e2e.vowfund.test`;
  const one = `Riya${id}`;
  const two = `Rahul${id}`;
  const slug = `${one}-and-${two}`.toLowerCase();

  // Step 1: account
  await signIn(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 2: names (validation first)
  await expect(page.getByRole("heading", { name: "Who is getting married?" })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Please enter a name").first()).toBeVisible();
  await page.getByLabel("Your name").fill(one);
  await page.getByLabel("Your partner's name").fill(two);
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 3: photo
  await expect(page.getByRole("heading", { name: "Add a photo of you both" })).toBeVisible();
  const photo = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#b3924f" },
  })
    .jpeg()
    .toBuffer();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "us.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: date
  await page.getByLabel("Wedding date").fill("2027-02-14");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 5: venue
  await page.getByLabel("Venue").fill("The Leela Palace");
  await page.getByLabel("City").fill("Udaipur");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Resuming: a reload returns to the step that was reached, with earlier answers kept.
  await expect(page.getByRole("heading", { name: "Choose a look for your page" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose a look for your page" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Venue")).toHaveValue("The Leela Palace");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 6: theme
  await page.getByText("Royal Indian", { exact: true }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 7: first dream (validation first)
  await expect(page.getByRole("heading", { name: "Add your first dream" })).toBeVisible();
  await page.getByLabel("What is the dream?").fill("A week in the Swiss Alps");
  await page
    .getByLabel("Tell your guests about it")
    .fill("Train rides and a first snowfall together.");
  await page.getByLabel("Target amount (₹)").fill("500");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/at least ₹1,000/)).toBeVisible();
  await page.getByLabel("Target amount (₹)").fill("300000");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // The page is not public before publishing.
  await expect(page.getByRole("heading", { name: "Preview and publish" })).toBeVisible();
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/wedding/${slug}`);
  await expect(
    guest.getByRole("heading", { name: "We could not find that wedding page" }),
  ).toBeVisible();
  expect(await guest.content()).not.toContain(one);

  // Step 8: publish
  await page.getByRole("button", { name: "Publish my page" }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByTestId("share-url")).toContainText(`/wedding/${slug}`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  // Guest view, in a separate signed-out browser.
  await guest.goto(`/wedding/${slug}`);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(`${one} & ${two}`);
  await expect(guest.getByText("14 February 2027 · The Leela Palace, Udaipur")).toBeVisible();
  await expect(guest.getByRole("heading", { name: "A week in the Swiss Alps" })).toBeVisible();
  await expect(guest.getByText("₹0 of ₹3,00,000")).toBeVisible();
  await expect(guest.locator("[data-theme]").first()).toHaveAttribute("data-theme", "royal-indian");
  expect(await guest.content()).not.toContain(email);
  const overflow = await guest.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Dashboard: add a second dream, and guests see it straight away.
  await page.getByRole("button", { name: "Add a dream" }).click();
  await page.getByLabel("What is the dream?").fill("Our first car");
  await page.getByLabel("Tell your guests about it").fill("Weekend drives out of the city.");
  await page.getByLabel("Category").selectOption("LIFESTYLE");
  await page.getByLabel("Target amount (₹)").fill("800000");
  await page.getByRole("button", { name: "Add dream" }).click();
  await expect(page.getByRole("heading", { name: "Our first car" })).toBeVisible();
  await guest.reload();
  await expect(guest.getByRole("heading", { name: "Our first car" })).toBeVisible();

  // Delete it again, with confirmation.
  await page.getByRole("button", { name: "Delete Our first car" }).click();
  await page.getByRole("button", { name: "Yes, remove" }).click();
  await expect(page.getByRole("heading", { name: "Our first car" })).toHaveCount(0);

  // ── A guest contributes ──
  const guestEmail = `guest-${id}@e2e.vowfund.test`;
  await guest.goto(`/wedding/${slug}`);
  await guest.getByRole("link", { name: "Contribute to A week in the Swiss Alps" }).click();
  await expect(guest.getByText("Demo mode.").first()).toBeVisible();

  // Validation: nothing is sent without details and consent.
  await guest.getByRole("button", { name: /Continue to pay/ }).click();
  await expect(guest.getByText("Please enter your name")).toBeVisible();
  await expect(guest.getByText("Please confirm to continue")).toBeVisible();

  await fillGift(guest, {
    name: "Ananya Rao",
    email: guestEmail,
    message: "Wishing you a lifetime of adventures.",
  });
  await expect(guest.getByTestId("total-payable")).toHaveText("₹5,227.50");
  await guest.getByRole("button", { name: "Continue to pay ₹5,227.50" }).click();

  // The demo payment screen says plainly that it is not real. First, a failure.
  await expect(guest.getByRole("heading", { name: "This is not a real payment" })).toBeVisible();
  await guest.getByRole("button", { name: "Simulate a failed payment" }).click();
  await expect(
    guest.getByRole("heading", { name: "Your payment did not go through" }),
  ).toBeVisible();
  await guest.goto(`/wedding/${slug}`);
  await expect(guest.getByText("₹0 of ₹3,00,000")).toBeVisible();

  // Then a success.
  await guest.getByRole("link", { name: "Contribute to A week in the Swiss Alps" }).click();
  await fillGift(guest, {
    name: "Ananya Rao",
    email: guestEmail,
    message: "Wishing you a lifetime of adventures.",
  });
  await guest.getByRole("button", { name: "Continue to pay ₹5,227.50" }).click();
  await guest.getByRole("button", { name: /Simulate a successful payment/ }).click();
  await expect(guest.getByRole("heading", { name: "Thank you, Ananya Rao" })).toBeVisible();
  await expect(guest.getByText("Demo mode.").first()).toBeVisible();
  // Earlier screens stay in the page, hidden, after client-side navigation.
  await expect(guest.getByText("₹5,227.50").filter({ visible: true }).first()).toBeVisible();
  const giftUrl = guest.url();

  // The wishlist total moved by the gift (not the fee), and the public message appears.
  await guest.goto(`/wedding/${slug}`);
  await expect(guest.getByText("₹5,100 of ₹3,00,000")).toBeVisible();
  await expect(guest.getByText("Wishing you a lifetime of adventures.")).toBeVisible();
  await expect(guest.getByText("Ananya Rao")).toBeVisible();
  expect(await guest.content()).not.toContain(guestEmail);

  // An anonymous guest with a private message.
  await guest.getByRole("link", { name: "Contribute to A week in the Swiss Alps" }).click();
  await fillGift(guest, {
    name: "Secret Santa",
    email: `santa-${id}@e2e.vowfund.test`,
    message: "For your eyes only.",
    anonymous: true,
    privateMessage: true,
  });
  await guest.getByRole("button", { name: "Continue to pay ₹5,227.50" }).click();
  await guest.getByRole("button", { name: /Simulate a successful payment/ }).click();
  await expect(guest.getByRole("heading", { name: "Thank you, Secret Santa" })).toBeVisible();
  await guest.goto(`/wedding/${slug}`);
  await expect(guest.getByText("₹10,200 of ₹3,00,000")).toBeVisible();
  await expect(guest.getByText("Anonymous", { exact: true })).toBeVisible();
  const publicHtml = await guest.content();
  expect(publicHtml).not.toContain("Secret Santa");
  expect(publicHtml).not.toContain("For your eyes only.");

  // The private link still works later, and the guest was emailed a receipt.
  await guest.goto(giftUrl);
  await expect(guest.getByRole("heading", { name: "Thank you, Ananya Rao" })).toBeVisible();
  expect(await emailTextFor(guestEmail, "is confirmed")).toContain("DEMO MODE");

  // The couple's dashboard shows the same verified total.
  await page.reload();
  await expect(page.getByText("₹10,200 of ₹3,00,000")).toBeVisible();
  await expect(page.getByText("2 contributions")).toBeVisible();

  // Unpublish hides the page from guests.
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
  await guest.goto(`/wedding/${slug}`);
  await expect(
    guest.getByRole("heading", { name: "We could not find that wedding page" }),
  ).toBeVisible();
  await guest.context().close();
});

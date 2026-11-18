import { config } from "dotenv";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

/** Deletes waitlist rows this spec created. */
async function cleanUp(email: string): Promise<void> {
  config({ path: [".env.local", ".env"], quiet: true });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "WaitlistEntry" WHERE "email" = $1`, [email]);
  } finally {
    await client.end();
  }
}

test("the home page invites people to the waitlist, and joining works", async ({
  page,
}, testInfo) => {
  const email = `waitlist-${testInfo.project.name}-${Date.now().toString(36)}@e2e.shaadifund.test`;
  try {
    await page.goto("/?ref=e2e");
    await expect(page.getByRole("link", { name: "Join the Early-Access List" })).toBeVisible();
    await page.getByRole("link", { name: "Join the Early-Access List" }).click();
    const form = page.getByRole("form", { name: "Join the early-access list" });
    await expect(form).toBeInViewport();

    await form.getByRole("button", { name: "Join the early-access list" }).click();
    await expect(form.getByText("Please enter a valid email address")).toBeVisible();
    await expect(form.getByText("Please confirm so we can email you")).toBeVisible();

    await form.getByLabel("Email address").fill(email);
    await form.getByLabel("Your name (optional)").fill("Meera");
    await form.getByLabel("Wedding month (optional)").fill("2027-02");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Join the early-access list" }).click();
    await expect(page.getByText("You are on the list")).toBeVisible();

    // Signing up again with the same address looks exactly the same.
    await page.reload();
    const again = page.getByRole("form", { name: "Join the early-access list" });
    await again.getByLabel("Email address").fill(email);
    await again.getByRole("checkbox").check();
    await again.getByRole("button", { name: "Join the early-access list" }).click();
    await expect(page.getByText("You are on the list")).toBeVisible();
  } finally {
    await cleanUp(email);
  }
});

test("signed-out visitors cannot download the waitlist", async ({ request }) => {
  const response = await request.get("/api/admin/waitlist");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("@");
});

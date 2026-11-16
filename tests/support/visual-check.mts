// One-off helper: walks the couple journey against a running server and saves screenshots.
// Usage: npx tsx tests/support/visual-check.mts <baseUrl> <outputDir>
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const [baseURL = "http://localhost:3000", out = "."] = process.argv.slice(2);
const id = Date.now().toString(36);
const email = `visual-${id}@e2e.shaadifund.test`;
const outbox = path.join(process.cwd(), ".data", "outbox");

async function link(): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    for (const file of (await readdir(outbox).catch(() => [])).sort().reverse()) {
      const message = JSON.parse(await readFile(path.join(outbox, file), "utf8"));
      const url = message.text.match(/https?:\/\/\S+/)?.[0];
      if (message.to === email && url) return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("no email");
}

const browser = await chromium.launch();
const phone = await browser.newContext({ ...devices["Pixel 7"], baseURL });
const page = await phone.newPage();
const shot = (name: string, target = page) =>
  target.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });

await page.goto("/sign-in");
await shot("1-sign-in");
await page.getByLabel("Email address").fill(email);
await page.getByRole("button", { name: "Email me a sign-in link" }).click();
await page.getByRole("heading", { name: "Check your inbox" }).waitFor();
await page.goto(await link());
await page.getByLabel("Your name").fill("Riya");
await page.getByLabel("Your partner's name").fill("Rahul");
await shot("2-names");
await page.getByRole("button", { name: "Save and continue" }).click();
await page.getByRole("button", { name: "Skip for now" }).click();
await page.getByLabel("Wedding date").fill("2027-02-14");
await page.getByRole("button", { name: "Save and continue" }).click();
await page.getByLabel("Venue").fill("The Leela Palace");
await page.getByLabel("City").fill("Udaipur");
await page.getByRole("button", { name: "Save and continue" }).click();
await page.getByRole("heading", { name: "Choose a look for your page" }).waitFor();
await shot("3-theme");
await page.getByRole("button", { name: "Save and continue" }).click();
await page.getByLabel("What is the dream?").fill("A week in the Swiss Alps");
await page
  .getByLabel("Tell your guests about it")
  .fill("Train rides through the mountains and a first snowfall together.");
await page.getByLabel("Target amount (₹)").fill("300000");
await shot("4-dream");
await page.getByRole("button", { name: "Save and continue" }).click();
await page.getByRole("heading", { name: "Preview and publish" }).waitFor();
await shot("5-publish");
await page.getByRole("button", { name: "Publish my page" }).click();
await page.waitForURL(/dashboard/);
await page.getByTestId("share-url").waitFor();
await shot("6-dashboard");
const slug = (await page.getByTestId("share-url").innerText()).split("/wedding/")[1]!.trim();
await page.goto(`/wedding/${slug}`);
await page.getByRole("heading", { level: 1 }).waitFor();
await shot("7-wedding-phone");
const desktop = await (
  await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } })
).newPage();
await desktop.goto(`/wedding/${slug}`);
await desktop.getByRole("heading", { level: 1 }).waitFor();
await shot("8-wedding-desktop", desktop);
if (process.argv.includes("--couple-only")) {
  process.stdout.write(`${slug}\n`);
  await browser.close();
  process.exit(0);
}

// Guest gives a gift (phone).
await page.context().clearCookies();
await page.goto(`/wedding/${slug}`);
await page
  .getByRole("link", { name: /Contribute to/ })
  .first()
  .click();
await page.getByRole("button", { name: "₹5,100", exact: true }).click();
await page.getByRole("textbox", { name: "Your name" }).fill("Ananya Rao");
await page.getByRole("textbox", { name: "Email address" }).fill(`guest-${id}@e2e.shaadifund.test`);
await page
  .getByRole("textbox", { name: "Your message (optional)" })
  .fill("Wishing you both a lifetime of adventures.");
await page.getByRole("checkbox", { name: /I agree that ShaadiFund/ }).check();
await shot("9-checkout");
await page.getByRole("button", { name: /Continue to pay/ }).click();
await page.getByRole("heading", { name: "This is not a real payment" }).waitFor();
await shot("10-demo-payment");
await page.getByRole("button", { name: /Simulate a successful payment/ }).click();
await page.getByRole("heading", { name: /Thank you/ }).waitFor();
await shot("11-gift");
await page.goto(`/wedding/${slug}`);
await page.getByText("From our guests").waitFor();
await shot("12-wedding-after-gift");
await browser.close();

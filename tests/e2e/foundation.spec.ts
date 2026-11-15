import { expect, test } from "@playwright/test";

test("home page shows the brand and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Give them memories, not things.",
  );
});

test("health endpoint reports the database is reachable and payments are mocked", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ data: { status: "ok", paymentsMode: "mock" } });
});

test("design system renders all three themes without horizontal scroll", async ({ page }) => {
  await page.goto("/design");
  for (const name of ["Minimal Ivory", "Royal Indian", "Modern Editorial"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.getByRole("progressbar")).toHaveCount(3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

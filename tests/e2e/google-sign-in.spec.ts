import { expect, test } from "@playwright/test";

/**
 * The browser tests run with placeholder Google credentials (playwright.config.ts),
 * so these check our side of the hand-off without contacting Google: the button
 * appears, it sends the person to Google with the right return address, and a
 * failed or cancelled sign-in comes back to a readable message.
 */
test("the Google button sends the person to Google's account chooser with our return address", async ({
  page,
  baseURL,
}) => {
  let googleUrl: URL | null = null;
  await page.route("https://accounts.google.com/**", async (route) => {
    googleUrl = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Google (stubbed)</h1>",
    });
  });

  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("heading", { name: "Google (stubbed)" })).toBeVisible();

  expect(googleUrl).not.toBeNull();
  const url = googleUrl as unknown as URL;
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("client_id")).toBe("e2e-placeholder.apps.googleusercontent.com");
  expect(url.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/auth/callback/google`);
  expect(url.searchParams.get("prompt")).toBe("select_account");
  expect(url.searchParams.get("scope")).toContain("email");
  // The round trip is protected against forgery.
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("a cancelled Google sign-in comes back to a plain explanation", async ({ page }) => {
  await page.goto("/sign-in?error=access_denied");
  await expect(page.getByText("Google sign-in was cancelled")).toBeVisible();
});

test("a forged return from Google is refused and explained", async ({ page }) => {
  await page.goto("/api/auth/callback/google?code=forged&state=forged");
  await expect(page).toHaveURL(/\/sign-in\?error=/);
  await expect(page.getByText(/could not sign you in/i)).toBeVisible();
});

test("when the sign-in email cannot be sent, the person is pointed to Google instead", async ({
  page,
}) => {
  await page.route("**/api/auth/sign-in/magic-link", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "EMAIL_NOT_SENT",
        message: "We could not send the sign-in email.",
      }),
    }),
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("someone@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/Please continue with Google instead/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toHaveCount(0);
});

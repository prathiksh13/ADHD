import { expect, test } from "@playwright/test";
test("public pages expose one account flow and removed dashboards return 404", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('a[href^="/clinician"],a[href^="/research"],a[href^="/caregiver"]')).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo|clinician|researcher|caregiver/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await page.screenshot({ path: "test-results/login-single-user.png", fullPage: true });
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  for (const route of ["/clinician", "/clinician/participants", "/research", "/research/models", "/caregiver", "/caregiver/subjects/old"]) {
    expect((await request.get(route)).status()).toBe(404);
  }
});
test("unsigned users cannot open private activity pages or upload recordings", async ({ page, context }) => {
  // A stale cookie from a removed login implementation must not bypass Firebase authentication.
  await context.addCookies([{ name: "attune_demo_role", value: "participant", url: "http://127.0.0.1:3200" }]);
  for (const route of ["/participant", "/participant/upload", "/participant/activities/stroop", "/participant/data"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start scored task", exact: true })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  }
});

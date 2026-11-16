import { expect, test } from "@playwright/test";

test("activity completion updates history, progress, Twin and sessions after reload", async ({ page }) => {
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9699"}`;
  const email = `activity-${Date.now()}@example.test`;
  const password = "synthetic-password-123";
  const created = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Synthetic Activity Test", returnSecureToken: true }),
  });
  expect(created.ok).toBe(true);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/participant/, { timeout: 30_000 });
  await page.goto("/participant/digital-twin");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Grant consent" }).click();
  await expect(page.getByText(/Research consent and saving · enabled/)).toBeVisible({ timeout: 30_000 });

  for (const activity of ["cpt", "go-no-go", "n-back", "stop-signal", "stroop", "task-switching", "visual-search", "planning-puzzle", "visual-sequence", "time-perception", "multiple-object-tracking"]) {
    await page.goto(`/participant/activities/${activity}`);
    await expect(page.getByRole("button", { name: "Start scored task", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /trial activity|trial practice/i }).first()).toBeVisible();
  }

  await page.goto("/participant/activities/stroop");
  await page.clock.install();
  await page.getByRole("button", { name: "Start scored task", exact: true }).click();
  for (let i = 0; i < 40 && !(await page.getByText("Scored run complete", { exact: true }).isVisible()); i++) {
    await page.clock.runFor(3000);
  }
  await page.clock.resume();
  await expect(page.getByText("Scored run complete", { exact: true })).toBeVisible();
  await expect(page.getByText(/Saved to the research backend/).first()).toBeVisible({ timeout: 30_000 });

  for (const route of ["activities/history", "progress", "digital-twin", "sessions"]) {
    await page.goto(`/participant/${route}`);
    await expect(page.getByRole("heading", { name: "Stroop", exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Saved to your account", { exact: false }).first()).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/participant/digital-twin");
  await expect(page.getByRole("heading", { name: "Your Digital Twin" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stroop", exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "test-results/digital-twin-mobile.png", fullPage: true });
});

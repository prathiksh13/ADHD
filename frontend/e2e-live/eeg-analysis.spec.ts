import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

test("EEG upload plots actual samples, downloads an image and restores saved session analysis", async ({ page }, info) => {
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9699"}`;
  const email = `eeg-${Date.now()}@example.test`;
  const password = "synthetic-password-123";
  const signup = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Synthetic EEG Test", returnSecureToken: true }),
  });
  expect(signup.ok).toBe(true);
  const fixture = info.outputPath("synthetic-eeg.mat");
  execFileSync(process.env.ATTUNE_PYTHON ?? "python", [path.resolve("../backend/scripts/make_synthetic_eeg.py"), "--output", fixture]);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/participant/, { timeout: 30_000 });
  await page.goto("/participant/digital-twin");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Grant consent" }).click();
  await expect(page.getByText(/Research consent and saving · enabled/)).toBeVisible({ timeout: 30_000 });
  await page.goto("/participant/upload");
  await page.locator("#restEC-file").setInputFiles(fixture);
  await page.getByRole("checkbox", { name: /permission to analyze/ }).check();
  await page.getByRole("checkbox", { name: /Save the analysis summary/ }).check();
  await page.getByRole("button", { name: "Analyze recordings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your EEG signal", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("img", { name: /EEG electrical signals/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download signal image (SVG)" }).click();
  expect((await download).suggestedFilename()).toBe("eeg-signal-preview.svg");
  await page.screenshot({ path: info.outputPath("eeg-analysis.png"), fullPage: true });
  await page.goto("/participant/sessions");
  await expect(page.getByText("Saved analysis", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Review EEG analysis" }).click();
  await expect(page.getByRole("heading", { name: "Analysis and quality", exact: true })).toBeVisible();
  await expect(page.getByText(/Signal samples are not stored with saved summaries/)).toBeVisible();
});

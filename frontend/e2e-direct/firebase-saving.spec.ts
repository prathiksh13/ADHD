import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

// This helper can change rules only on the local demo emulator, never a live project.
async function setEmulatorRules(rules: string) {
  const endpoint = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8686"}`);
  if (!["127.0.0.1", "localhost"].includes(endpoint.hostname)) throw new Error("Rules recovery tests require a local emulator");
  const environment = await initializeTestEnvironment({ projectId: "demo-attune-live",
    firestore: { host: endpoint.hostname, port: Number(endpoint.port), rules } });
  await environment.cleanup();
}

test("Firebase saves trial and scored activities without a running backend or Admin credentials", async ({ page }) => {
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9699"}`;
  const email = `direct-${Date.now()}@example.test`;
  const password = "synthetic-password-123";
  const created = await fetch(`${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Synthetic Direct Saving", returnSecureToken: true }),
  });
  expect(created.ok).toBe(true);
  const backendRequests: string[] = [];
  page.on("request", (request) => { if (request.url().startsWith("http://127.0.0.1:8200")) backendRequests.push(request.url()); });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/participant/, { timeout: 30_000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/participant/data");
  await expect(page.getByRole("heading", { name: "Data & privacy", exact: true })).toBeVisible();
  await expect(page.getByText("Your Firebase account data", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permanently erase my research data" })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  await page.getByRole("button", { name: "Enable Firebase saving" }).click();
  await expect(page.getByRole("button", { name: "Turn off cloud saving" })).toBeVisible();
  await page.goto("/participant/activities/stroop");
  await page.clock.install();
  await page.clock.setFixedTime(new Date());
  for (const mode of ["trial", "scored"]) {
    if (mode === "scored") await page.goto("/participant/activities/stroop");
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    if (mode === "scored") {
      const blockedRules = rules.replace("allow create: if syncEnabled(uid) && validSummary();", "allow create: if false;");
      expect(blockedRules).not.toBe(rules);
      await setEmulatorRules(blockedRules);
    }
    await page.getByRole("button", { name: mode === "trial" ? /trial activity|trial practice/i : "Start scored task" }).first().click();
    for (let i = 0; i < 45; i++) {
      if (await page.getByRole("button", { name: "Run again", exact: true }).isVisible() || await page.getByText("Practice complete", { exact: true }).isVisible()) break;
      await page.clock.runFor(3000);
    }
    await page.clock.resume();
    if (mode === "scored") {
      try {
        await expect(page.getByText("Firebase saving needs attention", { exact: true })).toBeVisible();
        await expect(page.getByText("1 activity result(s) waiting to save to Firebase.", { exact: true })).toBeVisible();
      } finally { await setEmulatorRules(rules); }
      // The same pending result must save after rules publication, without reload/replaying the task.
      await page.getByRole("button", { name: "Retry Firebase saving", exact: true }).click();
    }
    await expect(page.getByText("Activity results save directly to your Firebase account.", { exact: true })).toBeVisible({ timeout: 30_000 });
  }
  for (const route of ["activities/history", "progress", "digital-twin", "sessions"]) {
    await page.goto(`/participant/${route}`);
    await expect(page.getByRole("heading", { name: "Stroop", exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Saved to your account", { exact: false }).first()).toBeVisible();
    if (route === "activities/history") {
      await expect(page.getByText("Trial / practice", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Stroop", exact: true })).toHaveCount(2);
    }
  }
  expect(backendRequests).toEqual([]);
  await page.getByRole("navigation", { name: "Your workspace", exact: true }).getByRole("link", { name: "Upload EEG", exact: true }).click();
  await expect(page.getByRole("heading", { name: "EEG ADHD screening", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/upload-single-user.png", fullPage: true });
  await expect(page.getByRole("button", { name: /demo/i })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

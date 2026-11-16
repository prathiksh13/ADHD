import { expect, test } from "@playwright/test";
test("global preference, probe release, real model loading, pause and exit cleanup with a synthetic camera", async ({ page }) => {
  // Eleven real WASM model initializations can be slow under software rendering.
  test.setTimeout(480_000);
  const nativeLogs: { type: string; text: string }[] = [];
  page.on("console", (message) => {
    if (message.text().includes("XNNPACK")) nativeLogs.push({ type: message.type(), text: message.text() });
    if (message.type() === "error") console.log(message.text());
  });
  const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9699"}`;
  const email = `focus-${Date.now()}@example.test`, password = "synthetic-password-123";
  const created = await fetch(`${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Synthetic Focus Test", returnSecureToken: true }),
  });
  expect(created.ok).toBe(true);
  await page.addInitScript(() => {
    const camera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const streams: MediaStream[] = [];
    Object.assign(window, { testCameraStreams: streams });
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await camera(constraints); streams.push(stream); return stream;
    };
  });
  const liveTracks = () => page.evaluate(() => (window as unknown as { testCameraStreams: MediaStream[] }).testCameraStreams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/participant/, { timeout: 30_000 });
  await page.goto("/participant/settings");
  const toggle = page.getByRole("checkbox", { name: "Enable Real-Time Focus & Eye-Blink Tracking" });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.getByText("Camera permission: granted.")).toBeVisible();
  expect(await liveTracks()).toBe(0);
  await page.getByRole("button", { name: "Test alert sound" }).click();
  await expect(page.getByText(/Alert sound is ready/)).toBeVisible();
  await page.screenshot({ path: "test-results/attention-settings.png", fullPage: true });
  await page.reload(); await expect(toggle).toBeChecked();
  for (const activity of ["cpt", "go-no-go", "n-back", "stop-signal", "stroop", "task-switching", "visual-search", "planning-puzzle", "visual-sequence", "time-perception", "multiple-object-tracking"]) {
    await page.getByRole("link", { name: "Cognitive activities", exact: true }).click();
    await page.locator(`a[href="/participant/activities/${activity}"]`).first().click();
    expect(await liveTracks()).toBe(0);
    await page.getByRole("button", { name: "Start scored task", exact: true }).click();
    await expect.poll(liveTracks, { timeout: 30_000 }).toBe(1);
    await expect(page.getByLabel("Activity attention monitor").filter({ visible: true })).toBeVisible();
    // Complete real model initialization before releasing its GPU/camera resources.
    // The synthetic camera contains no face, so calibration remains pending.
    await expect(page.getByText("Calibrating · rest your face", { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 45_000 });
    if (activity === "stroop") {
      await expect(page.getByText("Calibrating · rest your face", { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 45_000 });
      await expect.poll(() => nativeLogs.length).toBeGreaterThan(0);
      expect(nativeLogs.every((message) => message.type === "info")).toBe(true);
      await expect(page.getByRole("progressbar", { name: "Focus calibration" }).filter({ visible: true })).toHaveAttribute("value", "0");
      await expect(page.getByText("Face not visible — check camera and lighting").filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "Recalibrate focus" }).filter({ visible: true }).click();
      expect(await liveTracks()).toBe(1);
      await page.screenshot({ path: "test-results/attention-running.png", fullPage: true });
      await page.getByRole("button", { name: "Mute chime" }).filter({ visible: true }).click();
      await expect(page.getByRole("button", { name: "Unmute chime" }).filter({ visible: true })).toBeVisible();
      await page.getByRole("button", { name: "Pause tracking" }).filter({ visible: true }).click();
      await expect.poll(liveTracks).toBe(0);
      await page.getByRole("button", { name: "Resume tracking" }).filter({ visible: true }).click();
      await expect.poll(liveTracks).toBe(1);
    }
    if (activity === "cpt") {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect.poll(liveTracks).toBe(0);
    }
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/participant\/settings$/);
    await expect.poll(liveTracks).toBe(0);
  }
  await toggle.uncheck();
  await page.goto("/participant/activities/stroop");
  await page.getByRole("button", { name: "Start scored task", exact: true }).click();
  expect(await liveTracks()).toBe(0);
  await page.screenshot({ path: "test-results/attention-disabled.png", fullPage: true });
});

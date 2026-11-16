import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardAttentionAlert } from "../src/features/attention/dashboard-attention-alert";

test("radial alert component covers the viewport without blocking controls and respects reduced motion", async ({ page }) => {
  await page.goto("/login");
  expect(renderToStaticMarkup(createElement(DashboardAttentionAlert, { active: false, stage: 0, durationMs: 0 }))).toBe("");
  // Visual fixture of the real component with application styles; no camera or fabricated telemetry.
  const markup = renderToStaticMarkup(createElement(DashboardAttentionAlert, { active: true, stage: 2, durationMs: 8000 }));
  await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), markup);
  const overlay = page.getByTestId("attention-dashboard-alert");
  const viewport = page.viewportSize()!;
  expect(await overlay.boundingBox()).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
  const styles = await overlay.evaluate((element) => {
    const style = getComputedStyle(element);
    return { gradient: style.backgroundImage, pointer: style.pointerEvents, animation: style.animationName };
  });
  expect(styles.gradient).toContain("radial-gradient(circle");
  expect(styles.pointer).toBe("none");
  expect(styles.animation).toBe("attention-dashboard-pulse");
  await page.getByLabel("Email").fill("synthetic-focus@example.test");
  await expect(page.getByLabel("Email")).toHaveValue("synthetic-focus@example.test");
  await page.screenshot({ path: "test-results/attention-radial-alert.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await overlay.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await overlay.evaluate((element) => getComputedStyle(element, "::after").display)).toBe("none");
  await overlay.evaluate((element) => element.remove());
  await expect(overlay).toHaveCount(0);
});

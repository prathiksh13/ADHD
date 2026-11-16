import { defineConfig } from "@playwright/test";
import direct from "./playwright.direct.config";
export default defineConfig({
  ...direct, testDir: "./e2e-attention", testMatch: "**/*.spec.ts", workers: 1, timeout: 120_000,
  projects: [{ name: "chromium", use: { channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } } }],
});

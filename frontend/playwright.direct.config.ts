import { defineConfig } from "@playwright/test";
import live from "./playwright.live.config";

if (!Array.isArray(live.webServer)) throw new Error("Expected live frontend server configuration");
const frontend = live.webServer[1];
export default defineConfig({
  ...live,
  testDir: ".",
  testMatch: ["e2e/*.spec.ts", "e2e-direct/*.spec.ts"],
  webServer: { ...frontend, env: { ...frontend.env, NEXT_PUBLIC_ACTIVITY_PERSISTENCE: "firestore" } },
});

import { describe, expect, it } from "vitest";
import { parseFrontendConfig } from "./frontend-config";
const env = { NEXT_PUBLIC_FIREBASE_API_KEY: "test-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.test",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-attune-test", NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:0", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0" };
describe("personal Firebase workspace configuration", () => {
  it("defaults to Firebase and requires real Web configuration", () => {
    expect(parseFrontendConfig({})).toMatchObject({ valid: false });
    expect(parseFrontendConfig(env)).toMatchObject({ valid: true, provider: "firebase", apiBaseUrl: null });
  });
  it.each(["demo", "remote", "postgres"])("rejects removed provider %s", (provider) => {
    expect(parseFrontendConfig({ ...env, NEXT_PUBLIC_DATA_PROVIDER: provider })).toMatchObject({ valid: false });
  });
  it("normalizes a configured backend URL without changing authentication", () => {
    expect(parseFrontendConfig({ ...env, NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000/" })).toMatchObject({ valid: true, apiBaseUrl: "http://localhost:8000", provider: "firebase" });
  });
  it.each(["ftp://example.test", "not a url", "https://user:secret@example.test", "https://example.test/?token=x", "https://example.test/#x"])("rejects unsafe or invalid backend URL %s", (url) => {
    expect(parseFrontendConfig({ ...env, NEXT_PUBLIC_API_BASE_URL: url })).toMatchObject({ valid: false });
  });
  it("names missing public configuration without falling back to synthetic records", () => {
    const result = parseFrontendConfig({ ...env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "" });
    expect(result.valid).toBe(false); if (!result.valid) expect(result.error).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  });
});

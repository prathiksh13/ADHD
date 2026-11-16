import { describe, expect, it } from "vitest";
import { createBackendClient } from "@/lib/backend/client";

const baseUrl = process.env.BACKEND_CONTRACT_URL;

describe.skipIf(!baseUrl)("private journal against the real backend", () => {
  it("round-trips goal and optional context through the authenticated TypeScript client", async () => {
    const client = createBackendClient({ baseUrl: baseUrl!, getIdToken: async () => "participant-token" });
    await client.getMe();
    const subject = await client.createSubject("Synthetic journal contract");
    await expect(client.updateTwinJournal(subject.id, { goal: "Before consent" })).rejects.toMatchObject({ status: 403 });
    const consent = await client.createConsent(subject.id, {
      scope: "research", version: "synthetic-test-v1", idempotencyKey: `journal-${subject.id}`,
    });
    await client.updateTwinJournal(subject.id, { goal: "Start a synthetic task" });
    const saved = await client.updateTwinJournal(subject.id, { entry: {
      day: "2026-01-01", sleepHours: 8, stress: "low", distractions: null, goalProgress: "partly",
    } });
    expect(saved.entries[0]).toMatchObject({ sleepHours: 8, goal: "Start a synthetic task", goalProgress: "partly" });
    expect(await client.getTwinJournal(subject.id)).toEqual(saved);
    await client.withdrawConsent(subject.id, consent.id);
    await expect(client.updateTwinJournal(subject.id, { goal: "After withdrawal" })).rejects.toMatchObject({ status: 403 });
    await expect(client.deleteTwinJournal(subject.id)).resolves.toBeUndefined();
    expect((await client.getTwinJournal(subject.id)).entries).toEqual([]);
  });
});

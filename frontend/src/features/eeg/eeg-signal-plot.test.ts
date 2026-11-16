import { describe, expect, it } from "vitest";
import { readSignalPreview } from "@/features/eeg/eeg-signal-plot";

describe("uploaded EEG signal preview", () => {
  const preview = { channels: ["Fp1"], samples: [[1, -2, 3]], sample_rate_hz: 125, duration_seconds: 0.024, description: "Measured segment" };
  it("accepts measured samples and their actual rate", () => expect(readSignalPreview(preview)).toEqual(preview));
  it("rejects malformed or nonfinite signals instead of drawing invented traces", () => {
    expect(readSignalPreview({ ...preview, samples: [[NaN, 1]] })).toBeNull();
    expect(readSignalPreview({ ...preview, channels: ["Fp1", "Fp2"] })).toBeNull();
    expect(readSignalPreview({ ...preview, sample_rate_hz: 0 })).toBeNull();
  });
});

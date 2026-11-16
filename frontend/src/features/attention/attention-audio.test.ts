import { afterEach, expect, it, vi } from "vitest";
import { AttentionChime } from "./attention-audio";

afterEach(() => vi.unstubAllGlobals());
it("unlocks a soft two-tone cue and immediately stops both scheduled voices", async () => {
  const voices: { frequency: { setValueAtTime: ReturnType<typeof vi.fn> }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const envelopes: ReturnType<typeof vi.fn>[] = [];
  const context = {
    state: "suspended", currentTime: 10, destination: {},
    resume: vi.fn(async () => { context.state = "running"; }), close: vi.fn(),
    createOscillator: () => {
      const voice = { frequency: { setValueAtTime: vi.fn() }, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null };
      voices.push(voice); return voice;
    },
    createGain: () => {
      const ramp = vi.fn(); envelopes.push(ramp);
      return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: ramp }, connect: vi.fn(), disconnect: vi.fn() };
    },
  };
  vi.stubGlobal("AudioContext", class { constructor() { return context; } });
  const chime = new AttentionChime();
  await chime.play(); expect(voices).toHaveLength(0);
  await chime.prime(); expect(context.resume).toHaveBeenCalledOnce(); expect(chime.ready).toBe(true);
  await chime.play();
  expect(voices[0].frequency.setValueAtTime).toHaveBeenCalledWith(440, 10);
  expect(voices[1].frequency.setValueAtTime).toHaveBeenCalledWith(554, 10.23);
  expect(envelopes[0]).toHaveBeenCalledWith(.06, 10.025);
  chime.stop();
  voices.forEach((voice) => expect(voice.stop).toHaveBeenCalledTimes(2));
  await chime.close(); expect(context.close).toHaveBeenCalledOnce(); expect(chime.ready).toBe(false);
});

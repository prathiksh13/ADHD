import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttentionRuntime } from "./attention-runtime";
const mocks = vi.hoisted(() => ({ create: vi.fn(), close: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({ FilesetResolver: { forVisionTasks: async () => ({}) },
  FaceLandmarker: { createFromOptions: mocks.create } }));
let stop: ReturnType<typeof vi.fn>;
let video: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; srcObject: unknown };
function mediaStream() { return { getTracks: () => [{ stop }], getVideoTracks: () => [{ addEventListener: vi.fn() }] } as unknown as MediaStream; }
beforeEach(() => {
  stop = vi.fn(); mocks.close.mockReset(); mocks.create.mockReset();
  mocks.create.mockResolvedValue({ close: mocks.close, detectForVideo: vi.fn() });
  video = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), remove: vi.fn(), srcObject: null };
  vi.stubGlobal("document", { createElement: () => video });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mediaStream()) } });
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
describe("camera ownership and cancellation", () => {
  it("releases a camera permission request that resolves after activity exit", async () => {
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise((r) => { resolve = r; }));
    const runtime = new AttentionRuntime(vi.fn()), owner = Symbol();
    const pending = runtime.start("stroop", owner);
    runtime.release(owner);
    resolve(mediaStream()); await pending;
    expect(stop).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("closes a model that finishes loading after pause without restarting video", async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockReturnValue(new Promise((r) => { resolve = r; }));
    const runtime = new AttentionRuntime(vi.fn());
    const pending = runtime.start("stroop", Symbol());
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());
    runtime.cancel(true);
    resolve({ close: mocks.close }); await pending;
    expect(stop).toHaveBeenCalledOnce(); expect(mocks.close).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
  it("releases stream, video, model and frame loop on normal pause", async () => {
    const runtime = new AttentionRuntime(vi.fn());
    await runtime.start("stroop", Symbol());
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    runtime.cancel(true);
    expect(stop).toHaveBeenCalledOnce(); expect(mocks.close).toHaveBeenCalledOnce();
    expect(video.pause).toHaveBeenCalledOnce(); expect(video.srcObject).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});

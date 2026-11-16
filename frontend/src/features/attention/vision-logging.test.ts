import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("local MediaPipe native severity routing", () => {
  for (const name of ["vision_wasm_internal.js", "vision_wasm_module_internal.js"]) {
    it(`keeps genuine errors visible in ${name}`, () => {
      const source = readFileSync(`public/mediapipe/wasm/${name}`, "utf8");
      const routing = source.match(/\/\/ ATTUNE_NATIVE_LOG_ROUTING_START([\s\S]*?)\/\/ ATTUNE_NATIVE_LOG_ROUTING_END/)?.[1];
      expect(routing).toBeTruthy();
      const console = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const context = { console, err: undefined as unknown as (...args: unknown[]) => void };
      runInNewContext(routing!, context);
      context.err("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
      context.err("I0000 00:00 native info");
      context.err("WARNING: native warning");
      context.err("W0000 00:00 native warning");
      expect(console.info).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledTimes(2);
      expect(console.error).not.toHaveBeenCalled();
      context.err("ERROR: inference failed");
      context.err("unknown diagnostic");
      context.err("INFO: unexpected multi-argument message", new Error("failure"));
      expect(console.error).toHaveBeenCalledTimes(3);
    });
  }
});

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// MediaPipe's native stderr includes informational messages. Route declared
// severities inside its own loader, without modifying the application's console.
const routing = `// ATTUNE_NATIVE_LOG_ROUTING_START
var nativeVisionError = console.error.bind(console);
var nativeVisionInfo = console.info.bind(console);
var nativeVisionWarning = console.warn.bind(console);
var err = function(...args) {
  var message = args.length === 1 && typeof args[0] === "string" ? args[0].trim() : "";
  if (/^(INFO: |I\\d{4}\\s)/.test(message)) nativeVisionInfo(...args);
  else if (/^(WARNING: |W\\d{4}\\s)/.test(message)) nativeVisionWarning(...args);
  else nativeVisionError(...args);
};
// ATTUNE_NATIVE_LOG_ROUTING_END`;

for (const name of ["vision_wasm_internal.js", "vision_wasm_module_internal.js"]) {
  const path = fileURLToPath(new URL(`../public/mediapipe/wasm/${name}`, import.meta.url));
  const source = readFileSync(path, "utf8");
  if (source.includes("ATTUNE_NATIVE_LOG_ROUTING_START")) continue;
  const original = "var err = console.error.bind(console);";
  if (!source.includes(original)) throw new Error(`MediaPipe loader changed: review native logging in ${name}`);
  writeFileSync(path, source.replace(original, routing));
}

import test from "node:test";
import assert from "node:assert/strict";
import { runWorkflowStep } from "../packages/runtime/src/index.mjs";

test("large tool evidence uses a native streamed step and a compact completion result", async () => {
  const result = {
    packId: "http",
    packVersion: "0.1.0",
    tool: "curl",
    toolVersion: "8.23.0",
    exitCode: 0,
    timedOut: false,
    truncated: false,
    stdout: "x".repeat(1100000),
    stderr: "",
    startedAt: "2026-11-05T00:00:00Z",
    finishedAt: "2026-11-05T00:00:01Z",
  };
  let stored;
  const step = {
    async do(_name, config, callback) {
      assert.equal(config.timeout, "20 minutes");
      const value = await callback();
      if (value instanceof ReadableStream) {
        stored = await new Response(value).text();
        return new Blob([stored]).stream();
      }
      if (new TextEncoder().encode(JSON.stringify(value)).length > 1048576)
        throw Error("Non-stream step result exceeds 1 MiB");
      return value;
    },
  };
  const summary = await runWorkflowStep(
    step,
    { run: async () => result },
    { tool: "curl", target: "https://example.com/" },
  );
  assert.equal(JSON.parse(stored).stdout.length, 1100000);
  assert.equal(summary.stdoutBytes, 1100000);
  assert.equal(summary.exitCode, 0);
  assert(!Object.hasOwn(summary, "stdout"));
  assert(new TextEncoder().encode(JSON.stringify(summary)).length < 4096);
});

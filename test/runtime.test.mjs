import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
const moduleURL =
  "data:text/javascript," +
  encodeURIComponent(
    "export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}",
  );
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "cloudflare:workers"
      ? { url: moduleURL, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});
const { ReconRunner } = await import("../src/worker.mjs");
hooks.deregister();

test("a hung native readiness command cannot reset the overall startup deadline", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  t.mock.method(AbortSignal, "timeout", (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("deadline")), ms);
    return controller.signal;
  });
  let running = false;
  const container = {
    images: { recon: "test-image" },
    get running() {
      return running;
    },
    start() {
      running = true;
    },
    setInactivityTimeout: async () => {},
    inspect: async () => ({ image: "test-image" }),
    exec: async (_argv, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
  };
  const runner = new ReconRunner({ container }, {});
  let settled = false;
  const pending = runner.run({ tool: "dnsx", target: "example.com" }).then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await nextTurn();
  t.mock.timers.tick(90001);
  await nextTurn();
  assert.equal(
    settled,
    true,
    "startup is still waiting after the total 90-second budget",
  );
  await pending;
});

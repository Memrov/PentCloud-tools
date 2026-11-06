import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import lock from "../packages/metasploit/tools.lock.json" with { type: "json" };
const hooks = registerHooks({
  resolve(s, c, next) {
    return s === "cloudflare:workers"
      ? {
          url: "data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}",
          shortCircuit: true,
        }
      : next(s, c);
  },
});
const { MetasploitRunner } = await import(
  "../packages/metasploit/src/worker.mjs"
);
hooks.deregister();
const hash = Buffer.from(
  await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(lock)),
  ),
).toString("hex");
function fixture() {
  const state = {
    running: false,
    headers: [],
    storage: new Map(),
    image: "msf-image",
  };
  const ctx = {
    storage: {
      get: async (k) => state.storage.get(k),
      put: async (k, v) => state.storage.set(k, v),
      delete: async (k) => state.storage.delete(k),
    },
    container: {
      images: { metasploit: "msf-image" },
      get running() {
        return state.running;
      },
      start(options) {
        state.running = true;
        state.options = options;
      },
      inspect: async () => ({ image: state.image }),
      setInactivityTimeout: async () => {},
      destroy: async () => {
        state.running = false;
      },
      exec: async () => ({
        output: async () => ({
          exitCode: 0,
          stdout: new TextEncoder().encode(JSON.stringify({ lockSha256: hash }))
            .buffer,
        }),
      }),
      getTcpPort: () => ({
        fetch: async (input, options) => {
          const req =
            input instanceof Request ? input : new Request(input, options);
          state.headers.push(new Headers(req.headers));
          return new Response("{}", {
            status: req.method === "GET" ? 405 : 200,
          });
        },
      }),
    },
  };
  return { state, runner: new MetasploitRunner(ctx, {}) };
}
test("invalid MCP routes never start a runtime or store authentication state", async () => {
  const { state, runner } = fixture();
  assert.equal(
    (await runner.fetch(new Request("https://internal/not-mcp"))).status,
    400,
  );
  assert(!state.running);
  assert.equal(state.storage.size, 0);
});
test("MCP uses private service authentication and stop removes its owned state", async () => {
  const { state, runner } = fixture();
  await runner.fetch(
    new Request("https://internal/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer caller-value" },
      body: "{}",
    }),
  );
  const header = state.headers.at(-1).get("Authorization");
  assert.notEqual(header, "Bearer caller-value");
  assert.equal(header, "Bearer " + state.storage.get("mcp-token"));
  assert(
    !state.options.entrypoint
      .join(" ")
      .includes(state.storage.get("mcp-token")),
  );
  await runner.stop();
  assert(!state.running);
  assert.equal(state.storage.size, 0);
});
test("a changed framework image leaves the running instance intact until explicit stop", async () => {
  const { state, runner } = fixture();
  state.running = true;
  state.image = "old";
  state.storage.set("mcp-token", "fixture-only");
  await assert.rejects(runner.fetch(new Request("https://internal/mcp")));
  assert(state.running);
  await runner.stop();
});

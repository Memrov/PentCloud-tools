import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import lock from "../packages/http/tools.lock.json" with { type: "json" };
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
const { HttpRunner } = await import("../packages/http/src/worker.mjs");
const { ReferenceRunner } = await import("../packages/reference/src/worker.mjs");
hooks.deregister();
const hash = Buffer.from(
  await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(lock)),
  ),
).toString("hex");
const encoded = (x) => new TextEncoder().encode(x).buffer;
function fixture() {
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const records = new Map();
  const state = {
    running: false,
    manifest: { lockSha256: hash },
    image: "pinned-http",
    commands: [],
    helper: async () => ({
      exitCode: 0,
      stdout: "real tool response",
      stderr: "",
      timedOut: false,
      truncated: false,
      processMs: 1,
      firstJSONMs: 0,
    }),
  };
  const c = {
    images: { http: "pinned-http" },
    get running() {
      return state.running;
    },
    start(options) {
      state.startOptions = options;
      state.running = true;
    },
    setInactivityTimeout: async () => {},
    inspect: async () => ({ image: state.image }),
    destroy: async () => {
      state.running = false;
    },
    exec: async (argv, options) => ({
      output: async () => {
        let value = { exitCode: 0, stdout: "", stderr: "" };
        if (argv[0] === "/bin/cat")
          value.stdout = JSON.stringify(state.manifest);
        else if (argv[0] !== "/bin/true") {
          assert.equal(argv[0], "/opt/pentcloud-http/bin/pack-exec");
          const cmd = JSON.parse(await new Response(options.stdin).text());
          state.commands.push(cmd);
          entered();
          value.stdout = JSON.stringify(await state.helper(cmd));
        }
        return {
          ...value,
          stdout: encoded(value.stdout),
          stderr: encoded(value.stderr),
        };
      },
    }),
  };
  return { state, started, runner: new HttpRunner({ container: c, storage: {get: async k => records.get(k), put: async (k,v) => records.set(k,v)} }, {}) };
}
test("a pack rejects a mismatched asset lock before executing tools", async () => {
  const { runner, state } = fixture();
  state.manifest.lockSha256 = "wrong";
  await assert.rejects(
    runner.run({ tool: "curl", target: "https://example.com/" }),
    /pins do not match/,
  );
  assert.equal(state.commands.length, 0);
  await runner.stop();
  assert(!state.running);
});
test("pack results retain failure evidence and the queue recovers", async () => {
  const { runner, state } = fixture();
  const healthy = state.helper;
  state.helper = async () => ({
    exitCode: 7,
    stdout: "partial",
    stderr: "failed",
    timedOut: false,
    truncated: false,
  });
  const result = await runner.run({
    tool: "curl",
    target: "https://example.com/",
  });
  assert.equal(result.exitCode, 7);
  assert.equal(result.stderr, "failed");
  assert.equal(result.packId, "http");
  state.helper = healthy;
  assert.equal(
    (await runner.run({ tool: "curl", target: "https://example.com/" })).stdout,
    "real tool response",
  );
  await runner.stop();
});
test("a running command completes before queued calls and shutdown", async () => {
  const { runner, state, started } = fixture();
  let unblock;
  const blocked = new Promise((r) => {
    unblock = r;
  });
  const helper = state.helper;
  state.helper = async (c) => {
    await blocked;
    return helper(c);
  };
  const a = runner.run({ tool: "curl", target: "https://example.com/" }),
    b = runner.run({ tool: "curl", target: "https://example.com/next" });
  let stopped = false;
  const s = runner.stop().then((x) => {
    stopped = true;
    return x;
  });
  await started;
  assert(!stopped);
  assert.equal(state.commands.length, 1);
  unblock();
  await Promise.all([a, b, s]);
  assert.equal(state.commands.length, 2);
  assert(!state.running);
});
test("a changed image never replaces a running assessment implicitly", async () => {
  const { runner, state } = fixture();
  state.running = true;
  state.image = "previous-image";
  await assert.rejects(
    runner.run({ tool: "curl", target: "https://example.com/" }),
    /Image changed/,
  );
  assert(state.running);
  await runner.stop();
});

test("readiness starts a named Cloudflare preset without executing a scanner", async () => {
  const {runner,state}=fixture();
  const ready=await runner.ready();
  assert.equal(ready.image,"pinned-http");
  assert.equal(state.startOptions.instance,"lite");
  assert.equal(state.commands.length,0);
  assert(state.running);
  await runner.stop();
  assert(!state.running);
});

test("retiring an owned runtime fences delayed calls instead of restarting it", async () => {
  const {runner,state}=fixture();
  await runner.ready();
  assert.deepEqual(await runner.retire(),{stopped:true,retired:true});
  await assert.rejects(runner.run({tool:"curl",target:"https://example.com/"}),/retired/);
  assert(!state.running);
  assert.equal(state.commands.length,0);
});

test("retired reference runtimes cannot fetch source",async()=>{
 const runner=new ReferenceRunner({storage:{get:async()=>true}},{});
 await assert.rejects(runner.readSource("exploits/multiple/webapps/50383.sh"),/retired/);
});

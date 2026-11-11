import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import lock from "../packages/http/tools.lock.json" with { type: "json" };
import { TOOL_TIMEOUT_MS, TOOL_EXEC_TIMEOUT_MS, TOOL_IDLE_TIMEOUT_MS } from "../packages/runtime/src/index.mjs";
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
    lateSignals: [],
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
    setInactivityTimeout: async (ms) => { state.idleTimeoutMs = ms; },
    inspect: async () => ({ image: state.image }),
    destroy: async () => {
      state.running = false;
    },
    exec: async (argv, options) => {
      let exited=false;
      options.signal?.addEventListener("abort",()=>{if(exited)state.lateSignals.push(argv[0]);});
      let finish;const exitCode=new Promise(resolve=>{finish=resolve;});
      return {exitCode,
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
        exited=true;finish(value.exitCode);
        return {
          ...value,
          stdout: encoded(value.stdout),
          stderr: encoded(value.stderr),
        };
      },
    };},
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
test("reconstructed tool objects restore the live execution inactivity allowance", async () => {
  let idle;
  new HttpRunner({
    container: { running: true, setInactivityTimeout: async ms => { idle=ms; } },
    blockConcurrencyWhile: async fn => fn(),
  }, {});
  await nextTurn();
  assert.equal(idle, TOOL_IDLE_TIMEOUT_MS);
});
test("completed native exec processes cannot receive a later deadline signal", async t=>{
  t.mock.timers.enable({apis:["Date","setTimeout"],now:0});
  t.mock.method(AbortSignal,"timeout",ms=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal;});
  const {runner,state}=fixture();
  await runner.run({tool:"curl",target:"https://example.com/"});
  t.mock.timers.tick(TOOL_EXEC_TIMEOUT_MS + 1);await nextTurn();
  assert.deepEqual(state.lateSignals,[],"a completed readiness/manifest/tool process must not be signaled after its PID can be reused");
});
test("a live pack call survives the old execution and idle deadlines", async t => {
  t.mock.timers.enable({apis:["Date","setTimeout"],now:0});
  const {runner,state,started}=fixture();
  const healthy=state.helper;
  state.helper=async command=>{
    assert.equal(command.timeoutMs, TOOL_TIMEOUT_MS);
    await new Promise(resolve=>setTimeout(resolve,125000));
    return healthy(command);
  };
  let settled=false;
  const result=runner.run({tool:"curl",target:"https://example.com/"}).finally(()=>{settled=true;});
  await started;
  t.mock.timers.tick(120001);await nextTurn();
  assert.equal(settled,false,"the live request must still be waiting after two minutes");
  assert.equal(state.idleTimeoutMs,TOOL_IDLE_TIMEOUT_MS);
  t.mock.timers.tick(5000);await nextTurn();
  assert.equal((await result).exitCode,0);
  assert.deepEqual(state.lateSignals,[]);
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

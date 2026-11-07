import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createHash } from "node:crypto";
import { buildCommand } from "../src/index.mjs";
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
// Import edited source directly: other adapters may resolve older nested runtimes.
const { createRunner } = await import("../packages/runtime/src/worker.mjs");
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
  const runner = new ReconRunner({ container, storage: {get:async()=>undefined} }, {});
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

const release = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("../tools.lock.json", import.meta.url), "utf8"),
);
const manifestFor = (lock) => ({
  lockSha256: createHash("sha256").update(JSON.stringify(lock)).digest("hex"),
  lock,
});
const encoded = (value) => new TextEncoder().encode(value).buffer;
function nativeFixture(Runner = ReconRunner, lock = release) {
  const packId = lock.packId ?? "recon";
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const records = new Map();
  const state = {
    running: false,
    image: "recon-image",
    manifest: JSON.stringify(manifestFor(lock)),
    commands: [],
    manifestExit: 0,
    helper: async (command) => ({
      exitCode: 0,
      stdout: '{"observed":true}\n',
      stderr: "",
      timedOut: false,
      truncated: false,
      argv: command.argv,
      processMs: 1,
      firstJSONMs: 1,
      cpuUserMs: 0,
      cpuSystemMs: 0,
      maxRSSKiB: 16,
    }),
  };
  const container = {
    images: { [packId]: "recon-image" },
    get running() {
      return state.running;
    },
    start(options) {
      const {image}=options;
      state.startOptions = options;
      state.running = true;
      state.image = image;
    },
    setInactivityTimeout: async () => {},
    inspect: async () => (state.running ? { image: state.image } : null),
    destroy: async () => {
      state.running = false;
    },
    exec: async (argv, options) => ({
      exitCode: Promise.resolve(0),
      output: async () => {
        if (argv[0] === "/bin/true")
          return { exitCode: 0, stdout: encoded(""), stderr: encoded("") };
        if (argv[0] === "/bin/cat")
          return {
            exitCode: state.manifestExit,
            stdout: encoded(state.manifest),
            stderr: encoded(""),
          };
        assert.equal(argv[0], `/opt/pentcloud-${packId}/bin/pack-exec`);
        const command = JSON.parse(await new Response(options.stdin).text());
        state.commands.push(command);
        entered();
        const response = await state.helper(command);
        return {
          exitCode: response.helperExit ?? 0,
          stdout: encoded(response.raw ?? JSON.stringify(response)),
          stderr: encoded(""),
        };
      },
    }),
  };
  const ctx = { container, storage: {get: async k => records.get(k),put: async (k,v) => records.set(k,v)} };
  return { state, container, ctx, started, runner: new Runner(ctx, {}) };
}

test("structured tool failures remain visible and do not poison the next call", async () => {
  const { runner, state } = nativeFixture();
  state.helper = async () => ({
    exitCode: 7,
    stdout: "",
    stderr: "connection failed",
    timedOut: false,
    truncated: false,
    argv: [],
    processMs: 2,
    firstJSONMs: 0,
    cpuUserMs: 0,
    cpuSystemMs: 0,
    maxRSSKiB: 16,
  });
  const failed = await runner.run({
    tool: "httpx",
    target: "https://example.com/",
  });
  assert.equal(failed.exitCode, 7);
  assert.equal(failed.stderr, "connection failed");
  assert.equal(failed.tool, "httpx");
  const next = await runner.run({ tool: "dnsx", target: "example.com" });
  assert.equal(next.tool, "dnsx");
  assert.deepEqual(await runner.stop(), { stopped: true });
});

test("concurrent requests and stop wait for the active command", async () => {
  const { runner, state, started } = nativeFixture();
  let unblock;
  const blocked = new Promise((resolve) => {
    unblock = resolve;
  });
  const helper = state.helper;
  let first = true;
  state.helper = async (command) => {
    if (first) {
      first = false;
      await blocked;
    }
    return helper(command);
  };
  const active = runner.run({ tool: "dnsx", target: "first.example" });
  let secondSettled = false,
    stopSettled = false;
  const second = runner
    .run({ tool: "dnsx", target: "second.example" })
    .then((value) => {
      secondSettled = true;
      return value;
    });
  const stopped = runner.stop().then((value) => {
    stopSettled = true;
    return value;
  });
  await started;
  assert.equal(state.commands.length, 1);
  assert.equal(secondSettled, false);
  assert.equal(stopSettled, false);
  assert.equal(state.running, true);
  unblock();
  const [a, b, s] = await Promise.all([active, second, stopped]);
  assert.equal(a.tool, "dnsx");
  assert.equal(b.tool, "dnsx");
  assert.equal(state.commands.length, 2);
  assert.deepEqual(s, { stopped: true });
  assert.equal(state.running, false);
});

test("changing the configured image never destroys an existing runtime implicitly", async () => {
  const { runner, state } = nativeFixture();
  state.running = true;
  state.image = "older-image";
  await assert.rejects(
    runner.run({ tool: "dnsx", target: "example.com" }),
    /image changed/i,
  );
  assert.equal(state.running, true);
  await runner.stop();
  assert.equal(state.running, false);
});

test("damaged, missing and incompatible image manifests are rejected", async () => {
  for (const [manifest, manifestExit, message] of [
    ["not json", 0, /Invalid pack image manifest/],
    [JSON.stringify(manifestFor(release)), 1, /pins do not match/],
    [
      JSON.stringify(manifestFor({ ...release, packVersion: "wrong-release" })),
      0,
      /pins do not match/,
    ],
    [JSON.stringify(manifestFor({ ...release, tools: [] })), 0, /pins do not match/],
    [JSON.stringify(manifestFor({ ...release, baseImage: "changed" })), 0, /pins do not match/],
    [JSON.stringify(manifestFor({ ...release, tools: release.tools.map(t => ({ ...t, binarySha256: "wrong" })) })), 0, /pins do not match/],
    [JSON.stringify(release), 0, /pins do not match/],
  ]) {
    const { runner, state } = nativeFixture();
    state.manifest = manifest;
    state.manifestExit = manifestExit;
    await assert.rejects(
      runner.run({ tool: "dnsx", target: "example.com" }),
      message,
    );
    assert.equal(state.commands.length, 0);
    await runner.stop();
  }
});

test("malformed execution responses fail explicitly and the queue can recover", async () => {
  const { runner, state } = nativeFixture();
  const healthy = state.helper;
  for (const [response, message] of [
    [{ helperExit: 2, raw: "" }, /execution helper failed/],
    [{ raw: "not json" }, /Invalid pack execution response/],
    [{ exitCode: 0 }, /Incomplete pack execution response/],
  ]) {
    state.helper = async () => response;
    await assert.rejects(
      runner.run({ tool: "dnsx", target: "example.com" }),
      message,
    );
  }
  state.helper = healthy;
  const recovered = await runner.run({ tool: "dnsx", target: "example.com" });
  assert.equal(recovered.exitCode, 0);
  assert.equal(recovered.stdout, '{"observed":true}\n');
  await runner.stop();
});

test("a missing named image rejects the call before any runtime starts", async () => {
  const { runner, state, container } = nativeFixture();
  delete container.images.recon;
  await assert.rejects(
    runner.run({ tool: "dnsx", target: "example.com" }),
    /Configure the recon named image/,
  );
  assert.equal(state.running, false);
  assert.deepEqual(await runner.stop(), { stopped: true });
});

test("recon readiness verifies its image without launching reconnaissance", async () => {
  const {runner,state}=nativeFixture();
  state.helper=async()=>{throw new Error("Readiness must not scan");};
  assert.equal((await runner.ready()).image,"recon-image");
  assert.equal(state.startOptions.instance,"standard-1");
  await runner.stop();
  assert(!state.running);
});

test("recon retirement permanently closes the owned identity", async () => {
  const {runner,state}=nativeFixture();
  await runner.ready();await runner.retire();
  await assert.rejects(runner.ready(),/retired/);
  assert(!state.running);
});

test("shared source factory preserves each pack preset and network policy", async () => {
  for (const packId of ["recon", "http", "nuclei", "sqlmap", "pcap", "file-analysis", "password", "reference", "service", "web-context"]) {
    const lock = packId === "recon" ? { ...release, packId } : (await import(`../packages/${packId}/tools.lock.json`, { with: { type: "json" } })).default;
    const Runner = createRunner(lock, buildCommand);
    const { runner, state } = nativeFixture(Runner, lock);
    const ready = await runner.ready();
    const instance = ["recon", "password", "sqlmap"].includes(packId) ? "standard-1" : "lite";
    assert.equal(ready.instance, instance, packId);
    assert.equal(state.startOptions.instance, instance, packId);
    assert.equal(state.startOptions.enableInternet, lock.runtime?.enableInternet ?? true, packId);
    assert.deepEqual(state.startOptions.labels, { pack: packId, version: lock.packVersion });
    assert.equal(state.commands.length, 0);
    await runner.stop();
  }
});

test("recon dispatches every bounded profile through the shared helper", async () => {
  const { runner, state } = nativeFixture();
  for (const tool of ["httpx", "dnsx", "katana", "subfinder"]) {
    const input = { tool, target: ["httpx", "katana"].includes(tool) ? "https://example.com/" : "example.com" };
    const result = await runner.run(input);
    assert.deepEqual(state.commands.at(-1), buildCommand(input));
    assert.equal(result.tool, tool);
    assert.equal(result.toolVersion, release.tools.find(t => t.tool === tool).version);
    assert.equal(result.packVersion, release.packVersion);
    assert.equal(result.packId, "recon");
    assert.equal(result.image, "recon-image");
  }
  await runner.stop();
});

test("recon validation rejects arbitrary flags before starting a container", () => {
  const { runner, state } = nativeFixture();
  assert.throws(() => runner.run({ tool: "dnsx", target: "example.com", args: ["--extra"] }), /only tool and target/);
  assert.equal(state.running, false);
  assert.equal(state.commands.length, 0);
});

test("recon verifies actual image identity after reading the manifest", async () => {
  const { runner, state, container } = nativeFixture();
  container.inspect = async () => ({ image: "unexpected-image" });
  await assert.rejects(runner.run({ tool: "dnsx", target: "example.com" }), /verify pack image identity/);
  assert.equal(state.commands.length, 0);
  await runner.stop();
});

test("recon retirement drains active work and survives object reconstruction", async () => {
  const { runner, state, ctx, started } = nativeFixture();
  let unblock;
  const blocked = new Promise(resolve => { unblock = resolve; });
  const helper = state.helper;
  state.helper = async command => { await blocked; return helper(command); };
  const active = runner.run({ tool: "dnsx", target: "example.com" });
  const retirement = runner.retire();
  const delayed = runner.run({ tool: "dnsx", target: "later.example" });
  const rejected = assert.rejects(delayed, /retired/);
  await started;
  assert.equal(await ctx.storage.get("retired"), undefined);
  assert.equal(state.running, true);
  assert.equal(state.commands.length, 1);
  unblock();
  await active;
  assert.deepEqual(await retirement, { stopped: true, retired: true });
  await rejected;
  const reconstructed = new ReconRunner(ctx, {});
  await assert.rejects(reconstructed.ready(), /retired/);
  await assert.rejects(reconstructed.run({ tool: "dnsx", target: "example.com" }), /retired/);
  assert.deepEqual(await reconstructed.stop(), { stopped: true });
  assert.equal(state.running, false);
  assert.equal(state.commands.length, 1);
});

test("recon stop remains restartable without clearing retirement storage", async () => {
  const { runner, state } = nativeFixture();
  await runner.ready();
  await runner.stop();
  await runner.ready();
  assert.equal(state.running, true);
  await runner.stop();
});

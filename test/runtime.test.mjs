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

const release = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("../tools.lock.json", import.meta.url), "utf8"),
);
const encoded = (value) => new TextEncoder().encode(value).buffer;
function nativeFixture() {
  const state = {
    running: false,
    image: "recon-image",
    manifest: JSON.stringify(release),
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
    images: { recon: "recon-image" },
    get running() {
      return state.running;
    },
    start({ image }) {
      state.running = true;
      state.image = image;
    },
    setInactivityTimeout: async () => {},
    inspect: async () => (state.running ? { image: state.image } : null),
    destroy: async () => {
      state.running = false;
    },
    exec: async (argv, options) => ({
      output: async () => {
        if (argv[0] === "/bin/true")
          return { exitCode: 0, stdout: encoded(""), stderr: encoded("") };
        if (argv[0] === "/bin/cat")
          return {
            exitCode: state.manifestExit,
            stdout: encoded(state.manifest),
            stderr: encoded(""),
          };
        assert.equal(argv[0], "/opt/pentcloud-recon/bin/recon-exec");
        const command = JSON.parse(await new Response(options.stdin).text());
        const response = await state.helper(command);
        return {
          exitCode: response.helperExit ?? 0,
          stdout: encoded(response.raw ?? JSON.stringify(response)),
          stderr: encoded(""),
        };
      },
    }),
  };
  return { state, container, runner: new ReconRunner({ container }, {}) };
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
  const { runner, state } = nativeFixture();
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
  await nextTurn();
  assert.equal(secondSettled, false);
  assert.equal(stopSettled, false);
  assert.equal(state.running, true);
  unblock();
  const [a, b, s] = await Promise.all([active, second, stopped]);
  assert.equal(a.tool, "dnsx");
  assert.equal(b.tool, "dnsx");
  assert.deepEqual(s, { stopped: true });
  assert.equal(state.running, false);
});

test("changing the configured image never destroys an existing runtime implicitly", async () => {
  const { runner, state } = nativeFixture();
  state.running = true;
  state.image = "older-image";
  await assert.rejects(
    runner.run({ tool: "dnsx", target: "example.com" }),
    /image changed/,
  );
  assert.equal(state.running, true);
  await runner.stop();
  assert.equal(state.running, false);
});

test("damaged, missing and incompatible image manifests are rejected", async () => {
  for (const [manifest, manifestExit, message] of [
    ["not json", 0, /Invalid recon image release manifest/],
    ["", 1, /missing its release manifest/],
    [
      JSON.stringify({ ...release, packVersion: "wrong-release" }),
      0,
      /versions do not match/,
    ],
    [JSON.stringify({ ...release, tools: [] }), 0, /versions do not match/],
  ]) {
    const { runner, state } = nativeFixture();
    state.manifest = manifest;
    state.manifestExit = manifestExit;
    await assert.rejects(
      runner.run({ tool: "dnsx", target: "example.com" }),
      message,
    );
    await runner.stop();
  }
});

test("malformed execution responses fail explicitly and the queue can recover", async () => {
  const { runner, state } = nativeFixture();
  const healthy = state.helper;
  for (const [response, message] of [
    [{ helperExit: 2, raw: "" }, /execution helper failed/],
    [{ raw: "not json" }, /Invalid recon execution response/],
    [{ exitCode: 0 }, /Incomplete recon execution response/],
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

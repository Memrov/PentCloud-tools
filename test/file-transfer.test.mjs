import test from "node:test";
import assert from "node:assert/strict";
import { prepareFiles } from "../packages/runtime/src/index.mjs";

test("binary inputs are copied and hashed without becoming command arguments", async () => {
  const original = new Uint8Array([0, 1, 2, 255]);
  const pending = prepareFiles(["input"], { input: original });
  original[0] = 99;
  const result = await pending;
  assert.equal(result.input.base64, "AAEC/w==");
  assert.match(result.input.sha256, /^[0-9a-f]{64}$/);
});
test("file transfer rejects missing, unexpected and oversized inputs", async () => {
  await assert.rejects(prepareFiles(["input"], {}));
  await assert.rejects(
    prepareFiles(["input"], {
      input: new Uint8Array([1]),
      "../escape": new Uint8Array([2]),
    }),
  );
  await assert.rejects(
    prepareFiles(["input"], { input: new Uint8Array(2097153) }),
  );
  await assert.rejects(prepareFiles([], { input: new Uint8Array([1]) }));
});

test("Node Buffer inputs are isolated before asynchronous hashing", async () => {
  const original = Buffer.from([0, 1, 2, 255]);
  const pending = prepareFiles(["input"], { input: original });
  original[0] = 99;
  const result = await pending;
  assert.equal(result.input.base64, "AAEC/w==");
  assert.equal(
    result.input.sha256,
    await prepareFiles(["input"], {
      input: new Uint8Array([0, 1, 2, 255]),
    }).then((x) => x.input.sha256),
  );
});

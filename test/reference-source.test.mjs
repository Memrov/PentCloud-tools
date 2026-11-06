import test from "node:test";
import assert from "node:assert/strict";
import { fetchReference } from "../packages/reference/src/index.mjs";
test("reference source reads only the pinned project tree and returns audited bytes", async () => {
  let requested;
  const result = await fetchReference(
    "exploits/multiple/webapps/50383.sh",
    async (url, options) => {
      assert.equal(options.redirect, "manual");
      requested = url;
      return new Response("reference fixture");
    },
  );
  assert.match(
    requested,
    /gitlab\.com\/exploit-database\/exploitdb\/-\/raw\/f08907b131f851c2ec3c052906f82ca83703ebef\/exploits\//,
  );
  assert.equal(new TextDecoder().decode(result.bytes), "reference fixture");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});
test("reference paths cannot select another origin or escape the pinned tree", async () => {
  for (const path of [
    "../README.md",
    "https://other.example/file",
    "exploits/../../secret",
    "/etc/passwd",
    "exploits/%2e%2e/file",
  ])
    await assert.rejects(fetchReference(path));
});

test("a native Searchsploit result path can be read directly", async () => {
  const result = await fetchReference(
    "/opt/exploitdb/exploits/multiple/webapps/50383.sh",
    async () => new Response("reference"),
  );
  assert.equal(result.path, "exploits/multiple/webapps/50383.sh");
});

test("reference redirects and oversized responses are rejected", async () => {
  await assert.rejects(
    fetchReference(
      "exploits/a.c",
      async () =>
        new Response("", {
          status: 302,
          headers: { Location: "https://other.example/" },
        }),
    ),
    /unavailable/,
  );
  await assert.rejects(
    fetchReference(
      "exploits/a.c",
      async () =>
        new Response("", { headers: { "Content-Length": "1048577" } }),
    ),
    /oversized/,
  );
});

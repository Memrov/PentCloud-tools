import test from "node:test";
import assert from "node:assert/strict";
import { buildCommand as http } from "../packages/http/src/index.mjs";
import { buildCommand as nuclei } from "../packages/nuclei/src/index.mjs";
import { buildCommand as sqlmap } from "../packages/sqlmap/src/index.mjs";

test("HTTP discovery uses only the packaged wordlist and bounded nonrecursive requests", () => {
  const c = http({ tool: "ffuf", target: "https://example.com/app/" });
  assert.equal(
    c.argv[c.argv.indexOf("-u") + 1],
    "https://example.com/app/FUZZ",
  );
  assert.equal(
    c.argv[c.argv.indexOf("-w") + 1],
    "/opt/pentcloud-http/assets/paths.txt",
  );
  assert.equal(c.argv[c.argv.indexOf("-rate") + 1], "2");
  assert.equal(c.argv[c.argv.indexOf("-t") + 1], "1");
  assert(!c.argv.includes("-r"));
});
test("curl preserves exact target/query and never follows redirects implicitly", () => {
  const c = http({ tool: "curl", target: "https://example.com/a?id=2" });
  assert(c.argv.includes("https://example.com/a?id=2"));
  assert(!c.argv.includes("--location"));
  assert(c.argv.includes("--include"));
});

test("discovery never substitutes markers already present in the selected directory", () => {
  assert.throws(() =>
    http({ tool: "ffuf", target: "https://example.com/FUZZ/" }),
  );
});

test("SQL header aliases cannot override the native GET filter", () => {
  for (const parameter of [
    "host",
    "referer",
    "ref",
    "referrer",
    "useragent",
    "user-agent",
    "ua",
    "cookie",
    "Host",
    "UserAgent",
  ]) {
    assert.throws(() =>
      sqlmap({
        tool: "sqlmap",
        target: "https://example.com/?" + parameter + "=1",
        parameter,
      }),
    );
  }
  const c = sqlmap({
    tool: "sqlmap",
    target: "https://example.com/?Cache-Control=1",
    parameter: "Cache-Control",
  });
  assert(c.argv.includes("--param-filter=GET"));
});
test("TLS inspection connects to the HTTPS hostname and verifies the certificate", () => {
  const c = http({ tool: "openssl", target: "https://example.com/" });
  assert(c.argv.includes("example.com:443"));
  assert(c.argv.includes("-verify_return_error"));
  assert.equal(c.argv[c.argv.indexOf("-verify_hostname") + 1], "example.com");
});
test("TLS inspection verifies IP SANs without sending DNS SNI", () => {
  for (const [target, ip] of [
    ["https://192.0.2.1/", "192.0.2.1"],
    ["https://[2001:db8::1]/", "2001:db8::1"],
  ]) {
    const c = http({ tool: "openssl", target });
    assert.equal(c.argv[c.argv.indexOf("-verify_ip") + 1], ip);
    assert(!c.argv.includes("-servername"));
  }
});
test("Nuclei selects a shipped template without OAST or update behavior", () => {
  const c = nuclei({
    tool: "nuclei",
    target: "https://example.com/",
    profile: "exposures",
  });
  assert.equal(
    c.argv[c.argv.indexOf("-t") + 1],
    "/opt/pentcloud-nuclei/assets/exposures",
  );
  assert(c.argv.includes("-ni"));
  assert(c.argv.includes("-duc"));
  assert(c.argv.includes("-dr"));
  assert(!c.argv.includes("-code"));
  assert(!c.argv.includes("-headless"));
});
test("SQL testing selects one existing parameter and keeps its work outside source", () => {
  const c = sqlmap({
    tool: "sqlmap",
    target: "https://example.com/item?id=1&view=short",
    parameter: "id",
    database: "sqlite",
  });
  assert.equal(c.argv[c.argv.indexOf("-p") + 1], "id");
  assert.equal(c.argv[c.argv.indexOf("--dbms") + 1], "SQLite");
  assert(c.argv.includes("--threads=1"));
  assert(c.argv.includes("--delay=0.5"));
  assert(!c.argv.some((x) => /dump|os-shell|file-write/.test(x)));
});
test("pack interfaces reject arbitrary arguments, credentials, template paths and extra targets", () => {
  for (const [build, baseline] of [
    [http, { tool: "curl", target: "https://example.com/" }],
    [nuclei, { tool: "nuclei", target: "https://example.com/" }],
    [
      sqlmap,
      { tool: "sqlmap", target: "https://example.com/?id=1", parameter: "id" },
    ],
  ]) {
    assert.doesNotThrow(() => build(baseline));
    for (const target of [
      baseline.target.replace("https://", "https://user:password@"),
      baseline.target + "\nhttps://other.example/",
      baseline.target.replace("https:", "file:"),
      baseline.target + "#fragment",
      "-v",
    ])
      assert.throws(() => build({ ...baseline, target }));
  }
  assert.throws(() =>
    http({
      tool: "curl",
      target: "https://example.com/",
      args: ["--proxy", "x"],
    }),
  );
  assert.throws(() =>
    nuclei({
      tool: "nuclei",
      target: "https://example.com/",
      profile: "../../payload",
    }),
  );
  assert.throws(() =>
    sqlmap({
      tool: "sqlmap",
      target: "https://example.com/?id=1",
      parameter: "other",
    }),
  );
  assert.throws(() =>
    sqlmap({
      tool: "sqlmap",
      target: "https://example.com/?id=1",
      parameter: "id",
      database: "anything",
    }),
  );
});

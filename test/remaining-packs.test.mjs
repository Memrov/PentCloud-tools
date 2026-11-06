import test from "node:test";
import assert from "node:assert/strict";
import { buildCommand as service } from "../packages/service/src/index.mjs";
import { buildCommand as web } from "../packages/web-context/src/index.mjs";
import { buildCommand as pcap } from "../packages/pcap/src/index.mjs";
import { buildCommand as file } from "../packages/file-analysis/src/index.mjs";
import { buildCommand as password } from "../packages/password/src/index.mjs";
import { buildCommand as reference } from "../packages/reference/src/index.mjs";
test("service checks take one host and explicit bounded ports", () => {
  const n = service({ tool: "nmap", target: "127.0.0.1", ports: [8765, 8766] });
  assert(n.argv.includes("-sT"));
  assert(n.argv.includes("-n"));
  assert(n.argv.includes("8765,8766"));
  const p = service({ tool: "naabu", target: "127.0.0.1", ports: [8765] });
  assert(p.argv.includes("CONNECT"));
  assert.throws(() =>
    service({ tool: "masscan", target: "example.com", ports: [443] }),
  );
  for (const target of [
    "-iL /tmp/targets",
    "10.0.0.0/8",
    "a.example b.example",
  ])
    assert.throws(() => service({ tool: "nmap", target, ports: [443] }));
  assert.throws(() =>
    service({
      tool: "nmap",
      target: "example.com",
      ports: Array.from({ length: 17 }, (_, i) => i + 1),
    }),
  );
  for (const target of ["10.0.0.0-255", "0-255.0-255.0-255.0-255", "1-.0.0.1"])
    assert.throws(() => service({ tool: "nmap", target, ports: [443] }));
});
test("web context uses original passive lookup and low-aggression fingerprinting", () => {
  assert(
    web({ tool: "whatweb", target: "https://example.com/" }).argv.includes(
      "--follow-redirect=never",
    ),
  );
  const w = web({ tool: "waybackurls", target: "example.com" });
  assert.equal(w.stdin, "example.com\n");
  assert(w.argv.includes("-no-subs"));
});
test("offline profiles require file references rather than target URLs", () => {
  const p = pcap({ tool: "tshark", view: "http" });
  assert.deepEqual(p.requiredFiles, ["input"]);
  assert(p.argv.includes("-r"));
  assert(!p.argv.includes("-i"));
  assert(
    file({ tool: "binwalk", view: "signatures" }).argv.includes(
      "/tmp/pentcloud-file-analysis/input.bin",
    ),
  );
  const h = password({ tool: "hashcat", view: "sha256-dictionary" });
  assert.deepEqual(h.requiredFiles, ["input", "dictionary"]);
  assert(h.argv.includes("--potfile-disable"));
  for (const build of [pcap, file, password])
    assert.throws(() =>
      build({ tool: "other", target: "https://example.com/" }),
    );
});
test("reference lookup is read only and treats the query as data", () => {
  const r = reference({ tool: "searchsploit", query: "Apache HTTP Server" });
  assert(r.argv.includes("--json"));
  assert(!r.argv.includes("--www"));
  assert(r.argv.includes("Apache HTTP Server"));
  assert.throws(() => reference({ tool: "searchsploit", query: "--update" }));
  assert.throws(() =>
    reference({ tool: "searchsploit", query: "x", args: ["--mirror"] }),
  );
});

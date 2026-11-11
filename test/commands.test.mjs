import test from "node:test";
import assert from "node:assert/strict";
import { buildCommand } from "../src/index.mjs";

test("httpx receives a URL through stdin without a shell", () => {
  assert.deepEqual(
    buildCommand({ tool: "httpx", target: "https://example.com/" }),
    {
      argv: [
        "/opt/pentcloud-recon/bin/httpx",
        "-j",
        "-silent",
        "-duc",
        "-sc",
        "-title",
        "-server",
        "-td",
        "-nfs",
        "-rl",
        "2",
        "-t",
        "1",
        "-timeout",
        "10",
      ],
      stdin: "https://example.com/\n",
      timeoutMs: 900000,
    },
  );
});
test("dnsx requests both IP record families for the hostname", () => {
  assert.deepEqual(buildCommand({ tool: "dnsx", target: "api.example.com" }), {
    argv: [
      "/opt/pentcloud-recon/bin/dnsx",
      "-j",
      "-silent",
      "-duc",
      "-a",
      "-aaaa",
      "-rl",
      "2",
      "-t",
      "1",
      "-timeout",
      "5",
      "-retry",
      "1",
    ],
    stdin: "api.example.com\n",
    timeoutMs: 900000,
  });
});
test("Katana crawl scope escapes regex characters and includes the starting path", () => {
  const c = buildCommand({
    tool: "katana",
    target: "https://example.com/cases/demo/",
  });
  assert.deepEqual(c?.argv, [
    "/opt/pentcloud-recon/bin/katana",
    "-u",
    "https://example.com/cases/demo/",
    "-cs",
    "^https://example\\.com/cases/demo/",
    "-d",
    "2",
    "-c",
    "1",
    "-p",
    "1",
    "-rl",
    "2",
    "-ct",
    "900s",
    "-timeout",
    "10",
    "-jc",
    "-no-default-ext-filter",
    "-j",
    "-silent",
    "-duc",
  ]);
});
test("Subfinder performs bounded passive crtname discovery", () => {
  assert.deepEqual(buildCommand({ tool: "subfinder", target: "example.com" }), {
    argv: [
      "/opt/pentcloud-recon/bin/subfinder",
      "-d",
      "example.com",
      "-sources",
      "crtname",
      "-json",
      "-silent",
      "-duc",
      "-rl",
      "1",
      "-timeout",
      "10",
      "-max-time",
      "15",
    ],
    stdin: "",
    timeoutMs: 900000,
  });
});
test("credentials, newline records and CLI options cannot become targets", () => {
  for (const input of [
    { tool: "httpx", target: "https://user:password@example.com/" },
    { tool: "httpx", target: "https://example.com/\nhttps://other.example/" },
    { tool: "katana", target: "file:///etc/passwd" },
    { tool: "dnsx", target: "-list" },
    { tool: "dnsx", target: "example.com\nother.example" },
    { tool: "dnsx", target: "https://example.com/" },
    { tool: "subfinder", target: "*.example.com" },
    { tool: "sh", target: "example.com" },
    {
      tool: "httpx",
      target: "https://example.com/",
      args: ["-proxy", "http://elsewhere/"],
    },
    null,
  ])
    assert.throws(() => buildCommand(input));
});

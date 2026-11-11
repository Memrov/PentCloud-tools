import { TOOL_TIMEOUT_MS } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export const packVersion = lock.packVersion;
export const tools = Object.freeze(
  lock.tools.map(({ tool, version }) => Object.freeze({ tool, version })),
);
const prefix = "/opt/pentcloud-recon/bin/";
function hostname(value) {
  if (
    value.length > 253 ||
    !value
      .split(".")
      .every(
        (s) =>
          s.length > 0 &&
          s.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(s),
      )
  )
    throw new TypeError(
      "Use a DNS hostname, without a URL, wildcard or options",
    );
  return value.toLowerCase();
}
export function buildCommand(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !["tool", "target"].includes(k))
  )
    throw new TypeError("Expected only tool and target");
  const { tool, target } = input;
  if (
    !tools.some((t) => t.tool === tool) ||
    typeof target !== "string" ||
    !target ||
    target.length > 2048 ||
    /[\s\x00-\x1f\x7f]/.test(target)
  )
    throw new TypeError("Unsupported tool or invalid target");
  let args,
    stdin = "";
  if (tool === "httpx" || tool === "katana") {
    let url;
    try {
      url = new URL(target);
    } catch {
      throw new TypeError("Use an absolute HTTP or HTTPS URL");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new TypeError(
        "Use an HTTP(S) URL without credentials or a fragment",
      );
    const normalized = url.href;
    if (tool === "httpx") {
      args = [
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
      ];
      stdin = normalized + "\n";
    } else {
      if (url.search)
        throw new TypeError("Start a crawl with a URL without a query string");
      const scope = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      args = [
        "-u",
        normalized,
        "-cs",
        "^" + scope,
        "-d",
        "2",
        "-c",
        "1",
        "-p",
        "1",
        "-rl",
        "2",
        "-ct",
        `${TOOL_TIMEOUT_MS / 1000}s`,
        "-timeout",
        "10",
        "-jc",
        "-no-default-ext-filter",
        "-j",
        "-silent",
        "-duc",
      ];
    }
  } else {
    const host = hostname(target);
    if (tool === "dnsx") {
      args = [
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
      ];
      stdin = host + "\n";
    } else
      args = [
        "-d",
        host,
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
        String(TOOL_TIMEOUT_MS / 60000),
      ];
  }
  return { argv: [prefix + tool, ...args], stdin, timeoutMs: TOOL_TIMEOUT_MS };
}

import { request, TOOL_TIMEOUT_MS } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  let args,
    stdin = "";
  if (input?.tool === "whatweb") {
    const u = request(input, ["tool", "target"], ["whatweb"]);
    args = [
      "/opt/pentcloud-web-context/assets/whatweb/whatweb",
      "--aggression=1",
      "--max-threads=1",
      "--read-timeout=10",
      "--open-timeout=10",
      "--follow-redirect=never",
      "--color=never",
      "--quiet",
      "--log-json=/dev/stdout",
      u.href,
    ];
  } else {
    if (
      !input ||
      Object.keys(input).some((k) => !["tool", "target"].includes(k)) ||
      input.tool !== "waybackurls" ||
      typeof input.target !== "string" ||
      input.target.length > 253 ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(input.target)
    )
      throw new TypeError("Select one archive hostname");
    args = ["-no-subs"];
    stdin = input.target.toLowerCase() + "\n";
  }
  return {
    argv: ["/opt/pentcloud-web-context/bin/" + input.tool, ...args],
    stdin,
    timeoutMs: TOOL_TIMEOUT_MS,
  };
}

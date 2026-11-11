import { TOOL_TIMEOUT_MS } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  if (
    !input ||
    Object.keys(input).some((k) => !["tool", "view"].includes(k)) ||
    input.tool !== "binwalk" ||
    !["signatures", "entropy"].includes(input.view ?? "signatures")
  )
    throw new TypeError("Select an offline file view");
  return {
    argv: [
      "/opt/pentcloud-file-analysis/bin/binwalk",
      ...(input.view === "entropy"
        ? ["--entropy", "--nplot"]
        : ["--signature"]),
      "/tmp/pentcloud-file-analysis/input.bin",
    ],
    stdin: "",
    timeoutMs: TOOL_TIMEOUT_MS,
    requiredFiles: ["input"],
  };
}

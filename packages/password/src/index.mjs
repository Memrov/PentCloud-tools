import { TOOL_TIMEOUT_MS } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  if (
    !input ||
    Object.keys(input).some((k) => !["tool", "view"].includes(k)) ||
    input.tool !== "hashcat" ||
    !["identify", "sha256-dictionary"].includes(input.view ?? "identify")
  )
    throw new TypeError("Select a supported hash profile");
  const view = input.view ?? "identify",
    path = "/tmp/pentcloud-password/input.bin";
  const args =
    view === "identify"
      ? ["--identify", path]
      : [
          "-m",
          "1400",
          "-a",
          "0",
          "-D",
          "1",
          "--quiet",
          "--potfile-disable",
          "--restore-disable",
          `--runtime=${TOOL_TIMEOUT_MS / 1000}`,
          path,
          "/tmp/pentcloud-password/dictionary.bin",
        ];
  return {
    argv: ["/opt/pentcloud-password/bin/hashcat", ...args],
    stdin: "",
    timeoutMs: TOOL_TIMEOUT_MS,
    requiredFiles: view === "identify" ? ["input"] : ["input", "dictionary"],
  };
}

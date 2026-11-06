import { request } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  const url = request(input, ["tool", "target", "profile"], ["nuclei"]);
  if (input.profile !== undefined && input.profile !== "exposures")
    throw new TypeError("Select the packaged exposures profile");
  if (url.search)
    throw new TypeError(
      "Template scanning requires a base URL without a query",
    );
  return {
    argv: [
      "/opt/pentcloud-nuclei/bin/nuclei",
      "-u",
      url.href,
      "-t",
      "/opt/pentcloud-nuclei/assets/exposures",
      "-j",
      "-silent",
      "-ni",
      "-duc",
      "-dr",
      "-dut",
      "-pt",
      "http",
      "-rl",
      "2",
      "-c",
      "1",
      "-bs",
      "1",
      "-timeout",
      "10",
      "-retries",
      "0",
      "-stats-json",
    ],
    stdin: "",
    timeoutMs: 75000,
  };
}

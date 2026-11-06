import { request } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  const url = request(input, ["tool", "target"], ["ffuf", "curl", "openssl"]);
  let args;
  if (input.tool === "ffuf") {
    if (url.search || !url.pathname.endsWith("/") || url.href.includes("FUZZ"))
      throw new TypeError(
        "Discovery needs a directory URL ending in / without a query",
      );
    args = [
      "-u",
      url.href + "FUZZ",
      "-w",
      "/opt/pentcloud-http/assets/paths.txt",
      "-json",
      "-s",
      "-ac",
      "-noninteractive",
      "-rate",
      "2",
      "-t",
      "1",
      "-timeout",
      "10",
      "-maxtime",
      "40",
      "-mc",
      "all",
      "-fc",
      "404",
    ];
  } else if (input.tool === "curl")
    args = [
      "--silent",
      "--show-error",
      "--include",
      "--max-time",
      "30",
      "--connect-timeout",
      "10",
      "--max-filesize",
      "1048576",
      "--proto",
      "=http,https",
      "--globoff",
      "--url",
      url.href,
    ];
  else {
    if (
      url.protocol !== "https:" ||
      url.search ||
      url.pathname !== "/" ||
      (url.port && url.port !== "443")
    )
      throw new TypeError(
        "TLS inspection requires an HTTPS origin on port 443",
      );
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const isIP = host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host);
    args = [
      "s_client",
      "-connect",
      url.hostname + ":443",
      ...(isIP ? [] : ["-servername", host]),
      isIP ? "-verify_ip" : "-verify_hostname",
      host,
      "-verify_return_error",
      "-brief",
    ];
  }
  return {
    argv: ["/opt/pentcloud-http/bin/" + input.tool, ...args],
    stdin: "",
    timeoutMs: 75000,
  };
}

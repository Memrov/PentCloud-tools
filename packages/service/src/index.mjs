import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  if (
    !input ||
    Object.keys(input).some(
      (k) => !["tool", "target", "ports", "adapter", "routerMac"].includes(k),
    ) ||
    !["nmap", "naabu", "masscan"].includes(input.tool)
  )
    throw new TypeError("Unsupported service request");
  const host = input.target;
  if (
    typeof host !== "string" ||
    !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.split(".").some((n) => Number(n) > 255 || String(Number(n)) !== n)
  )
    throw new TypeError("Select one explicit IPv4 address from recon results");
  if (
    !Array.isArray(input.ports) ||
    !input.ports.length ||
    input.ports.length > 16 ||
    input.ports.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)
  )
    throw new TypeError("Select one to sixteen explicit ports");
  if (
    input.tool !== "masscan" &&
    (input.adapter !== undefined || input.routerMac !== undefined)
  )
    throw new TypeError("Adapter settings belong to Masscan");
  if (
    input.adapter !== undefined &&
    (typeof input.adapter !== "string" ||
      !/^[a-zA-Z0-9_.-]{1,15}$/.test(input.adapter))
  )
    throw new TypeError("Invalid network interface");
  if (
    input.routerMac !== undefined &&
    (typeof input.routerMac !== "string" ||
      !/^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(input.routerMac))
  )
    throw new TypeError("Invalid router MAC");
  const ports = [...new Set(input.ports)].sort((a, b) => a - b).join(",");
  let args;
  if (input.tool === "nmap")
    args = [
      "-sT",
      "-Pn",
      "-n",
      "--max-retries",
      "0",
      "--max-rate",
      "2",
      "--host-timeout",
      "30s",
      "--open",
      "-oX",
      "-",
      "-p",
      ports,
      host,
    ];
  else if (input.tool === "naabu")
    args = [
      "-host",
      host,
      "-p",
      ports,
      "-s",
      "CONNECT",
      "-rate",
      "2",
      "-c",
      "1",
      "-retries",
      "1",
      "-timeout",
      "1000",
      "-verify",
      "-json",
      "-silent",
      "-duc",
      "-no-stdin",
    ];
  else {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(host))
      throw new TypeError("Masscan requires one IPv4 address");
    args = [
      host + "/32",
      "-p" + ports,
      "--rate",
      "2",
      "--wait",
      "2",
      "--retries",
      "0",
      "-oJ",
      "-",
    ];
    if (input.adapter) args.push("--adapter", input.adapter);
    if (input.routerMac) args.push("--router-mac", input.routerMac);
  }
  return {
    argv: ["/opt/pentcloud-service/bin/" + input.tool, ...args],
    stdin: "",
    timeoutMs: 75000,
  };
}

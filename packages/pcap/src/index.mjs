import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  if (
    !input ||
    Object.keys(input).some((k) => !["tool", "view"].includes(k)) ||
    input.tool !== "tshark" ||
    !["summary", "http", "dns", "tcp"].includes(input.view ?? "summary")
  )
    throw new TypeError("Select an offline packet view");
  const args = [
    "-n",
    "-r",
    "/tmp/pentcloud-pcap/input.bin",
    "-c",
    "200",
    "-T",
    "json",
    "-e",
    "frame.number",
    "-e",
    "ip.src",
    "-e",
    "ip.dst",
    "-e",
    "tcp.srcport",
    "-e",
    "tcp.dstport",
    "-e",
    "udp.srcport",
    "-e",
    "udp.dstport",
    "-e",
    "dns.qry.name",
    "-e",
    "http.host",
    "-e",
    "http.request.uri",
  ];
  if (input.view && input.view !== "summary") args.push("-Y", input.view);
  return {
    argv: ["/opt/pentcloud-pcap/bin/tshark", ...args],
    stdin: "",
    timeoutMs: 75000,
    requiredFiles: ["input"],
  };
}

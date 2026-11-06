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
          "--runtime=20",
          path,
          "/tmp/pentcloud-password/dictionary.bin",
        ];
  return {
    argv: ["/opt/pentcloud-password/bin/hashcat", ...args],
    stdin: "",
    timeoutMs: 75000,
    requiredFiles: view === "identify" ? ["input"] : ["input", "dictionary"],
  };
}

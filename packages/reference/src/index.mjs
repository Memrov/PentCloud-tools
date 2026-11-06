import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export async function fetchReference(path, fetcher = fetch) {
  if (typeof path === "string" && path.startsWith("/opt/exploitdb/"))
    path = path.slice("/opt/exploitdb/".length);
  if (
    typeof path !== "string" ||
    path.length > 240 ||
    !/^(?:exploits|shellcodes)\/[a-z0-9_./-]+$/i.test(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new TypeError("Select a pinned exploit reference path");
  const url =
    "https://gitlab.com/exploit-database/exploitdb/-/raw/" +
    lock.dataRevision +
    "/" +
    path;
  const response = await fetcher(url, {
    redirect: "manual",
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
  });
  if (
    !response.ok ||
    Number(response.headers.get("Content-Length") ?? 0) > 1048576
  ) {
    await response.body?.cancel();
    throw new Error("Reference source unavailable or oversized");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Reference source body missing");
  const chunks = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.length;
    if (length > 1048576) {
      await reader.cancel();
      throw new Error("Reference source exceeds one MiB");
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    path,
    revision: lock.dataRevision,
    sha256: [...new Uint8Array(digest)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
    bytes,
  };
}
export function buildCommand(input) {
  if (
    !input ||
    Object.keys(input).some((k) => !["tool", "query"].includes(k)) ||
    input.tool !== "searchsploit" ||
    typeof input.query !== "string" ||
    !input.query.trim() ||
    input.query.length > 160 ||
    input.query.startsWith("-") ||
    !/^[a-z0-9 _./:+-]+$/i.test(input.query)
  )
    throw new TypeError("Use read-only search words");
  return {
    argv: ["/opt/pentcloud-reference/bin/searchsploit", "--json", input.query],
    stdin: "",
    timeoutMs: 75000,
  };
}

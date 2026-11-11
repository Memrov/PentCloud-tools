import { request, TOOL_TIMEOUT_MS } from "@memrov2/pentcloud-tool-runtime";
import lock from "../tools.lock.json" with { type: "json" };
export { lock };
export function buildCommand(input) {
  const url = request(
    input,
    ["tool", "target", "parameter", "database"],
    ["sqlmap"],
  );
  if (
    typeof input.parameter !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(input.parameter) ||
    url.searchParams.getAll(input.parameter).length !== 1 ||
    url.href.includes("*")
  )
    throw new TypeError("Select exactly one existing query parameter");
  // SQLmap's explicit -p aliases override --param-filter for these headers.
  if (
    [
      "ua",
      "useragent",
      "user-agent",
      "ref",
      "referer",
      "referrer",
      "host",
      "cookie",
    ].includes(input.parameter.toLowerCase())
  )
    throw new TypeError(
      "Reserved SQLmap header aliases are not supported query parameters",
    );
  const db = {
    sqlite: "SQLite",
    mysql: "MySQL",
    postgresql: "PostgreSQL",
    mssql: "Microsoft SQL Server",
  };
  if (input.database !== undefined && !Object.hasOwn(db, input.database))
    throw new TypeError("Unsupported database hint");
  const args = [
    "/opt/pentcloud-sqlmap/assets/sqlmap/sqlmap.py",
    "-u",
    url.href,
    "-p",
    input.parameter,
    "--batch",
    "--disable-coloring",
    "--threads=1",
    "--delay=0.5",
    "--timeout=8",
    "--retries=0",
    "--risk=1",
    "--level=1",
    "--param-filter=GET",
    "--technique=BE",
    "--skip-waf",
    "--ignore-redirects",
    "--flush-session",
    "--fresh-queries",
    "--output-dir=/tmp/pentcloud-sqlmap/results",
  ];
  if (input.database) args.push("--dbms", db[input.database]);
  return {
    argv: ["/opt/pentcloud-sqlmap/bin/sqlmap", ...args],
    stdin: "",
    timeoutMs: TOOL_TIMEOUT_MS,
  };
}

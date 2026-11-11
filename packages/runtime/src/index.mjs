// Live tool execution, including a separate allowance for helper output to drain.
export const TOOL_TIMEOUT_MS = 15 * 60 * 1000;
export const TOOL_EXEC_TIMEOUT_MS = TOOL_TIMEOUT_MS + 30 * 1000;
export const TOOL_IDLE_TIMEOUT_MS = TOOL_EXEC_TIMEOUT_MS + 30 * 1000;
export const TOOL_MCP_TIMEOUT_MS = 20 * 60 * 1000;

export function request(input, allowed, tools) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !allowed.includes(k)) ||
    !tools.includes(input.tool)
  )
    throw new TypeError("Unsupported tool or request fields");
  if (
    typeof input.target !== "string" ||
    !input.target ||
    input.target.length > 2048 ||
    /[\s\x00-\x1f\x7f\\]/.test(input.target)
  )
    throw new TypeError("Invalid target");
  const url = new URL(input.target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new TypeError("Use an HTTP(S) URL without credentials or a fragment");
  return url;
}

export async function prepareFiles(required, input = {}) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== required.length ||
    Object.keys(input).some((name) => !required.includes(name))
  )
    throw new TypeError("Supply exactly the required input files");
  let total = 0;
  const files = required.map((name) => {
    const value = input[name];
    if (
      !(value instanceof Uint8Array) ||
      value.byteLength === 0 ||
      (total += value.byteLength) > 2097152
    )
      throw new TypeError("Input files must total at most two MiB");
    return [name, new Uint8Array(value)];
  });
  return Object.fromEntries(
    await Promise.all(
      files.map(async ([name, value]) => {
        const digest = await crypto.subtle.digest("SHA-256", value);
        let binary = "";
        for (let offset = 0; offset < value.length; offset += 8192)
          binary += String.fromCharCode(
            ...value.subarray(offset, offset + 8192),
          );
        return [
          name,
          {
            base64: btoa(binary),
            sha256: [...new Uint8Array(digest)]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join(""),
          },
        ];
      }),
    ),
  );
}

/** Persist full output using Workflows' native stream support; complete with metadata only. */
export async function runWorkflowStep(step, runner, input, files) {
  const stream = await step.do(
    "tool-evidence",
    { retries: { limit: 0, delay: "1 second" }, timeout: "20 minutes" },
    async () => {
      const result = await runner.run(input, files);
      return new Blob([JSON.stringify(result)], {
        type: "application/json",
      }).stream();
    },
  );
  const result = await new Response(stream).json();
  return {
    packId: result.packId,
    packVersion: result.packVersion,
    tool: result.tool,
    toolVersion: result.toolVersion,
    image: result.image,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    truncated: result.truncated,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    stdoutBytes: new TextEncoder().encode(result.stdout).length,
    stderrBytes: new TextEncoder().encode(result.stderr).length,
    evidenceStep: "tool-evidence",
    ...(result.inputHashes ? { inputHashes: result.inputHashes } : {}),
  };
}

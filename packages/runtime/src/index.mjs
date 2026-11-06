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

/** Persist full output using Workflows' native stream support; complete with metadata only. */
export async function runWorkflowStep(step, runner, input) {
  const stream = await step.do(
    "tool-evidence",
    { retries: { limit: 0, delay: "1 second" }, timeout: "3 minutes" },
    async () => {
      const result = await runner.run(input);
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
  };
}

export interface ToolCommand {
  argv: string[];
  stdin: string;
  timeoutMs: number;
}
export interface PackLock {
  packId: string;
  packVersion: string;
  tools: readonly { tool: string; version: string }[];
}
export interface ToolResult {
  tool: string;
  toolVersion: string;
  packId: string;
  packVersion: string;
  image: string;
  readyMs: number;
  startedAt: string;
  finishedAt: string;
  argv: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  error?: string;
  processMs: number;
  firstJSONMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  maxRSSKiB: number;
}
export declare function request(
  input: unknown,
  allowed: string[],
  tools: string[],
): URL;

export interface StreamStep {
  do(
    name: string,
    config: { retries: { limit: 0; delay: "1 second" }; timeout: "3 minutes" },
    callback: () => Promise<ReadableStream<Uint8Array>>,
  ): Promise<ReadableStream<Uint8Array>>;
}
export declare function runWorkflowStep<I>(
  step: StreamStep,
  runner: { run(input: I): Promise<ToolResult> },
  input: I,
): Promise<
  Omit<
    ToolResult,
    | "stdout"
    | "stderr"
    | "argv"
    | "processMs"
    | "firstJSONMs"
    | "cpuUserMs"
    | "cpuSystemMs"
    | "maxRSSKiB"
    | "readyMs"
  > & { stdoutBytes: number; stderrBytes: number; evidenceStep: string }
>;

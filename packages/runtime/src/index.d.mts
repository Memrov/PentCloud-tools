export declare const TOOL_TIMEOUT_MS: number;
export declare const TOOL_EXEC_TIMEOUT_MS: number;
export declare const TOOL_IDLE_TIMEOUT_MS: number;
export declare const TOOL_MCP_TIMEOUT_MS: number;
export interface ToolCommand {
  argv: string[];
  stdin: string;
  timeoutMs: number;
  requiredFiles?: string[];
}
export interface PackLock {
  packId: string;
  packVersion: string;
  tools: readonly { tool: string; version: string }[];
  execution?: { timeoutMs: number; execTimeoutMs: number; synchronous: boolean };
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
  inputHashes?: Record<string, string>;
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
    config: { retries: { limit: 0; delay: "1 second" }; timeout: "20 minutes" },
    callback: () => Promise<ReadableStream<Uint8Array>>,
  ): Promise<ReadableStream<Uint8Array>>;
}
export declare function runWorkflowStep<I>(
  step: StreamStep,
  runner: {
    run(input: I, files?: Record<string, Uint8Array>): Promise<ToolResult>;
  },
  input: I,
  files?: Record<string, Uint8Array>,
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

export declare function prepareFiles(
  required: string[],
  files?: Record<string, Uint8Array>,
): Promise<Record<string, { base64: string; sha256: string }>>;

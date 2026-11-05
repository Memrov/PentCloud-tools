export type ReconTool = "httpx" | "dnsx" | "katana" | "subfinder";
export interface ReconRequest {
  tool: ReconTool;
  target: string;
}
export interface ReconCommand {
  argv: string[];
  stdin: string;
  timeoutMs: number;
}
export interface ReconResult {
  tool: ReconTool;
  toolVersion: string;
  packVersion: string;
  image: string;
  startedAt: string;
  finishedAt: string;
  argv: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  processMs: number;
  firstJSONMs: number;
  cpuUserMs?: number;
  cpuSystemMs?: number;
  maxRSSKiB?: number;
  error?: string;
}
export declare const packVersion: string;
export declare const tools: readonly Readonly<{
  tool: ReconTool;
  version: string;
}>[];
export declare function buildCommand(request: ReconRequest): ReconCommand;

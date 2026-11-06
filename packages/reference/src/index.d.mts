import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = { tool: "searchsploit"; query: string };
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

export declare function fetchReference(
  path: string,
  fetcher?: typeof fetch,
): Promise<{
  path: string;
  revision: string;
  sha256: string;
  bytes: Uint8Array;
}>;

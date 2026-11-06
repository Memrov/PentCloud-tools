import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = {
  tool: "tshark";
  view?: "summary" | "http" | "dns" | "tcp";
};
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

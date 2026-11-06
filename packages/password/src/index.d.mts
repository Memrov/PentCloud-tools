import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = {
  tool: "hashcat";
  view?: "identify" | "sha256-dictionary";
};
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

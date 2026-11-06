import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = {
  tool: "nuclei";
  target: string;
  profile?: "exposures";
};
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

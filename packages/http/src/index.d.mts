import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = { tool: "ffuf" | "curl" | "openssl"; target: string };
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

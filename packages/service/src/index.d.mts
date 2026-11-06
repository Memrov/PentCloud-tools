import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest =
  | { tool: "nmap" | "naabu"; target: string; ports: number[] }
  | {
      tool: "masscan";
      target: string;
      ports: number[];
      adapter?: string;
      routerMac?: string;
    };
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

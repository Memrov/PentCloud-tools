import type { ToolCommand, PackLock } from "@memrov2/pentcloud-tool-runtime";
export type PackRequest = {
  tool: "sqlmap";
  target: string;
  parameter: string;
  database?: "sqlite" | "mysql" | "postgresql" | "mssql";
};
export declare const lock: PackLock;
export declare function buildCommand(input: PackRequest): ToolCommand;

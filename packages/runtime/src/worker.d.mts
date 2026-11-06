import { DurableObject } from "cloudflare:workers";
import type { ToolCommand, ToolResult, PackLock } from "./index.mjs";
declare class ToolRunner<I> extends DurableObject {
  ready(): Promise<{ image: string; instance: "lite" | "standard-1"; readyMs: number }>;
  run(input: I, files?: Record<string, Uint8Array>): Promise<ToolResult>;
  retire(): Promise<{ stopped: boolean; retired: true }>;
  stop(): Promise<{ stopped: boolean }>;
  capabilities(): Promise<{
    platform: string;
    architecture: string;
    rawPacketSocket: boolean;
    rawPacketError?: string;
    image: string;
    readyMs: number;
  }>;
}
export declare function createRunner<I>(
  lock: PackLock,
  buildCommand: (input: I) => ToolCommand,
): new (ctx: DurableObjectState, env: unknown) => ToolRunner<I>;

import { DurableObject } from "cloudflare:workers";
import type { ToolCommand, ToolResult, PackLock } from "./index.mjs";
declare class ToolRunner<I> extends DurableObject {
  run(input: I, files?: Record<string, Uint8Array>): Promise<ToolResult>;
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

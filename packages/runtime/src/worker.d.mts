import { DurableObject } from "cloudflare:workers";
import type { ToolCommand, ToolResult, PackLock } from "./index.mjs";
declare class ToolRunner<I> extends DurableObject {
  run(input: I): Promise<ToolResult>;
  stop(): Promise<{ stopped: boolean }>;
}
export declare function createRunner<I>(
  lock: PackLock,
  buildCommand: (input: I) => ToolCommand,
): new (ctx: DurableObjectState, env: unknown) => ToolRunner<I>;

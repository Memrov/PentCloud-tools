import { DurableObject } from "cloudflare:workers";
import type { ToolResult } from "@memrov2/pentcloud-tool-runtime";
import type { PackRequest } from "./index.mjs";
export declare class NucleiRunner extends DurableObject {
  ready(): Promise<{ image: string; instance: "lite"; readyMs: number }>;
  run(input: PackRequest): Promise<ToolResult>;
  retire(): Promise<{ stopped: boolean; retired: true }>;
  stop(): Promise<{ stopped: boolean }>;
}

import { DurableObject } from "cloudflare:workers";
import type { ToolResult } from "@memrov2/pentcloud-tool-runtime";
import type { PackRequest } from "./index.mjs";
export declare class HttpRunner extends DurableObject {
  run(input: PackRequest): Promise<ToolResult>;
  stop(): Promise<{ stopped: boolean }>;
}

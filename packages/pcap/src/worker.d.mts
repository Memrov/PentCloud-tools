import { DurableObject } from "cloudflare:workers";
import type { ToolResult } from "@memrov2/pentcloud-tool-runtime";
import type { PackRequest } from "./index.mjs";
export declare class PcapRunner extends DurableObject {
  run(input: PackRequest, files: { input: Uint8Array }): Promise<ToolResult>;
  stop(): Promise<{ stopped: boolean }>;
  capabilities(): Promise<{
    platform: string;
    architecture: string;
    rawPacketSocket: boolean;
  }>;
}

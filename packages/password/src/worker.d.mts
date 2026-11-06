import { DurableObject } from "cloudflare:workers";
import type { ToolResult } from "@memrov2/pentcloud-tool-runtime";
import type { PackRequest } from "./index.mjs";
export declare class PasswordRunner extends DurableObject {
  ready(): Promise<{ image: string; instance: "standard-1"; readyMs: number }>;
  run(
    input: PackRequest,
    files: { input: Uint8Array; dictionary?: Uint8Array },
  ): Promise<ToolResult>;
  retire(): Promise<{ stopped: boolean; retired: true }>;
  stop(): Promise<{ stopped: boolean }>;
  capabilities(): Promise<{
    platform: string;
    architecture: string;
    rawPacketSocket: boolean;
  }>;
}

import { DurableObject } from "cloudflare:workers";
import type { ToolResult } from "@memrov2/pentcloud-tool-runtime";
import type { PackRequest } from "./index.mjs";
export declare class ReferenceRunner extends DurableObject {
  run(input: PackRequest): Promise<ToolResult>;
  stop(): Promise<{ stopped: boolean }>;
  readSource(
    path: string,
  ): Promise<{
    path: string;
    revision: string;
    sha256: string;
    bytes: Uint8Array;
  }>;
  capabilities(): Promise<{
    platform: string;
    architecture: string;
    rawPacketSocket: boolean;
  }>;
}

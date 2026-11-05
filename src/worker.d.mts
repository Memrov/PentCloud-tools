import { DurableObject } from "cloudflare:workers";
import type { ReconRequest, ReconResult } from "./index.mjs";
export declare class ReconRunner extends DurableObject {
  run(request: ReconRequest): Promise<ReconResult & { readyMs: number }>;
  stop(): Promise<{ stopped: boolean }>;
}

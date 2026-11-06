import { DurableObject } from "cloudflare:workers";
import type { ReconRequest, ReconResult } from "./index.mjs";
export declare class ReconRunner extends DurableObject {
  ready(): Promise<{ image: string; instance: "standard-1"; readyMs: number }>;
  run(request: ReconRequest): Promise<ReconResult & { readyMs: number }>;
  retire(): Promise<{ stopped: boolean; retired: true }>;
  stop(): Promise<{ stopped: boolean }>;
}

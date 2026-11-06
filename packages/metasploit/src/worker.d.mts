import { DurableObject } from "cloudflare:workers";
export declare class MetasploitRunner extends DurableObject {
  ready(): Promise<{ image: string; instance: "standard-2" }>;
  fetch(request: Request): Promise<Response>;
  retire(): Promise<{ stopped: boolean; retired: true }>;
  stop(): Promise<{ stopped: boolean }>;
}

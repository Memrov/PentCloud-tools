import { DurableObject } from "cloudflare:workers";
export declare class MetasploitRunner extends DurableObject {
  fetch(request: Request): Promise<Response>;
  stop(): Promise<{ stopped: boolean }>;
}

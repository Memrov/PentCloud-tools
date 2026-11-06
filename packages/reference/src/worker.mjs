import { createRunner } from "@memrov2/pentcloud-tool-runtime/worker";
import { lock, buildCommand, fetchReference } from "./index.mjs";
const Runtime = createRunner(lock, buildCommand);
export class ReferenceRunner extends Runtime {
  async readSource(path) {
    if(await this.ctx.storage.get("retired"))throw new Error("Owned tool runtime is retired");
    return fetchReference(path);
  }
}

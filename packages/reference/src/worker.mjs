import { createRunner } from "@memrov2/pentcloud-tool-runtime/worker";
import { lock, buildCommand, fetchReference } from "./index.mjs";
const Runtime = createRunner(lock, buildCommand);
export class ReferenceRunner extends Runtime {
  readSource(path) {
    return fetchReference(path);
  }
}

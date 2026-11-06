import { createRunner } from "@memrov2/pentcloud-tool-runtime/worker";
import { lock, buildCommand } from "./index.mjs";
export const SqlmapRunner = createRunner(lock, buildCommand);

import { createRunner } from "@memrov2/pentcloud-tool-runtime/worker";
import { lock, buildCommand } from "./index.mjs";
export const ServiceRunner = createRunner(lock, buildCommand);

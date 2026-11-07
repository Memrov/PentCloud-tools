import { createRunner } from "@memrov2/pentcloud-tool-runtime/worker";
import { buildCommand } from "./index.mjs";
import lock from "../tools.lock.json" with { type: "json" };
export class ReconRunner extends createRunner(lock, buildCommand) {}

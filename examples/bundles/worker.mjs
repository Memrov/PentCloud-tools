import { WorkflowEntrypoint } from "cloudflare:workers";
import { runWorkflowStep } from "@memrov2/pentcloud-tool-runtime";
export { HttpRunner } from "@memrov2/pentcloud-http/worker";
export { NucleiRunner } from "@memrov2/pentcloud-nuclei/worker";
export { SqlmapRunner } from "@memrov2/pentcloud-sqlmap/worker";

export class ToolWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const { pack, request } = event.payload;
    if (!["http", "nuclei", "sqlmap"].includes(pack))
      throw new TypeError("Unsupported pack");
    const runner = this.env[pack.toUpperCase()].getByName(event.instanceId);
    try {
      // Persist the returned evidence in your existing private assessment store.
      // Timeouts/unknown outcomes need reconciliation, not an automatic rescan.
      return {
        ...(await runWorkflowStep(step, runner, request)),
        instanceId: event.instanceId,
      };
    } finally {
      await step.do("stop", () => runner.stop());
    }
  }
}

export default {
  fetch() {
    return new Response("Use the authenticated Workflows API", { status: 404 });
  },
};

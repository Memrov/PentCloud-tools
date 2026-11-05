import { WorkflowEntrypoint } from "cloudflare:workers";
export { ReconRunner } from "@memrov2/pentcloud-recon/worker";

// Start through the authenticated Cloudflare Workflows API, not a public scan endpoint.
export class ReconWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const runner = this.env.RECON.getByName(event.instanceId);
    try {
      return await step.do(
        "recon",
        { retries: { limit: 0, delay: "1 second" }, timeout: "3 minutes" },
        () => runner.run(event.payload),
      );
    } finally {
      await step.do(
        "stop",
        { retries: { limit: 1, delay: "1 second" }, timeout: "30 seconds" },
        () => runner.stop(),
      );
    }
  }
}
export default {
  async fetch() {
    return new Response("Use the authenticated Workflows API", { status: 404 });
  },
};

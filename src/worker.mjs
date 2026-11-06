import { DurableObject } from "cloudflare:workers";
import { buildCommand, packVersion, tools } from "./index.mjs";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const decode = (data) => new TextDecoder().decode(data);
async function exec(
  container,
  argv,
  body,
  signal = AbortSignal.timeout(90000),
) {
  const process = await container.exec(argv, {
    signal,
    ...(body ? { stdin: new Blob([body]).stream() } : {}),
  });
  const result = await process.output();
  return {
    exitCode: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}
/** One identity per assessment run. Only trusted Worker/Workflow bindings call this object. */
export class ReconRunner extends DurableObject {
  #queue = Promise.resolve();
  #serialize(action) {
    const result = this.#queue.then(action);
    this.#queue = result.catch(() => {});
    return result;
  }
  async #ready() {
      if (await this.ctx.storage.get("retired")) throw new Error("Owned tool runtime is retired");
    const container = this.ctx.container,
      image = container.images.recon,
      start = Date.now();
    if (!image) throw new Error("Configure the recon named image");
    if (container.running) {
      const info = await container.inspect();
      if (info?.image && info.image !== image)
        throw new Error(
          "Recon image changed; finish this run and stop its runtime before upgrading",
        );
    } else
      container.start({
        image,
        instance: "standard-1",
        enableInternet: true,
        labels: { pack: "recon", version: packVersion },
      });
    await container.setInactivityTimeout(120000);
    const deadline = AbortSignal.timeout(90000);
    let ready = false;
    while (Date.now() - start < 90000 && !deadline.aborted) {
      try {
        if (
          (await exec(container, ["/bin/true"], undefined, deadline))
            .exitCode === 0
        ) {
          ready = true;
          break;
        }
      } catch {}
      if (!deadline.aborted)
        await wait(Math.min(1000, Math.max(0, 90000 - (Date.now() - start))));
    }
    if (!ready)
      throw new Error("Recon container did not become ready within 90 seconds");
    const marker = await exec(
      container,
      ["/bin/cat", "/opt/pentcloud-recon/pack.json"],
      undefined,
      deadline,
    );
    if (marker.exitCode !== 0)
      throw new Error("Recon image is missing its release manifest");
    let release;
    try {
      release = JSON.parse(marker.stdout);
    } catch {
      throw new Error("Invalid recon image release manifest");
    }
    if (
      release.packVersion !== packVersion ||
      tools.some(
        (t) =>
          !release.tools?.some(
            (v) => v.tool === t.tool && v.version === t.version,
          ),
      )
    )
      throw new Error("Recon image and SDK versions do not match");
    const info = await container.inspect();
    if (info?.image !== image)
      throw new Error("Unable to verify recon image identity");
    return { image, instance: "standard-1", readyMs: Date.now() - start };
  }
  ready() {
    return this.#serialize(() => this.#ready());
  }
  run(input) {
    const command = buildCommand(input);
    return this.#serialize(async () => {
      const startedAt = new Date().toISOString(),
        ready = await this.#ready();
      const output = await exec(
        this.ctx.container,
        ["/opt/pentcloud-recon/bin/recon-exec"],
        JSON.stringify(command),
      );
      if (output.exitCode !== 0)
        throw new Error("Recon execution helper failed");
      let result;
      try {
        result = JSON.parse(output.stdout);
      } catch {
        throw new Error("Invalid recon execution response");
      }
      if (
        !Number.isInteger(result.exitCode) ||
        typeof result.stdout !== "string" ||
        typeof result.stderr !== "string" ||
        typeof result.timedOut !== "boolean" ||
        typeof result.truncated !== "boolean"
      )
        throw new Error("Incomplete recon execution response");
      return {
        ...result,
        ...ready,
        tool: input.tool,
        toolVersion: tools.find((t) => t.tool === input.tool).version,
        packVersion,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    });
  }
  retire() {
    return this.#serialize(async () => {
      await this.ctx.storage.put("retired", true);
      if (this.ctx.container.running) await this.ctx.container.destroy();
      return { stopped: !this.ctx.container.running, retired: true };
    });
  }
  stop() {
    return this.#serialize(async () => {
      if (this.ctx.container.running) await this.ctx.container.destroy();
      return { stopped: !this.ctx.container.running };
    });
  }
}

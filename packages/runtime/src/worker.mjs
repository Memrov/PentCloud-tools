import { DurableObject } from "cloudflare:workers";
import { prepareFiles } from "./index.mjs";
import { execOutput } from "./exec.mjs";
const decode = (data) => new TextDecoder().decode(data);
const hash = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
async function exec(container, argv, body, timeoutMs) {
  const result = await execOutput(container, argv, {
    timeoutMs,
    ...(body ? { stdin: new Blob([body]).stream() } : {}),
  });
  return {
    exitCode: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}
export function createRunner(lock, buildCommand) {
  const root = "/opt/pentcloud-" + lock.packId;
  return class ToolRunner extends DurableObject {
    #queue = Promise.resolve();
    #serialize(action) {
      const result = this.#queue.then(action);
      this.#queue = result.catch(() => {});
      return result;
    }
    async #ready() {
      if (await this.ctx.storage.get("retired")) throw new Error("Owned tool runtime is retired");
      const container = this.ctx.container,
        image = container.images[lock.packId],
        start = Date.now();
      if (!image)
        throw new Error("Configure the " + lock.packId + " named image");
      if (container.running) {
        if ((await container.inspect())?.image !== image)
          throw new Error(
            "Image changed; stop the current runtime before upgrading",
          );
      } else
        container.start({
          image,
          instance: lock.packId === "password" ? "standard-1" : "lite",
          enableInternet: lock.runtime?.enableInternet ?? true,
          labels: { pack: lock.packId, version: lock.packVersion },
        });
      await container.setInactivityTimeout(120000);
      const deadline = Date.now() + 90000;
      while (true) {
        try {
          if (
            (await exec(container, ["/bin/true"], undefined, Math.max(1,deadline-Date.now())))
              .exitCode === 0
          )
            break;
        } catch (error) {
          if (Date.now() >= deadline)
            throw new Error("Container readiness exceeded 90 seconds");
        }
        if (Date.now() >= deadline)
          throw new Error("Container readiness exceeded 90 seconds");
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000, 90000 - (Date.now() - start))),
        );
      }
      const marker = await exec(
        container,
        ["/bin/cat", root + "/pack.json"],
        undefined,
        Math.max(1,deadline-Date.now()),
      );
      let release;
      try {
        release = JSON.parse(marker.stdout);
      } catch {
        throw new Error("Invalid pack image manifest");
      }
      if (marker.exitCode !== 0 || release.lockSha256 !== (await hash(lock)))
        throw new Error("Pack image and SDK pins do not match");
      if ((await container.inspect())?.image !== image)
        throw new Error("Unable to verify pack image identity");
      return { image, instance: lock.packId === "password" ? "standard-1" : "lite", readyMs: Date.now() - start };
    }
    ready() {
      return this.#serialize(() => this.#ready());
    }
    run(input, files) {
      const { requiredFiles = [], ...command } = buildCommand(input),
        tool = input.tool;
      const prepared = prepareFiles(requiredFiles, files);
      prepared.catch(() => {});
      return this.#serialize(async () => {
        const attachments = await prepared;
        const startedAt = new Date().toISOString(),
          ready = await this.#ready();
        const output = await exec(
          this.ctx.container,
          [root + "/bin/pack-exec"],
          JSON.stringify({
            ...command,
            ...(Object.keys(attachments).length ? { files: attachments } : {}),
          }),
          90000,
        );
        if (output.exitCode !== 0)
          throw new Error("Pack execution helper failed");
        let result;
        try {
          result = JSON.parse(output.stdout);
        } catch {
          throw new Error("Invalid pack execution response");
        }
        if (
          !Number.isInteger(result.exitCode) ||
          typeof result.stdout !== "string" ||
          typeof result.stderr !== "string" ||
          typeof result.timedOut !== "boolean" ||
          typeof result.truncated !== "boolean"
        )
          throw new Error("Incomplete pack execution response");
        return {
          ...result,
          ...ready,
          tool,
          toolVersion: lock.tools.find((t) => t.tool === tool).version,
          packId: lock.packId,
          packVersion: lock.packVersion,
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
    capabilities() {
      return this.#serialize(async () => {
        const ready = await this.#ready();
        const result = await exec(
          this.ctx.container,
          [root + "/bin/pack-exec", "--capabilities"],
          undefined,
          10000,
        );
        if (result.exitCode !== 0) throw new Error("Capability probe failed");
        return { ...JSON.parse(result.stdout), ...ready };
      });
    }
  };
}

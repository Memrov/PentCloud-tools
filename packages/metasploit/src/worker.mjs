import { DurableObject } from "cloudflare:workers";
import { execOutput } from "@memrov2/pentcloud-tool-runtime/exec";
import { lock } from "./index.mjs";
const decode = (x) => new TextDecoder().decode(x);
const digest = async () =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(lock)),
      ),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
/** Private binding only. The upstream MCP server owns RPC processes and tools. */
export class MetasploitRunner extends DurableObject {
  #queue = Promise.resolve();
  #serial(action) {
    const result = this.#queue.then(action);
    this.#queue = result.catch(() => {});
    return result;
  }
  async #ready() {
      if (await this.ctx.storage.get("retired")) throw new Error("Owned tool runtime is retired");
    const c = this.ctx.container,
      image = c.images.metasploit;
    if (!image) throw new Error("Configure the metasploit named image");
    let token = await this.ctx.storage.get("mcp-token");
    if (!token) {
      if (c.running)
        throw new Error(
          "RPC authentication state missing; stop this owned runtime before restarting",
        );
      token = crypto.randomUUID() + crypto.randomUUID();
      await this.ctx.storage.put("mcp-token", token);
    }
    if (c.running) {
      if ((await c.inspect())?.image !== image)
        throw new Error(
          "Image changed; stop the current runtime before upgrading",
        );
    } else
      c.start({
        image,
        entrypoint: [
          "/usr/src/metasploit-framework/msfmcpd",
          "--mcp-transport",
          "http",
          "--enable-dangerous-actions",
        ],
        env: {
          MSF_MCP_HOST: "0.0.0.0",
          MSF_MCP_PORT: "3000",
          MSF_MCP_AUTH_TOKEN: token,
          MSF_API_TYPE: "messagepack",
          MSF_API_SSL: "false",
          MSF_AUTO_START_RPC: "true",
          MSF_MCP_WORKERS: "1",
          MSF_MCP_MIN_THREADS: "1",
          MSF_MCP_MAX_THREADS: "4",
        },
        instance: "standard-2",
        enableInternet: true,
        labels: { pack: "metasploit", version: lock.packVersion },
      });
    await c.setInactivityTimeout(240000);
    const deadline = Date.now() + 180000;
    let verified = false;
    while (Date.now() < deadline) {
      try {
        if (!verified) {
          const r = await execOutput(c,
            ["/bin/cat", "/opt/pentcloud-metasploit/pack.json"],
            { timeoutMs: 5000 },
          );
          if (
            r.exitCode !== 0 ||
            JSON.parse(decode(r.stdout)).lockSha256 !== (await digest())
          )
            throw new Error("Pack image and SDK pins do not match");
          verified = true;
        }
        const r = await c
          .getTcpPort(3000)
          .fetch("http://localhost:3000/", {
            headers: {
              Authorization: "Bearer " + token,
              Accept: "application/json, text/event-stream",
            },
            signal: AbortSignal.timeout(5000),
          });
        await r.body?.cancel();
        if ([200, 400, 405, 406].includes(r.status)) {await c.setInactivityTimeout(120000);return token;}
        if (r.status === 401)
          throw new Error("Internal MCP authentication failed");
      } catch (error) {
        if (/pins do not match|authentication/.test(error.message)) throw error;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      "Official Metasploit MCP server did not become ready within 180 seconds",
    );
  }
  ready() {
    return this.#serial(async () => {
      await this.#ready();
      return { image: this.ctx.container.images.metasploit, instance: "standard-2" };
    });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (
      !["/", "/mcp"].includes(url.pathname) ||
      url.search ||
      !["GET", "POST", "DELETE"].includes(request.method)
    )
      return new Response("Unsupported MCP request", { status: 400 });
    const token = await this.#serial(() => this.#ready());
    const headers = new Headers(request.headers);
    headers.set("Authorization", "Bearer " + token);
    headers.delete("Cookie");
    headers.delete("Host");
    return this.ctx.container
      .getTcpPort(3000)
      .fetch(
        new Request("http://localhost:3000/", {
          method: request.method,
          headers,
          body: request.method === "GET" ? undefined : request.body,
          duplex: "half",
        }),
      );
  }
  retire() {
    return this.#serial(async () => {
      await this.ctx.storage.put("retired", true);
      if (this.ctx.container.running) await this.ctx.container.destroy();
      await this.ctx.storage.delete("mcp-token");
      return { stopped: !this.ctx.container.running, retired: true };
    });
  }
  stop() {
    return this.#serial(async () => {
      if (this.ctx.container.running) await this.ctx.container.destroy();
      await this.ctx.storage.delete("mcp-token");
      return { stopped: !this.ctx.container.running };
    });
  }
}

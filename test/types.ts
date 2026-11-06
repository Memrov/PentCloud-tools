import {
  buildCommand,
  type ReconRequest,
  type ReconResult,
} from "@memrov2/pentcloud-recon";
import type { ReconRunner } from "@memrov2/pentcloud-recon/worker";
const request: ReconRequest = { tool: "httpx", target: "https://example.com/" };
buildCommand(request);
async function call(
  namespace: DurableObjectNamespace<ReconRunner>,
): Promise<ReconResult> {
  return namespace.getByName("assessment-run-id").run(request);
}
void call;
// @ts-expect-error unsupported tool is rejected for typed consumers
buildCommand({ tool: "sh", target: "example.com" });
import { buildCommand as httpCommand } from "@memrov2/pentcloud-http";
import { buildCommand as nucleiCommand } from "@memrov2/pentcloud-nuclei";
import { buildCommand as sqlCommand } from "@memrov2/pentcloud-sqlmap";
import type { HttpRunner } from "@memrov2/pentcloud-http/worker";
import type { NucleiRunner } from "@memrov2/pentcloud-nuclei/worker";
import type { SqlmapRunner } from "@memrov2/pentcloud-sqlmap/worker";
httpCommand({ tool: "curl", target: "https://example.com/" });
nucleiCommand({
  tool: "nuclei",
  target: "https://example.com/",
  profile: "exposures",
});
sqlCommand({
  tool: "sqlmap",
  target: "https://example.com/?id=1",
  parameter: "id",
  database: "sqlite",
});
async function packs(
  a: DurableObjectNamespace<HttpRunner>,
  b: DurableObjectNamespace<NucleiRunner>,
  c: DurableObjectNamespace<SqlmapRunner>,
) {
  return Promise.all([
    a.getByName("run").run({ tool: "curl", target: "https://example.com/" }),
    b.getByName("run").run({ tool: "nuclei", target: "https://example.com/" }),
    c.getByName("run").run({
      tool: "sqlmap",
      target: "https://example.com/?id=1",
      parameter: "id",
    }),
  ]);
}
void packs;
nucleiCommand({
  tool: "nuclei",
  target: "https://example.com/",
  // @ts-expect-error no arbitrary Nuclei templates
  profile: "arbitrary",
});
httpCommand({
  tool: "curl",
  target: "https://example.com/",
  // @ts-expect-error no arbitrary shell/flags
  args: ["--proxy", "x"],
});
import type { WorkflowStep } from "cloudflare:workers";
import { runWorkflowStep } from "@memrov2/pentcloud-tool-runtime";
async function streamedStep(step: WorkflowStep, runner: HttpRunner) {
  return runWorkflowStep(step, runner, {
    tool: "curl" as const,
    target: "https://example.com/",
  });
}
void streamedStep;

import type { ServiceRunner } from "@memrov2/pentcloud-service/worker";
import type { WebContextRunner } from "@memrov2/pentcloud-web-context/worker";
import type { PcapRunner } from "@memrov2/pentcloud-pcap/worker";
import type { FileRunner } from "@memrov2/pentcloud-file-analysis/worker";
import type { PasswordRunner } from "@memrov2/pentcloud-password/worker";
import type { ReferenceRunner } from "@memrov2/pentcloud-reference/worker";
import type { MetasploitRunner } from "@memrov2/pentcloud-metasploit/worker";
import { buildCommand as serviceCommand } from "@memrov2/pentcloud-service";
serviceCommand({
  tool: "masscan",
  target: "192.0.2.1",
  ports: [443],
  adapter: "eth0",
  routerMac: "00:11:22:33:44:55",
});
async function remaining(
  step: WorkflowStep,
  service: ServiceRunner,
  web: WebContextRunner,
  pcap: PcapRunner,
  file: FileRunner,
  password: PasswordRunner,
  reference: ReferenceRunner,
  msf: MetasploitRunner,
) {
  const input = new Uint8Array([1]);
  await service.run({ tool: "nmap", target: "192.0.2.1", ports: [443] });
  await web.run({ tool: "whatweb", target: "https://example.com/" });
  await runWorkflowStep(step, pcap, { tool: "tshark" as const }, { input });
  await file.run({ tool: "binwalk", view: "entropy" }, { input });
  await password.run(
    { tool: "hashcat", view: "sha256-dictionary" },
    { input, dictionary: input },
  );
  const source = await reference.readSource(
    "exploits/multiple/webapps/50383.sh",
  );
  const bytes: Uint8Array = source.bytes;
  await msf.fetch(new Request("http://internal/mcp"));
  // @ts-expect-error capture bytes are required
  await pcap.run({ tool: "tshark" });
  return bytes;
}
void remaining;

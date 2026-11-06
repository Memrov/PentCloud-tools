# PentCloud tools

Small, versioned tool runtimes for Cloudflare. The first package, **`@memrov2/pentcloud-recon`**, runs the original httpx, dnsx, Katana and Subfinder binaries together in one lightweight Linux container.

Each tool is callable separately. Cloudflare Workflows can orchestrate the calls, or an agent harness can call the same Durable Object binding. This repository does not deploy or modify the PentCloud application.

| Included tool | Pinned release | First-release behavior |
| --- | --- | --- |
| httpx | v1.12.0 | HTTP status, title, server and technology signals |
| dnsx | v1.3.1 | A and AAAA resolution |
| Katana | v1.8.0 | Depth-two crawl within the starting URL prefix |
| Subfinder | v2.17.0 | Passive certificate discovery using `crtname` |

## Call a tool

Install the pinned npm release in your Worker project. Release tarballs and the source checkout support the same imports.

```sh
npm install @memrov2/pentcloud-recon@0.1.0
```

```js
// Export the Durable Object from your Worker's entry point.
export { ReconRunner } from '@memrov2/pentcloud-recon/worker';

// Use a separate Durable Object identity for each assessment run.
const runner = env.RECON.getByName(runId);
try {
  const result = await runner.run({
    tool: 'httpx',
    target: 'https://your-authorized-target.example/'
  });
  // Save this result to your existing run/evidence store.
} finally {
  await runner.stop();
}
```

`httpx` and `katana` accept an absolute HTTP(S) URL. `dnsx` and `subfinder` accept a hostname. The first release accepts exactly `tool` and `target`; additional flags and arbitrary commands are rejected. URLs with embedded login credentials are rejected. JSON stdout, stderr, exit code, timeout/truncation state, execution timing, image identity and tool/pack versions are returned without flattening upstream records.

Calls on one identity are serialized. The default allocation is one vCPU, 512 MiB memory and 2,000 MB disk. An unused runtime shuts down after 120 seconds; explicitly stop it when the run ends. These limits were tested for serial execution, not parallel processes within the same container.

## Build and deploy in your account

Requirements: Node.js 22 or later, npm, Python 3, Go **1.26.5**, Cloudflare Workers Paid with Containers access, and native Cloudflare CLI authentication. The included example uses the same Wrangler **4.157.0** deployment tooling as the tested runtime. Building the Dockerfile also requires a running Docker-compatible engine capable of building Linux/amd64 images.

```sh
npm ci
npm test
npm run test:runner
npm run test:image
npm run typecheck
npm run image:prepare
npx wrangler login
npx wrangler deploy --config examples/cloudflare/wrangler.jsonc
```

The prepare step downloads four upstream release archives, verifies archive and executable SHA-256 values, copies their license files, and builds the small static execution helper. Tool installation and compilation happen at build time, never during an assessment.

The example has no public execution endpoint, workers.dev exposure or preview URL. Start `ReconWorkflow` through Cloudflare's authenticated Workflows API with a payload such as:

```json
{"tool":"dnsx","target":"your-authorized-target.example"}
```

For multiple calls within one assessment, reuse that run's Durable Object identity and stop it after the last call. The example Workflow performs one tool call and then stops its runtime. Adapt evidence persistence to your application's existing store; this package does not add a database or exporter.

For a build without Docker, install **regctl v0.9.0** and run `npm run image:build`. This creates the OCI layout in `.cache/image` and records its digest in `.cache/image-release.json`. Copy the image into your Cloudflare-managed registry using your authenticated registry tooling. Configure the resulting account-local digest as the `recon` named image. Cloudflare's native registry and deployment commands are documented below.

## Versions and upgrades

Version `0.1.0` identifies the recon pack and its SDK contract. `tools.lock.json` records each upstream version, archive checksum, binary checksum and the base image digest. Updating one tool preserves the other pins and produces a new pack/image release. This repository does not fork the upstream tools.

Pin the npm package and container image digest together. The runner checks the image's release manifest before executing commands and rejects a mismatched running image. Finish active runs before upgrading their SDK/image pair; retain prior images and matching adapters for retries and rollback. Publishing a package does not deploy it to customer accounts or replace a running container.

To prepare a release: update the package/lock versions together, run the tests and Cloudflare smoke check, build the image, inspect `npm pack --dry-run`, and attach the verified npm tarball, image archive and SHA-256 checksums to the release. Authentication belongs in native CLI login or a secret store, never source files. No GitHub Actions are configured.

## Limits and safety

Only test targets you are authorized to assess. Argument validation and Katana's URL-prefix filter are **not network-level scope enforcement**. DNS resolution, redirects, tool behavior and future capabilities require their own assessment. This package does not claim to restrict every possible destination.

HTTP/crawl concurrency is one, with a two-request-per-second tool limit; Subfinder uses one request per second. Each command has a 75-second process deadline, with two MiB captured per output stream. Deadline/output cancellation kills the process group. Nonzero command exits remain visible in the returned result and are not automatically retried by the example Workflow.

Do not send model keys or unrelated account credentials to this runtime. The execution helper passes a minimal environment to the tools. Treat stdout/stderr as potentially sensitive assessment evidence; store them privately, keep runs separated, and apply your own deletion policy. Browser login, provider API credentials and additional tool options are outside this first release.

The runtime supports Linux/amd64 on Cloudflare Containers. It does not make these binaries executable inside the Workers JavaScript isolate. Other Kali tools have not been ported or certified by this release.

## References

- [Cloudflare native Container API](https://developers.cloudflare.com/containers/api/durable-object-container/)
- [Image management and registry](https://developers.cloudflare.com/containers/guides/image-management/)
- [Workflows](https://developers.cloudflare.com/workflows/)
- [ProjectDiscovery tools](https://github.com/projectdiscovery)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

MIT license for the PentCloud adapter. Included executables and base-image packages retain their upstream licenses.

## Tool-pack inventory and quality

See [tool packs and agent capabilities](docs/tool-packs.md) for the current Kali interface inventory, the needs of each agent, and the proposed next bundles. Candidate tools are clearly separated from released support.

Run `npm run coverage` after the development setup in [testing and coverage](docs/testing.md). Reports use standard Node LCOV, Go coverprofile and Python Cobertura formats. Codecov configuration is included; service authentication and CI selection must be completed before its checks are active.

Ten additional candidate workspaces cover [HTTP, Nuclei and SQLmap](docs/bundles.md) and [the remaining tool families](docs/remaining-bundles.md). Each has its own pinned image and bounded interface. Browser automation stays with managed Browser Run. Recon remains the only published release; these candidates do not replace every Kali operation.

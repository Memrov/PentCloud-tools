# Additional tool bundles

These three **0.1.0 SDKs** ([additional families](remaining-bundles.md)) use the same native Cloudflare Container approach as the released recon pack. They are separate images and independently versioned npm workspaces. A small shared runtime handles serialization, image/SDK pin verification and shutdown. They do not replace Kali or change PentCloud's production routing.

| Workspace | Tools | Initial interface |
| --- | --- | --- |
| `@memrov2/pentcloud-http` | FFUF 2.3.0, curl 8.23.0, OpenSSL 3.5.9 | Twelve-path discovery with automatic baseline calibration, one HTTP request with headers, or certificate-verified TLS inspection |
| `@memrov2/pentcloud-nuclei` | Nuclei 3.11.1 | Three pinned upstream exposure templates: Git config, Laravel environment and DS_Store |
| `@memrov2/pentcloud-sqlmap` | SQLmap 1.10 and Python 3.12 | Boolean/error-based tests against one explicitly selected existing GET parameter; optional database hint |

The Nuclei template revision and individual hashes are pinned separately from its engine. Only the HTTP protocol and the packaged signed templates are enabled. Headless, code, external templates, automatic updates and Interactsh are excluded from this interface. This is a small profile, not all Nuclei coverage.

SQLmap uses risk 1, level 1, one thread and a half-second delay. It does not request dumps, operating-system access, file writes, UNION or time-based testing. Those are interface limits, not a guarantee that every input test is harmless. Its original source and GPL license are preserved in the image.

## Call the adapters

```js
export { HttpRunner } from '@memrov2/pentcloud-http/worker';
export { NucleiRunner } from '@memrov2/pentcloud-nuclei/worker';
export { SqlmapRunner } from '@memrov2/pentcloud-sqlmap/worker';

const http = env.HTTP.getByName(runId);
const templates = env.NUCLEI.getByName(runId);
const sql = env.SQLMAP.getByName(runId);
try {
  const discovery = await http.run({tool: 'ffuf', target: 'https://your-authorized-target.example/app/'});
  const response = await http.run({tool: 'curl', target: 'https://your-authorized-target.example/api/'});
  const tls = await http.run({tool: 'openssl', target: 'https://your-authorized-target.example/'});
  const exposures = await templates.run({tool: 'nuclei', target: 'https://your-authorized-target.example/app/', profile: 'exposures'});
  const injection = await sql.run({tool: 'sqlmap', target: 'https://your-authorized-target.example/item?id=1', parameter: 'id', database: 'sqlite'});
  // Persist every result, including failures and incomplete attempts.
} finally {
  await Promise.all([http.stop(), templates.stop(), sql.stop()]);
}
```

All requests reject additional fields, arbitrary flags, URL credentials, fragments and multiple whitespace-separated targets. Discovery requires a directory URL ending in `/`; Nuclei requires a base URL without query parameters. TLS inspection currently accepts an HTTPS origin on port 443. SQLmap requires exactly one occurrence of the selected parameter. Native header aliases such as `host`, `referer`, `user-agent` and `cookie` are rejected because upstream can treat them as header tests even with a GET parameter filter. Its database hints are `sqlite`, `mysql`, `postgresql` and `mssql`.

Results retain raw stdout/stderr, exit status, timeout/output-limit state, image identity, pack/tool versions and timings. A nonzero exit or timeout is not an empty successful assessment. SQLmap can also exit zero after reporting access denial: inspect its diagnostic output before deciding whether a target was covered. Curl includes HTTP response headers and does not treat an HTTP 404 as a transport failure. Parse the status line when assessing the response.

No adapter follows HTTP redirects automatically. The wrappers do **not** implement complete network scope enforcement or engagement-wide request budgeting. DNS, embedded upstream behavior and concurrent packs remain separate concerns. The adapters currently accept no login/header secret references; authenticated application integration must reuse PentCloud's existing secret resolution before a Kali path is replaced.

## Build images

From this checkout, use the existing Node.js, Go 1.26.5 and Python build requirements. Additional images contain their own pinned curl/OpenSSL/Python dependencies; they are not installed on the operator's system. No runtime dependency was removed from recon.

```sh
npm ci
npm test
npm run test:runner
npm run test:image
npm run typecheck

# Requires regctl 0.9.0 on PATH; no Docker daemon required.
npm run image:pack:build -- http
npm run image:pack:build -- nuclei
npm run image:pack:build -- sqlmap

npm pack --workspaces --pack-destination .cache
```

Each build verifies upstream archives, executable hashes and selected assets before constructing a deterministic layer. It preserves upstream notices and records the helper and full lock hashes in the image. Re-running a build produces the same image digest. Downloads happen at build time, never during an assessment.

Images and release metadata remain in `.cache/packs/<pack>/`. Copy the OCI image to your account's native Cloudflare registry using authenticated registry tooling, and configure the corresponding named image (`http`, `nuclei` or `sqlmap`) on its Durable Object. The [example configuration](../examples/bundles/wrangler.jsonc) can also build the prepared contents with a Docker-compatible engine. The example has no public execution endpoint and runs through the authenticated Workflows API. It uses [native streamed step results](https://developers.cloudflare.com/workflows/build/rules-of-workflows/#keep-non-stream-step-return-values-under-1-mib) for full evidence and returns a compact completion summary. Streamed evidence is subject to Workflow retention; persist it to the existing private assessment store when integrating with PentCloud. It is not a permanent report archive.

Each command has a 75-second execution deadline and a two-MiB limit per output stream. Runtimes are serialized per identity, stop after 120 seconds of inactivity, and support explicit shutdown. HTTP and SQLmap use one vCPU/512 MiB; Nuclei uses one vCPU/1,024 MiB. The allocation is not a guarantee for larger future workloads.

SQLmap's temporary sessions stay inside that run's isolated runtime and are flushed before a new test. Stdout/stderr are returned; arbitrary filesystem browsing, session export and resume across destroyed containers are not part of this candidate interface. Persist returned evidence before stopping the runtime. The offline candidates now support bounded input attachments; SQLmap session export/resume remains outside this interface.

## Verification

Local tests cover command validation, fixed profiles, queue recovery, manifest mismatch, archive checksum/path handling, large streamed evidence and process ownership. The native Cloudflare smoke used packed SDKs, their exact images and owned positive/negative fixtures.

| Candidate | Observed result | Compressed image | First container readiness |
| --- | --- | ---: | ---: |
| HTTP | Four planted paths discovered; zero matches on the empty fixture; HTTP and certificate-verified TLS succeeded | 12.5 MiB | 2.53 seconds |
| Nuclei | Planted Git config exposure detected; zero findings on the safe fixture | 49.7 MiB | 4.92 seconds |
| SQLmap | Planted SQLite boolean injection confirmed; parameterized safe endpoint did not test injectable | 26.1 MiB | 2.96 seconds |

These are single controlled samples, not accuracy or performance benchmarks against other products. FFUF's positive scan took 6.1 seconds, Nuclei's 12.5 seconds, and the warm SQLmap detection 12.2 seconds. Startup readiness excludes command execution.

The public fixture returned HTTP 403 to SQLmap. Its positive/safe detection cases therefore used an owned real SQLite HTTP server inside the Cloudflare runtime. That validates the engine and executor, not public-target authentication or WAF compatibility. A blocked request is recorded as blocked, never as a clean assessment.

The native smoke also verified serialization, image-manifest rejection, bounded process timeout, the exact two-MiB output cutoff, explicit shutdown, and 1,049,098 bytes of evidence through a streamed Workflow step. Temporary resources were removed after validation. Complete application integration and authenticated target/file-transfer support remain prerequisites to replacing a Kali path.

References: [native Container API](https://developers.cloudflare.com/containers/api/durable-object-container/), [FFUF](https://github.com/ffuf/ffuf), [Nuclei modes](https://docs.projectdiscovery.io/opensource/nuclei/running), [SQLmap usage](https://github.com/sqlmapproject/sqlmap/wiki/Usage).

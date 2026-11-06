# Remaining tool families

Seven additional tool families extend the [HTTP, Nuclei and SQLmap bundles](bundles.md). Each uses an original upstream tool, a checksum-pinned image and a private Cloudflare Durable Object binding. No application route, agent permission or existing npm release changes automatically.

| Workspace suffix | Tools and pins | Candidate interface | Deliberate gaps |
| --- | --- | --- | --- |
| `service` | Nmap 7.95, Naabu 2.7.0, Masscan 1.3.2 | One explicit IPv4 address and 1–16 ports; TCP-connect profiles for Nmap/Naabu, bounded Masscan profile | No CIDR/range/DNS expansion, NSE scripts or complete Nmap flag parity. Raw socket availability alone does not prove external Masscan reachability. |
| `web-context` | WhatWeb 0.6.4, WaybackURLs 0.1.0 | Low-aggression fingerprinting; archive lookup for one hostname without subdomains | Original WaybackURLs uses legacy HTTP provider endpoints, including an old Common Crawl index. Archive records do not authorize testing. |
| `pcap` | TShark 4.4.19 | Offline supplied capture, first 200 packets; summary, DNS, HTTP or TCP fields in JSON | No live capture, interface selection, arbitrary filters or packet export. |
| `file-analysis` | Binwalk 2.4.3 | Offline signature and entropy views of a supplied file | No extraction or recursive decompression. This is the distro Python release, not Rust Binwalk 3.x. |
| `password` | Hashcat 8.0.0, POCL 6 CPU runtime | Hash identification; bounded SHA-256 dictionary check | No GPU, brute-force/mask/rule profiles, long-lived jobs, saved potfile or exhaustive hash-mode parity. |
| `reference` | Original Searchsploit and ExploitDB indexes at the revision in `tools.lock.json` | Read-only keyword search; fetch an individual source file from the same pinned revision | Full exploit tree is fetched on demand, not bundled or executed. No automatic database update. |
| `metasploit` | Official vendor image pinned by digest | Official HTTP MCP server through a private binding | No exposed callback/listener address, PostgreSQL database or certified parity for every framework module. |

The SDK prefix is `@memrov2/pentcloud-`. All seven adapter SDKs are in the [release table](releases.md) at 0.1.0. Their npm tarballs contain original adapter source, types, pins and notices, without the third-party executables or images. Nmap has separate redistribution terms, WaybackURLs supplies no detected license grant, and the Metasploit vendor image includes separately licensed components. These image-distribution cautions remain in effect; the MIT adapter license grants no rights to third-party tool contents.

## Use existing run identities and evidence storage

Export the relevant class from your Worker: `ServiceRunner`, `WebContextRunner`, `PcapRunner`, `FileRunner`, `PasswordRunner`, `ReferenceRunner` or `MetasploitRunner`. Bind its native Container image under the corresponding workspace suffix. Build only the capabilities your application uses; no all-tools image is required. The [binding configuration example](../examples/remaining/wrangler.jsonc) shows each named image and class; remove unused bindings/classes/images before deploying it. It intentionally exposes no public execution handler.

```js
export { PcapRunner } from '@memrov2/pentcloud-pcap/worker';
const runner = env.PCAP.getByName(runId);
try {
  const result = await runner.run(
    {tool: 'tshark', view: 'dns'},
    {input: captureBytes}
  );
  // Persist the result in the existing private run evidence store.
} finally {
  await runner.stop();
}
```

PCAP, file-analysis and password calls take `Uint8Array` attachments as a separate RPC argument. Only literal `input` and, for the dictionary profile, `dictionary` names are accepted. Total bytes are limited to two MiB, copied before queued execution and SHA-256 checked by the helper. Files are written privately inside the owned runtime and removed after the command. Their hashes are returned with the result. They are never inserted into argv. There is no new upload service or evidence database.

`runWorkflowStep(step, runner, request, files)` supports the same attachments and preserves full stdout/stderr through a native streamed step. Keep assessment data out of Workflow trigger payloads and persist evidence to your existing private store before its retention expires. An upstream result or console output may itself contain sensitive data; the adapters do not redact evidence automatically.

Searchsploit returns upstream JSON, including the title, ExploitDB ID and source path. Pass a result’s `Path` directly to `readSource`; the adapter accepts only its fixed `/opt/exploitdb/` prefix or a relative repository path. `reference.readSource(path)` fetches only an `exploits/` or `shellcodes/` file at the pinned GitLab revision, rejects redirects and traversal, and returns at most one MiB with its revision and SHA-256. Save those bytes to the existing Artifacts repository when needed; searching does not download the entire exploit collection.

Metasploit exposes `fetch(Request)` and `stop()`, rather than inventing a new exploit protocol. Use your existing MCP client against the private binding. The official server owns RPC jobs and sessions. The adapter stores a random internal bearer in native Durable Object storage, supplies it to the server environment, replaces caller authorization and strips cookies. No public HTTP execution route is provided. Stop the owned runtime when the assessment ends. A restart loses in-memory framework sessions; coordinator reconciliation must happen before any production integration.

## Browser family: use the managed browser

The stock Playwright interface has 24 operations. PentCloud already creates its browser through `Browser` and `browserRun` from `agents/browser`; no Playwright/Chromium image is added here. The integration review groups the stock operations as follows:

| Stock operations | Existing managed direction | Cutover evidence still needed |
| --- | --- | --- |
| Navigate/back, click/drag/hover, type/press/fill/select, wait, dialog | Browser Run session with browser actions or scripts | Each interaction, including popup/dialog handling, under the same run context |
| Close/resize/tabs | Managed browser/session and page lifecycle | Owned-tab cleanup and reconnect behavior |
| Screenshot/snapshot/find | Browser/CDP page inspection | Evidence persistence and equivalent element targeting |
| Console/network list/single request | Managed CDP events and network inspection | Capture boundaries and response-body limits |
| Evaluate/run-code | Existing scoped script/CDP capability | Preserve target policy and avoid broadening the unsafe stock operation |
| File upload/drop | Browser file transfer from existing evidence | Byte limits, allowed file paths and upload confirmation |

This is a migration map, not a claim that all 24 stock calls are interchangeable with one managed API. Retain the current route until the operation tests pass. Keep login/session policy in the application's existing Browser Run integration rather than copying credentials into a scanner image. See the [pinned application implementation](https://github.com/Memrov/PentCloud/blob/d1034b0eb8ea5bad38985d380454a378e6db8172/apps/control-plane/src/native/attempt.ts) and [Browser Run documentation](https://developers.cloudflare.com/browser-run/).

## Build and lifecycle

The [existing build requirements](bundles.md#build-images) apply. For example:

```sh
npm run image:pack:build -- pcap
npm run image:pack:build -- password
npm pack --workspaces --pack-destination .cache
```

The same command accepts each workspace suffix above. Go 1.26.5 and regctl 0.9.0 are pinned build requirements. Hashcat's original 7z archive additionally requires a tar implementation with 7z support, such as BSD/libarchive tar. Linux GNU tar alone cannot extract that archive. Dependency archives and source assets are verified against the lock; package post-install scripts are not executed on the build host. Necessary library links and certificate bundles are materialized deterministically. Image layers preserve original base layers and upstream notices.

PCAP and file-analysis use one CPU/1 GiB; reference uses one CPU/512 MiB; password and Metasploit use two CPUs/2 GiB. Service and web-context use one CPU/512 MiB. Offline analysis and password runtimes have Internet disabled. Reference searching is offline; its source-fetch method runs in the Worker. All runtimes stop after 120 seconds of inactivity and support explicit shutdown. Process profiles have a 75-second deadline and two MiB per output stream; Hashcat additionally has a 20-second cracking limit. Limits and timeout flags remain visible in results.

A private binding is an application capability, not complete network scope enforcement. Resolve the permitted IP yourself before a service check; enforce combined engagement budgets outside individual tool processes. These candidates do not accept login credentials or custom header secrets. Retain the existing Kali route for unsupported operations until application integration, authenticated tests, cancellation and evidence persistence pass.

## Verification boundary

Packed SDKs and the exact pinned images were exercised in Cloudflare against owned fixtures. The native results include successful controls and explicit empty/error cases:

| Family | Observed result | Compressed image |
| --- | --- | ---: |
| service | Nmap, Naabu and Masscan found the planted open port and excluded the closed one | 50.7 MiB |
| web-context | WhatWeb detected planted WordPress/PHP; plain response had no WordPress. Original WaybackURLs returned two fixture archive URLs and an empty negative | 53.5 MiB |
| pcap | Decoded the known DNS packet; valid empty capture returned `[]`; malformed capture failed | 77.0 MiB |
| file-analysis | Found gzip at offset 384, no signature on plain text; entropy view completed | 38.7 MiB |
| password | Identified the hash, recovered the known SHA-256 dictionary password; negative dictionary exhausted with upstream exit 1 | 219.7 MiB |
| reference | Found ExploitDB 50383; nonsense query returned no records; read the matching pinned 716-byte source and SHA-256 | 35.8 MiB |
| metasploit | Native MCP initialized; module search/info, empty search and session/stats reads worked; auxiliary HTTP-title job completed and the owned server recorded its GET | 843.0 MiB |

Masscan used an isolated virtual network inside its VM. That proves the fixture’s raw-packet mode, not Internet-wide reachability, every scan mode or network scope enforcement. Archive services were intercepted with native Container HTTP interception to provide deterministic responses to the original binary; live Wayback/Common Crawl availability is not certified.

The Metasploit HTTP-title module reports completion with a null structured result; its actual HTTP request was independently recorded by the owned fixture. This is lifecycle/execution evidence, not a vulnerability finding. No database, reverse listener, real-target exploit or full session suite was tested. Its image and initial readiness are substantially heavier than the small packs, so it remains a separate optional capability.

All seven images rebuilt to identical digests while preserving their original base layers. Local validation includes 40 JavaScript tests, 13 Python tests, Go race tests, strict consumer types and compilation of the new binding example. Source/history/package credential checks and independent review passed. The Docker-engine build path could not execute on this host; the OCI assembly and actual Cloudflare deployment path were tested. Browser Run’s 24-operation migration map remains an integration checklist, not a new browser compatibility certification.

Temporary runtimes, Workers and Workflows were removed, deployment leases revoked and production readback unchanged. No paid model call or application routing change was part of these tests. SDK publication is tracked separately in the release table. Full operation parity and application integration remain release gates, as detailed in [the inventory](tool-packs.md).

## Primary references

- [Native Cloudflare Containers](https://developers.cloudflare.com/containers/api/durable-object-container/) and [Browser Run](https://developers.cloudflare.com/browser-run/)
- [Nmap legal terms](https://nmap.org/book/man-legal.html), [Naabu](https://github.com/projectdiscovery/naabu), [Masscan](https://github.com/robertdavidgraham/masscan)
- [WhatWeb](https://github.com/urbanadventurer/WhatWeb), [WaybackURLs](https://github.com/tomnomnom/waybackurls)
- [TShark manual](https://www.wireshark.org/docs/man-pages/tshark.html), [Binwalk](https://github.com/ReFirmLabs/binwalk), [Hashcat](https://hashcat.net/hashcat/)
- [ExploitDB](https://gitlab.com/exploit-database/exploitdb), [official Metasploit MCP server](https://github.com/rapid7/metasploit-framework/blob/master/docs/metasploit-framework.wiki/How-to-use-Metasploit-MCP-Server.md)

### Development preset validation

The `0.1.1-dev.0` candidate uses named presets instead of the historical custom allocations above. Bounded packs use `lite`; recon and password use `standard-1`; Metasploit uses `standard-2`. Treat older allocation and timing measurements as historical fixture results. Validate memory, startup, duration and cleanup on the selected preset before application cutover. The image/tool locks remain pinned independently from this adapter-only update.

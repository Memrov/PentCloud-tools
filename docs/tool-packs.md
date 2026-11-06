# Tool packs and agent capabilities

PentCloud tools groups compatible tools into small runtimes according to their dependencies, execution lifetime and evidence needs. A pack can serve several agent roles; it is not a separate container image for each agent.

The [0.1.0 release](releases.md) publishes recon and seven additional tool SDKs plus the shared runtime. Service, web-context and Metasploit remain source-only candidates with publication holds. Browser actions remain on the existing managed Browser Run path. Released profiles are bounded and do not promise full stock-interface compatibility. PentCloud keeps its existing Kali integration until application cutover tests pass.

## Start with what agents actually need

| Agent | Main work | Appropriate capabilities |
| --- | --- | --- |
| Primary | Plan the assessment, delegate, reconcile results | Workflows, accepted evidence and existing agent controls. Schedule recon once and share its results. No new Linux runtime needed for orchestration. |
| Adviser | Diagnose a blocked approach and recommend the next step | Read existing evidence, source and technical references. It usually needs information rather than another scanner. |
| Searcher | Research products, vulnerabilities, public documentation and prior knowledge | Existing managed search, Browser Run and Git-backed source/reference material. Consume passive recon results; adding direct scanner permissions would be a separate policy change. |
| Pentester | Discover attack surfaces and validate findings | Recon, bounded web discovery, template checks, HTTP/TLS verification, and targeted injection/service tests where needed. Keep stateful framework work separate. |
| Coder | Write and adapt scripts, clients and proofs of concept | Existing Computer files/JavaScript and source context; a Linux scripting environment only when the language or dependencies require it. Reuse the HTTP tools; do not create a general-purpose shell by accident. |
| Maintenance | Diagnose readiness, dependencies and owned operations | Runtime/version diagnostics, file transfer and explicit owned-job cleanup. Prefer native lifecycle APIs; retain Kali for unsupported Linux work. |
| Memorist | Retrieve and preserve accepted knowledge | Existing Git-backed memory and text/file search. No scanner image or extra memory database needed. |
| Reporter | Read the entire assessment and produce supported findings | Recorded conversations, tool outputs, immutable evidence and report contracts. Read existing data rather than re-running scans to regenerate evidence. |

Current application policy gives stock Kali scanner operations to **Pentester, Coder and Maintenance**. Other roles have native Computer/Browser capabilities according to the application state. This library does not change role permissions or grant every agent every tool.

## Inventory boundary

The recorded stock interface exposes **126 MCP operations in 14 families**. Several operations launch the same binary, inspect its result, manage a session, or expose a browser action. This is an interface inventory, not a claim that Kali contains only 126 programs or that every installed package is agent-accessible.

The public source of this inventory is PentCloud's [recorded stock catalog](https://github.com/Memrov/PentCloud/blob/d1034b0eb8ea5bad38985d380454a378e6db8172/apps/control-plane/test/fixtures/stock-kali-catalog.json) and [role policy](https://github.com/Memrov/PentCloud/blob/d1034b0eb8ea5bad38985d380454a378e6db8172/apps/control-plane/src/native/tool-policy.ts). The catalog records schemas, not all executable versions. Every extracted binary still needs its own version and checksum verification.

| Existing family | Operations | Current candidate and remaining gap |
| --- | ---: | --- |
| ProjectDiscovery | 7 | Four recon binaries released; Naabu in service and Nuclei in templates. The combined bounty operation belongs in explicit Workflow steps. |
| FFUF | 7 | HTTP candidate has a fixed 12-path profile and baseline calibration; arbitrary wordlists, filters and job/session operations are not ported. |
| Nuclei | 6 | Three selected signed HTTP templates. No full catalog, headless/code/OOB scans or arbitrary templates. |
| SQLmap | 6 | One GET parameter, boolean/error testing. No dump/takeover, persistent session export or arbitrary requests. |
| Nmap | 7 | TCP-connect checks for one IPv4 and up to 16 ports. NSE, UDP/OS discovery and unrestricted flags are not included. Redistribution review remains. |
| Masscan | 4 | Bounded one-IPv4 profile; native raw networking needs actual packet-output validation. No broad subnet scan or resume/import parity. |
| WhatWeb | 3 | Low-aggression original Ruby/plugin source. No arbitrary plugin/aggression controls. |
| WaybackURLs | 3 | Original binary and no-subdomain profile. Legacy providers and missing license grant block release certification. |
| Playwright | 24 | Reuse existing Browser Run for browsing, scripts and session state. Audit file transfer, dialogs, tabs and network inspection against stock operations before retiring the fallback. No duplicate browser image. |
| Metasploit | 12 | Original vendor HTTP MCP and private binding. Database/callback/listener behavior and each required module still need integration validation. |
| Searchsploit | 3 | Original CLI with pinned indexes plus bounded source fetch from the same revision. No execute/update profile. |
| Hashcat | 23 | CPU identify and SHA-256 dictionary profiles. GPU, arbitrary modes/rules/masks and long-running recovery remain unsupported. |
| Binwalk | 7 | Offline signature/entropy; no extract, recursion or external extractor chain. Distro 2.4.3 compatibility, not current Rust 3.x parity. |
| TShark | 14 | Offline JSON views of the first 200 packets; no live capture, arbitrary dissector options or PCAP export. |

A family having a workspace does not mean every operation is implemented. Readiness, positive/negative results and specific blockers are recorded in each candidate's verification notes. This inventory deliberately retains unsupported operations instead of silently changing their meaning.

## Integration order

Use the released recon first, then integrate individually verified candidates according to actual agent demand. Lightweight HTTP/template checks need less state than Metasploit sessions or sustained password work. Offline analysis needs evidence transfer, and every route needs coordinator ownership, retry reconciliation and cancellation before replacing Kali.

Bundle boundaries remain based on image size, readiness, process memory and evidence needs. No application migration is included in this repository change.

## Common requirements before replacing a Kali path

- Preserve original upstream programs and licenses, with binary/source and auxiliary-asset pins. No tool installation or automatic updates during an assessment. Pinned reference files may be fetched on demand and saved to the existing evidence store.
- Define positive, negative and empty-result fixtures. Exit code zero alone is not proof of coverage.
- Reuse the application's existing target credential references and Cloudflare secret resolution when authenticated requests are added. The current recon release has no credential/header injection interface. Avoid passing secrets through model arguments, recorded argv or returned evidence.
- Keep raw results and files private in the application's existing Git/Artifacts evidence path. Return a concise summary and references to agents rather than entire datasets or every tool schema.
- Retain accepted input/output hashes, execution identity and version metadata. File-backed scanners need import/export parity before cutover; stdout alone is not sufficient.
- Apply engagement-wide budgets across concurrent agents and tools. A per-process request limit is not a global assessment limit.
- Chunk deterministic work through Workflows and preserve owned-job identities for longer operations. The recon helper's current 75-second process deadline and process-group cleanup are not automatically suitable for sessions/listeners or lengthy scans.
- Keep current role boundaries. Test any future passive Searcher capability separately rather than granting the whole Linux catalog.
- Verify same-run retry, cancellation and unknown-outcome reconciliation before removing the old route. Only stop processes or sessions owned by that assessment.

No proposed pack establishes complete network scope enforcement. Hardware-, GPU- and protocol-specific requirements remain capability tests, not compatibility promises.

## Primary references

- [Cloudflare Containers native API](https://developers.cloudflare.com/containers/api/durable-object-container/) and [Workflows](https://developers.cloudflare.com/workflows/)
- [FFUF options, wordlists and response filters](https://github.com/ffuf/ffuf)
- [Nuclei execution modes and templates](https://docs.projectdiscovery.io/opensource/nuclei/running)
- [SQLmap core and optional dependencies](https://github.com/sqlmapproject/sqlmap/wiki/Dependencies)
- [Nmap scan techniques](https://nmap.org/book/man-port-scanning-techniques.html) and [redistribution notices](https://nmap.org/book/man-legal)
- [TShark capture-file analysis](https://www.wireshark.org/docs/man-pages/tshark.html)
- [WhatWeb dependencies and plugins](https://github.com/urbanadventurer/WhatWeb)

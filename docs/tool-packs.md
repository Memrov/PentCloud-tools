# Tool packs and agent capabilities

PentCloud tools groups compatible tools into small runtimes according to their dependencies, execution lifetime and evidence needs. A pack can serve several agent roles; it is not a separate container image for each agent.

Only the **recon pack 0.1.0** is released and Cloudflare-tested. All other packs below are candidates, not supported releases. PentCloud's current application continues using its existing Kali integration until a replacement passes an application integration test.

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

| Existing family | Operations | Proposed treatment |
| --- | ---: | --- |
| ProjectDiscovery tools | 7 | Four binaries are in recon 0.1.0. Evaluate Naabu separately with service scanning and Nuclei with template scanning. The combined bounty-workflow operation belongs in explicit Cloudflare Workflow steps. |
| FFUF | 7 | Next candidate: bounded web discovery with pinned small wordlists, request budgets, response-baseline filtering and raw evidence. |
| Nuclei | 6 | Separate template-scanning pack with pinned engine and template revision. Two current wrappers advertise Nuclei; verify their actual versions/options before consolidating them. |
| SQLmap | 6 | Focused Python pack for request/parameter-specific testing. Keep persisted sessions and readout distinct from execution; do not assume a short timeout erases a remote effect. |
| Nmap | 7 | Service-verification candidate. Start capability testing with explicit TCP-connect mode, then evaluate other modes. Redistribution terms need review before publishing an image. |
| Masscan | 4 | Retain in Kali while raw-packet capabilities and strict workload limits are evaluated. It should not become default web recon merely because it is installed. |
| WhatWeb | 3 | Benchmark its additional fingerprinting value against the existing httpx output before adding a Ruby/plugin runtime. Do not assume their detection coverage is identical. |
| WaybackURLs | 3 | Candidate optional recon capability. Archived URLs are discovery hints, not proof that an endpoint still exists or is currently authorized. |
| Playwright | 24 | Prefer the Browser Run integration already present in PentCloud. Map upload/download, network inspection and session behavior before retiring any fallback. No extra Chromium image by default. |
| Metasploit | 12 | Keep as a separate stateful framework environment. RPC sessions, jobs, listeners, callbacks and owned cleanup do not fit a short-lived recon process. |
| Searchsploit | 3 | First reuse managed research and pinned read-only reference repositories in Artifacts. Keep the exact CLI in Kali when required; no new container just for searching text. |
| Hashcat | 23 | Separate compute-capability evaluation. Identification/rule helpers and sustained cracking have different needs; do not promise GPU execution on the tested CPU container allocation. |
| Binwalk | 7 | Candidate offline file-analysis pack, with extractor dependencies and expansion/output limits. Build only when firmware/file-analysis demand justifies it. |
| TShark | 14 | Candidate offline PCAP-analysis pack. Reading a supplied capture and live capture require different permissions and should not share one default operation profile. |

## Recommended build order

1. **HTTP investigation:** FFUF with small pinned wordlists, native curl and OpenSSL for HTTP/TLS operations that exceed the existing Worker fetch-backed curl subset. These tools share short-lived web/API investigation and request/evidence handling. Ordinary HTTP reads should keep using the existing managed capability.
2. **Template scanning:** Nuclei plus an explicitly pinned, selected template set. Keep template updates versioned separately in the lock metadata. Code, headless and out-of-band capabilities require deliberate profiles; do not enable them just to emulate an unrestricted installation.
3. **Focused SQL testing:** SQLmap with its Python runtime and versioned source/data. Its core does not require the full Kali distribution or third-party Python libraries. Optional takeover integrations have additional dependencies and are not implied by this candidate.
4. **Service verification:** Nmap/Naabu after network-mode and license checks. Do not describe raw-packet support as either working or impossible without a Cloudflare capability test.
5. **Optional evidence/reference capabilities:** PCAP/file analysis and offline research only when required by real assessments. Preserve the existing stateful Kali fallback for work not yet covered.

Bundle boundaries remain adjustable after measuring image size, readiness, actual process memory, output correctness and agent usefulness. Sharing a base is useful; placing unrelated large datasets or persistent services in every image is not.

## Common requirements before replacing a Kali path

- Preserve original upstream programs and licenses, with binary/source and auxiliary-asset pins. No downloads or updates during an assessment.
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

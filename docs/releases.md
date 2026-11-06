# Releases

The 0.1.0 SDK release exposes bounded, Cloudflare-tested profiles. SDK tarballs contain adapter source, type declarations, lock metadata and notices. They do not contain scanner executables or container images. Build the corresponding pinned image in your own account using the repository instructions.

| npm package | Version | Capability |
| --- | --- | --- |
| [@memrov2/pentcloud-recon](https://www.npmjs.com/package/@memrov2/pentcloud-recon) | 0.1.0 | httpx, dnsx, Katana, Subfinder |
| [@memrov2/pentcloud-tool-runtime](https://www.npmjs.com/package/@memrov2/pentcloud-tool-runtime) | 0.1.0 | Shared executor, binary attachments and streamed evidence |
| [@memrov2/pentcloud-http](https://www.npmjs.com/package/@memrov2/pentcloud-http) | 0.1.0 | FFUF, curl, OpenSSL |
| [@memrov2/pentcloud-nuclei](https://www.npmjs.com/package/@memrov2/pentcloud-nuclei) | 0.1.0 | Selected signed exposure templates |
| [@memrov2/pentcloud-sqlmap](https://www.npmjs.com/package/@memrov2/pentcloud-sqlmap) | 0.1.0 | Focused GET-parameter tests |
| [@memrov2/pentcloud-pcap](https://www.npmjs.com/package/@memrov2/pentcloud-pcap) | 0.1.0 | Offline TShark |
| [@memrov2/pentcloud-file-analysis](https://www.npmjs.com/package/@memrov2/pentcloud-file-analysis) | 0.1.0 | Offline Binwalk |
| [@memrov2/pentcloud-password](https://www.npmjs.com/package/@memrov2/pentcloud-password) | 0.1.0 | CPU Hashcat profiles |
| [@memrov2/pentcloud-reference](https://www.npmjs.com/package/@memrov2/pentcloud-reference) | 0.1.0 | Searchsploit and pinned source reads |
| [@memrov2/pentcloud-service](https://www.npmjs.com/package/@memrov2/pentcloud-service) | 0.1.0 | Nmap, Naabu and Masscan adapter profiles |
| [@memrov2/pentcloud-web-context](https://www.npmjs.com/package/@memrov2/pentcloud-web-context) | 0.1.0 | WhatWeb and WaybackURLs adapter profiles |
| [@memrov2/pentcloud-metasploit](https://www.npmjs.com/package/@memrov2/pentcloud-metasploit) | 0.1.0 | Private-binding proxy for the official Metasploit MCP server |

The original recon release and `v0.1.0` tag remain immutable. `tools-v0.1.0` identifies the first additional SDK release. The repository release `tools-v0.1.1` adds the service, web-context and Metasploit SDKs at their initial npm version 0.1.0; existing package versions and prior release assets are unchanged. Each subsequent pack update must increment its own SDK/lock version and produce a matching verified image digest.

## SDK and image distribution

The service, web-context and Metasploit npm packages contain original MIT-licensed adapter code, type declarations, pin metadata and notices. Their publication does not distribute Nmap, WaybackURLs, Metasploit executables or vendor image archives. The runtime code and tool pins are unchanged from their native Cloudflare validation.

Nmap-containing images require review of their applicable redistribution terms. WaybackURLs still has no detected license grant. Metasploit's core uses BSD-3-Clause with additional component licenses in the vendor image. These cautions remain recorded in the locks and package notices. No dependency was removed or relicensed, and no third-party binary image is distributed in this SDK release.

The adapter’s MIT license does not change upstream executable, template, dataset or dependency licenses. Image builders preserve notices; review upstream source and distribution requirements before distributing a built image.

## Release checks

Run the local quality suite and the exact-image native Cloudflare checks before changing a runtime profile. Inspect `npm pack --dry-run`, scan source/history/tarballs for credentials and verify a clean consumer installation. Publish the shared runtime before dependent adapters. Keep npm credentials in local authentication; they are not stored in GitHub Actions.

The Quality workflow runs synthetic tests, race checks, public types and unit coverage. It never launches an assessment or receives Cloudflare/target credentials. Codecov receives only the three explicit unit report files. Production routing and agent permissions change only in a separate application integration release.

## Development SDK: 0.1.1-dev.0

This adapter prerelease replaces custom Container sizing with Cloudflare named presets, adds scan-free `ready()` and persistent `retire()` methods, and shares reference-path validation with consumers. Executable pins and image manifests remain unchanged. `stop()` remains restartable; `retire()` permanently fences the owned identity, including calls after object reconstruction.

Native Cloudflare fixture checks covered all eleven packs. Recon needs `standard-1`: httpx was killed on `lite` and completed on the larger preset. Password uses `standard-1`; Metasploit uses `standard-2`, with a longer startup idle window that reduces after readiness. Other bounded packs passed on `lite`. The checks exercised positive and negative controls, malformed packet input, offline attachments, pinned reference retrieval and the official Metasploit MCP list/search/session interfaces. These are profile-level functional checks, not full Kali parity or production assessment guarantees.

Install the exact prerelease version for development. The stable `latest` dist-tags remain at 0.1.0. Lifecycle-only SDK releases may retain existing tool/image locks when the executable payload and release manifest are byte-identical; executable or pin changes still require new locks and verified images.

## Development SDK: 0.1.1-dev.1

Native process deadlines now use cancellable timers cleared when `exitCode` settles, including while buffered output drains. This follows Cloudflare's [process lifetime guidance](https://developers.cloudflare.com/containers/api/durable-object-container/#process-lifetime): a late abort after process exit can raise an internal Durable Object error. The shared runner, recon and Metasploit manifest check use the same helper. Tool arguments, execution limits, image locks and stable releases are unchanged.

## SQLmap development SDK: 0.1.1-dev.2

The SQLmap adapter and shared runtime use the named `standard-1` preset for SQLmap, retaining its 75-second process limit and fixed request rate. `lite` completed the positive fixture but timed out on the parameterized negative fixture. Other adapters retain their `0.1.1-dev.1` release and named presets. This sizing adjustment does not change the tool payload, image manifest or stable versions.

The SQLmap adapter `0.1.1-dev.3` corrects its public `ready().instance` declaration to `standard-1` and depends on shared runtime `0.1.1-dev.2`. It has the same executable profile as the preceding adapter candidate.

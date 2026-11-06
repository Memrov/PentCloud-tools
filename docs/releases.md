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

The original recon release uses the `v0.1.0` tag. `tools-v0.1.0` identifies the first additional SDK release. The repository release `tools-v0.1.1` adds the service, web-context and Metasploit SDKs at their initial npm version 0.1.0; existing package versions and prior release assets are unchanged. These existing GitHub releases were published without GitHub release immutability. GitHub release immutability is now enabled for future releases; it does not lock earlier tags or assets. Each subsequent pack update must increment its own SDK/lock version and produce a matching verified image digest.

## SDK and image distribution

The service, web-context and Metasploit npm packages contain original MIT-licensed adapter code, type declarations, pin metadata and notices. Their publication does not distribute Nmap, WaybackURLs, Metasploit executables or vendor image archives. The runtime code and tool pins are unchanged from their native Cloudflare validation.

Nmap-containing images require review of their applicable redistribution terms. WaybackURLs still has no detected license grant. Metasploit's core uses BSD-3-Clause with additional component licenses in the vendor image. These cautions remain recorded in the locks and package notices. No dependency was removed or relicensed, and no third-party binary image is distributed in this SDK release.

The adapter’s MIT license does not change upstream executable, template, dataset or dependency licenses. Image builders preserve notices; review upstream source and distribution requirements before distributing a built image.

## Release checks

Run the local quality suite and the exact-image native Cloudflare checks before changing a runtime profile. Inspect `npm pack --dry-run`, scan source/history/tarballs for credentials and verify a clean consumer installation. Publish the shared runtime before dependent adapters. Keep npm credentials in local authentication; they are not stored in GitHub Actions.

The Quality workflow runs synthetic tests, race checks, public types and unit coverage. It never launches an assessment or receives Cloudflare/target credentials. Codecov receives only the three explicit unit report files. Production routing and agent permissions change only in a separate application integration release.

## Verification and dependency inventory

Download the assets for the exact [release tag](https://github.com/Memrov/PentCloud-tools/releases) you selected, including `SHA256SUMS`, and verify them locally with `sha256sum -c SHA256SUMS` (or `shasum -a 256 -c SHA256SUMS` on macOS). Check the package version, `tools.lock.json` and matching image digest before use. Checksums detect a mismatch with the published checksum file; they do not prove how an artifact was built.

The published 0.1.0 npm packages have npm registry signatures and integrity metadata, but no `dist.attestations` build provenance. The existing GitHub releases also lack GitHub build attestations and immutable-release attestations. Registry signatures are distinct from build provenance. A future release can add verified build provenance and exact-artifact SBOMs through a deliberate release-process change; the current synthetic CI does not publish packages or images.

GitHub can export a source dependency SBOM from the repository's [dependency graph](https://github.com/Memrov/PentCloud-tools/network/dependencies). It recognizes the npm, Go and Python manifests; it does not inventory the upstream scanner executables, datasets and full base-image contents pinned by `tools.lock.json` and `packages/*/tools.lock.json`. Review these pins and upstream advisories separately. An inventory of the exact built image and its transitive components remains a release-verification follow-up.

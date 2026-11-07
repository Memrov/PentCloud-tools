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

## Development SDK: 0.1.1-dev.0

This adapter prerelease replaces custom Container sizing with Cloudflare named presets, adds scan-free `ready()` and persistent `retire()` methods, and shares reference-path validation with consumers. Executable pins and image manifests remain unchanged. `stop()` remains restartable; `retire()` permanently fences the owned identity, including calls after object reconstruction.

Native Cloudflare fixture checks covered all eleven packs. Recon needs `standard-1`: httpx was killed on `lite` and completed on the larger preset. Password uses `standard-1`; Metasploit uses `standard-2`, with a longer startup idle window that reduces after readiness. Other bounded packs passed on `lite`. The checks exercised positive and negative controls, malformed packet input, offline attachments, pinned reference retrieval and the official Metasploit MCP list/search/session interfaces. These are profile-level functional checks, not full Kali parity or production assessment guarantees.

Install the exact prerelease version for development. The stable `latest` dist-tags remain at 0.1.0. Lifecycle-only SDK releases may retain existing tool/image locks when the executable payload and release manifest are byte-identical; executable or pin changes still require new locks and verified images.

## Development SDK: 0.1.1-dev.1

Native process deadlines now use cancellable timers cleared when `exitCode` settles, including while buffered output drains. This follows Cloudflare's [process lifetime guidance](https://developers.cloudflare.com/containers/api/durable-object-container/#process-lifetime): a late abort after process exit can raise an internal Durable Object error. The shared runner, recon and Metasploit manifest check use the same helper. Tool arguments, execution limits, image locks and stable releases are unchanged.

## SQLmap development SDK: 0.1.1-dev.2

The SQLmap adapter and shared runtime use the named `standard-1` preset for SQLmap, retaining its 75-second process limit and fixed request rate. `lite` completed the positive fixture but timed out on the parameterized negative fixture. Other adapters retain their `0.1.1-dev.1` release and named presets. This sizing adjustment does not change the tool payload, image manifest or stable versions.

The SQLmap adapter `0.1.1-dev.3` corrects its public `ready().instance` declaration to `standard-1` and depends on shared runtime `0.1.1-dev.2`. It has the same executable profile as the preceding adapter candidate.

## Unpublished candidate: shared runtime 0.1.1-dev.3 and recon 0.1.1-dev.2

Recon now inherits the existing `createRunner` implementation. Its public `ready()`, `run()`, `retire()` and `stop()` methods, bounded profiles and `standard-1` preset remain. The factory chooses the preset once; password and SQLmap also keep `standard-1`, and its other packs keep `lite`. No factory options, lifecycle retries or process-helper behavior are added.

This candidate requires a new recon SDK/image pair. The recon lock now includes `packId: "recon"` and pack version `0.1.1-dev.2`. Image preparation writes the complete lock and its `JSON.stringify`-compatible SHA-256 to `pack.json`, and installs the unchanged Go helper as `/opt/pentcloud-recon/bin/pack-exec`. Every upstream archive, binary and base-image pin remains unchanged. The runner rejects a mismatched lock or actual running image before dispatching a profile. Serialized work, native process deadlines and durable retirement use the common implementation.

The recon package depends exactly on runtime `0.1.1-dev.3`; the other ten SDK versions/dependencies are unchanged. Existing adapters can still resolve their older exact runtimes. Consumers deliberately overriding them to the new runtime must verify every pack and inspect the installed resolution. Keep old SDK/image pairs for rollback, and drain active recon work before adopting this manifest change: updating a named image does not replace a running Container.

These versions are prepared candidates, not published releases. Before publication, complete local quality and exact-image native checks, inspect the two exact tarballs, and verify a clean consumer install. Publish the reviewed runtime tarball first, then recon, with the `dev` tag; keep `latest` at `0.1.0`. App registry pins and immutable image-source pins follow publication and consumer verification. No npm or Cloudflare credentials are added to CI.

Design references refreshed on 2026-11-06: [direct Container API](https://developers.cloudflare.com/containers/api/durable-object-container/), [named image management](https://developers.cloudflare.com/containers/guides/image-management/), and [implementation migration](https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-container-api/). The current official [basic example at a17055c](https://github.com/cloudflare/containers/blob/a17055ca4f64b8f7fea6dfaa62dfb2c06a954a2b/examples/basic/src/index.ts) still uses the older `Container` wrapper. Reusing this repository's direct-API factory is the smaller change and retains its persistent storage and lifecycle behavior.

## Verification and dependency inventory

Download the assets for the exact [release tag](https://github.com/Memrov/PentCloud-tools/releases) you selected, including `SHA256SUMS`, and verify them locally with `sha256sum -c SHA256SUMS` (or `shasum -a 256 -c SHA256SUMS` on macOS). Check the package version, `tools.lock.json` and matching image digest before use. Checksums detect a mismatch with the published checksum file; they do not prove how an artifact was built.

The published 0.1.0 npm packages have npm registry signatures and integrity metadata, but no `dist.attestations` build provenance. The existing GitHub releases also lack GitHub build attestations and immutable-release attestations. Registry signatures are distinct from build provenance. A future release can add verified build provenance and exact-artifact SBOMs through a deliberate release-process change; the current synthetic CI does not publish packages or images.

GitHub can export a source dependency SBOM from the repository's [dependency graph](https://github.com/Memrov/PentCloud-tools/network/dependencies). It recognizes the npm, Go and Python manifests; it does not inventory the upstream scanner executables, datasets and full base-image contents pinned by `tools.lock.json` and `packages/*/tools.lock.json`. Review these pins and upstream advisories separately. An inventory of the exact built image and its transitive components remains a release-verification follow-up.

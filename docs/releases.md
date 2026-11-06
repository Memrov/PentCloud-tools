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

The original recon release and `v0.1.0` tag remain immutable. `tools-v0.1.0` identifies the additional SDK release. Each subsequent pack update must increment its own SDK/lock version and produce a matching verified image digest.

## Source-only candidates

The service, web-context and Metasploit workspaces remain `private: true` and are excluded from npm publication. Their tested code remains in the public source. Nmap-containing distributions require a redistribution review; WaybackURLs has no detected license grant. No dependency was removed or relicensed to bypass these holds.

The adapter’s MIT license does not change upstream executable, template, dataset or dependency licenses. Image builders preserve notices; review upstream source and distribution requirements before distributing a built image. This SDK release distributes no third-party binary image archives.

## Release checks

Run the local quality suite and the exact-image native Cloudflare checks before changing a runtime profile. Inspect `npm pack --dry-run`, scan source/history/tarballs for credentials and verify a clean consumer installation. Publish the shared runtime before dependent adapters. Keep npm credentials in local authentication; they are not stored in GitHub Actions.

The Quality workflow runs synthetic tests, race checks, public types and unit coverage. It never launches an assessment or receives Cloudflare/target credentials. Codecov receives only the three explicit unit report files. Production routing and agent permissions change only in a separate application integration release.

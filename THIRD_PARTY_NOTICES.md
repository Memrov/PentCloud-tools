# Third-party software

The npm package contains the PentCloud adapter and tool release metadata. The separately built container contains unchanged upstream executables:

| Tool | Release | Source and license |
| --- | --- | --- |
| httpx | v1.12.0 | https://github.com/projectdiscovery/httpx/tree/v1.12.0 |
| dnsx | v1.3.1 | https://github.com/projectdiscovery/dnsx/tree/v1.3.1 |
| Katana | v1.8.0 | https://github.com/projectdiscovery/katana/tree/v1.8.0 |
| Subfinder | v2.17.0 | https://github.com/projectdiscovery/subfinder/tree/v2.17.0 |

The build verifies each upstream archive and executable using `tools.lock.json`, and includes the archive's license files under `/usr/share/licenses/pentcloud-recon/<tool>/`. The upstream tools retain their own licenses; the adapter's MIT license does not replace them.

The base is the pinned Alpine Linux 3.22.2 linux/amd64 image. Alpine packages retain their respective licenses. Base source and package metadata are available from https://alpinelinux.org/ and https://pkgs.alpinelinux.org/packages?branch=v3.22. Review the applicable upstream distribution obligations before redistributing a built image.

# Contributing

Use [private vulnerability reporting](https://github.com/Memrov/PentCloud-tools/security/advisories/new) for security findings. For other bugs, open an issue with a minimal synthetic reproduction, affected package/version, image digest and expected behavior. Keep credentials, private target identities and assessment evidence out of public contributions. Follow the [code of conduct](CODE_OF_CONDUCT.md).

Keep changes focused and explain their effect on the bounded tool interface, lifecycle and package/image compatibility. Preserve upstream licenses and checksum pins. A tool or image update needs a corresponding SDK/lock version and verified image; do not replace an existing package version or release asset.

For development, use the toolchain and setup in [README.md](README.md) and [testing and coverage](docs/testing.md). Before submitting a code change, run:

```sh
npm test
npm run test:runner
npm run test:image
npm run typecheck
```

Include the checks you ran and any limits in your pull request. Public CI uses synthetic fixtures. Runtime/profile changes additionally need the exact-image Cloudflare checks described in [release checks](docs/releases.md#release-checks), using only targets you are authorized to assess. Keep account and target credentials in native authentication or private secret stores.

Dependabot monitors the root npm workspaces, Python coverage dependency, Go module and GitHub Actions. Scanner archives, datasets and base-image digests in `tools.lock.json` and `packages/*/tools.lock.json` require separate upstream, vulnerability and license review.

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

## Local Snyk dependency scan

With npm, Go and the authenticated [Snyk CLI](https://docs.snyk.io/developer-tools/snyk-cli/authenticate-to-use-the-cli) on `PATH`, members of the `memrov` Snyk organization can run:

```sh
python3 scripts/scan-dependencies.py
```

The helper runs `npm ci --ignore-scripts` against the authoritative lockfile and
checks `npm ls`, explicitly including development, optional and peer dependencies
even when the shell uses production or omit settings. It copies tracked source
into a temporary scan view, preserves manifests and Go source, and links the
clean installed dependencies. Only the
view omits npm lockfiles, selecting Snyk's documented installed-tree scan mode.
The source manifests, lockfile and Go module files must retain their original hashes.

Snyk runs with `--all-projects --fail-fast --dev --strict-out-of-sync=true`.
The helper requires every tracked npm manifest and the Go module to appear in
the results, and compares the submitted npm package/version inventory with
`npm ls` rather than trusting a green exit or dependency count. It saves a
sanitized report in `.cache/snyk-installed-inventory.json`. Exit 0 means complete
with no findings, 1 means complete with vulnerabilities, and 2 means a scan or
coverage check failed. Raw CLI output and authentication data are not saved.

This checks packages installed on the current OS/CPU, including development
dependencies. Optional packages for other platforms need their own installation
and scan. The installed resolver can report hoisted workspace packages as
extraneous and omit the root's direct runtime edge when its declared version
differs from the linked workspace version; inventory equality verifies package
coverage, not exact dependency-path fidelity. Snyk's npm workspace lock parser
currently fails this root layout, and npm workspace SCM scans remain unsupported;
an existing SCM badge or zero-dependency project is not evidence of this check.

The custom Python requirements filename needs an explicit scan. In the coverage
virtual environment described in [testing](docs/testing.md), run:

```sh
.cache/coverage-venv/bin/python -m pip install -r requirements-coverage.txt
snyk test --file=requirements-coverage.txt --package-manager=pip --command="$PWD/.cache/coverage-venv/bin/python" --org=memrov --remote-repo-url=https://github.com/Memrov/PentCloud-tools
```

The public repository URL helps Snyk classify the scan correctly. Review scan errors and the manifests actually tested, including Go and Python alongside npm. Source dependency scanning does not inventory or scan bundled executables, datasets or base-image packages. Check the account's actual plan and usage before enabling additional products; open-source program benefits require eligibility. Keep CLI credentials outside Git. The existing GitHub app handles imported projects without a Snyk credential in Actions; inspect those projects before creating additional `snyk monitor` snapshots.

The existing SCM projects have daily testing configured. Organization settings
include npm development dependencies and use Python 3.13 for pip scans, matching
the Quality workflow. Confirm these settings when changing build tooling; an
older zero-dependency snapshot does not establish coverage of development tools.

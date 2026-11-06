# Testing and coverage

Tool packs have two different validation needs: adapter/lifecycle correctness and actual upstream tool behavior. Coverage measures execution of our adapter, executor and build-preparation code. It does not certify scanner accuracy, safe scope handling or all upstream dependencies.

## Run locally

Use Node.js 26+ for development coverage, the existing Go 1.26.5 toolchain and Python 3.9+. SDK consumers still support Node.js 22+.

```sh
npm ci
python3 -m venv .cache/coverage-venv
.cache/coverage-venv/bin/python -m pip install -r requirements-coverage.txt
PENTCLOUD_COVERAGE_PYTHON="$PWD/.cache/coverage-venv/bin/python" npm run coverage
npm run typecheck
```

The Python dependency is development-only. `PENTCLOUD_COVERAGE_PYTHON` may name another interpreter with the pinned coverage.py version installed; otherwise `python3` is used. Reports stay under the ignored `.cache/coverage/` directory.

| Report | Format | Scope |
| --- | --- | --- |
| `javascript.lcov` | LCOV from Node's built-in test runner | Shipped JavaScript in `src/` and `packages/*/src/`, including unexecuted files |
| `go.out` | Native Go coverprofile, with race detector | The execution helper, including protocol parsing and process/output handling |
| `python.xml` | Cobertura XML from coverage.py | Image preparation, checksum/license handling and staging hygiene |

The Node image-build/coverage orchestration scripts are not in the JavaScript library coverage scope. Real image assembly and deployment remain release checks. Tests for native Container APIs use a small boundary fixture; each release must also run the private Cloudflare smoke test against its exact tarball and image. Codecov percentages are not a substitute for that test.

## Codecov connection

`codecov.yml` is validated by Codecov's official validator. Project coverage compares with its baseline and allows a one-percentage-point change. The initial 80% patch target is informational while the baseline and integration are established. The README uses Codecov’s live badge, not a hardcoded percentage.

The public [Quality workflow](../.github/workflows/quality.yml) runs synthetic unit fixtures and type checks, then uploads only `javascript.lcov`, `go.out` and `python.xml` with Codecov’s pinned official Action. The repository upload key is stored as an encrypted `CODECOV_TOKEN` Actions secret. The workflow token has read-only repository permissions. Cloudflare, npm publishing and target credentials are absent.

Fork pull requests run tests without receiving the Codecov upload key. Only trusted repository branches upload reports. The configured upload key authenticates coverage uploads to the dashboard and badge. Additional PR annotations can be configured through Codecov’s GitHub app. No paid features are enabled.

The generated reports contain counts and source-relative paths. Python is configured with `relative_files = True`; Go module paths are mapped back to repository paths in Codecov. Inspect report files before the first upload to confirm they contain no local operator paths or credentials.

## Before releasing another pack

- Run tests, type checking and source/history/package credential scans.
- Verify binary/source, dataset and base-image pins; preserve upstream notices.
- Build from clean staging and inspect the image/npm allowlists.
- Test positive and negative fixtures using the actual binaries in Cloudflare, including timeout/cancellation, bounded output, version mismatch and owned cleanup.
- Verify exact published package/image integrity and a clean consumer installation.
- Confirm the existing application integration and fallback behavior before changing production routing.

Do not replace existing package versions or release assets. Earlier GitHub releases were published without release immutability; see [release verification](releases.md#verification-and-dependency-inventory). A coverage or documentation change does not silently replace a released runtime image.

References: [Node coverage](https://nodejs.org/api/test.html#collecting-code-coverage), [Go coverage](https://go.dev/doc/build-cover), [coverage.py](https://coverage.readthedocs.io/), [Codecov setup](https://docs.codecov.com/docs/quick-start), [supported report formats](https://docs.codecov.com/docs/supported-report-formats).

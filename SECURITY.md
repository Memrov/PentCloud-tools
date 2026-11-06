# Security

Use [GitHub's private vulnerability reporting form](https://github.com/Memrov/PentCloud-tools/security/advisories/new) for suspected vulnerabilities. Never include credentials, tokens, private target details or assessment evidence in public issues or pull requests.

Security maintenance focuses on `main` and the latest published version of each package listed in [releases](docs/releases.md). Older versions may need an upgrade; there is no fixed response or release schedule. A package update must remain paired with its matching verified image digest.

Include the affected package/version, source commit and image digest where relevant, expected and actual behavior, impact, and a minimal reproduction using synthetic data or a target you control. Remove live credentials and unrelated customer evidence. Describe sensitive artifacts before sharing them so maintainers can agree on the minimum information needed. Coordinate public disclosure through the private report while the issue is assessed.

The runner is intended for trusted Worker/Workflow bindings. The example has no public scanning endpoint. If you expose an API around it, authenticate and authorize requests, bound job creation and isolate assessment runs.

Source and npm releases contain code and public upstream release metadata. Cloudflare and npm credentials belong in their native authentication mechanisms or secret stores. Do not commit local configuration containing account-specific credentials.

CodeQL, dependency review, coverage and dependency alerts cover different parts of the source and its declared dependencies. They do not certify scanner behavior or network scope enforcement. See [release verification](docs/releases.md#verification-and-dependency-inventory) for checksum, provenance and inventory limits.

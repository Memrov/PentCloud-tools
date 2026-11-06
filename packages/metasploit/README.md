# PentCloud metasploit

Official Metasploit HTTP MCP in a separate native Cloudflare runtime. **Unreleased candidate.** Private candidate: vendor image redistribution requires review. No PostgreSQL or public callback/listener endpoint is configured.

Use an existing MCP client with `runner.fetch(request)` through a private binding. Call `runner.stop()` when the owned run ends.

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

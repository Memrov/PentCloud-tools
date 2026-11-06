# PentCloud metasploit

Official Metasploit HTTP MCP in a separate native Cloudflare runtime. **Version 0.1.0 SDK.** The npm package contains adapter code only. Vendor image redistribution requires a separate component-license review. No PostgreSQL or public callback/listener endpoint is configured.

```sh
npm install @memrov2/pentcloud-metasploit@0.1.0
```

Use an existing MCP client with `runner.fetch(request)` through a private binding. Call `runner.stop()` when the owned run ends.

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

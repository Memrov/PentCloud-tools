# Security

Never include credentials, tokens, private target details or assessment evidence in public issues or pull requests. Use GitHub's private vulnerability reporting feature when available.

The runner is intended for trusted Worker/Workflow bindings. The example has no public scanning endpoint. If you expose an API around it, authenticate and authorize requests, bound job creation and isolate assessment runs.

Source and npm releases contain code and public upstream release metadata. Cloudflare and npm credentials belong in their native authentication mechanisms or secret stores. Do not commit local configuration containing account-specific credentials.

# PentCloud password

Hashcat with a CPU OpenCL runtime in a separate native Cloudflare runtime. **Unreleased candidate.** Known SHA-256 dictionary profile only; no GPU or long-running cracking promise.

```js
export { PasswordRunner } from '@memrov2/pentcloud-password/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'hashcat',view:'sha256-dictionary'}, {input:hashBytes,dictionary:wordBytes});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

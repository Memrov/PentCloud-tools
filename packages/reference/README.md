# PentCloud reference

Searchsploit and pinned ExploitDB references in a separate native Cloudflare runtime. **Version 0.1.0 SDK.** readSource(path) returns bounded source bytes and SHA-256 from the same pinned revision, without execution.

```js
export { ReferenceRunner } from '@memrov2/pentcloud-reference/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'searchsploit',query:'2.4.49'});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

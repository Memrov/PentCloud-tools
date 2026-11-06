# PentCloud file-analysis

Offline Binwalk in a separate native Cloudflare runtime. **Version 0.1.0 SDK.** Uses pinned distro Binwalk 2.4.3; extraction and recursion are excluded.

```js
export { FileRunner } from '@memrov2/pentcloud-file-analysis/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'binwalk',view:'signatures'}, {input:fileBytes});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

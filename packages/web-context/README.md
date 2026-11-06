# PentCloud web-context

WhatWeb and WaybackURLs in a separate native Cloudflare runtime. **Unreleased candidate.** Private candidate: WaybackURLs has no detected license grant; legacy provider availability is not certified.

```js
export { WebContextRunner } from '@memrov2/pentcloud-web-context/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'whatweb',target:'https://your-authorized-target.example/'});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

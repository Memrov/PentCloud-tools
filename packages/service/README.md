# PentCloud service

Nmap, Naabu and Masscan in a separate native Cloudflare runtime. **Unreleased candidate.** Private candidate: Nmap redistribution terms require review before publication.

```js
export { ServiceRunner } from '@memrov2/pentcloud-service/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'nmap',target:'192.0.2.1',ports:[443]});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

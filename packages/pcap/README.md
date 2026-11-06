# PentCloud pcap

Offline TShark in a separate native Cloudflare runtime. **Unreleased candidate.** Pass a Uint8Array capture from your private evidence store; no live capture.

```js
export { PcapRunner } from '@memrov2/pentcloud-pcap/worker';
const runner = env.TOOL.getByName(runId);
try {
  const result = await runner.run({tool:'tshark',view:'dns'}, {input:captureBytes});
  // Save the result in your existing private assessment store.
} finally {
  await runner.stop();
}
```

Configure the matching named Container image. See [interfaces, build instructions, verification and limits](https://github.com/Memrov/PentCloud-tools/blob/main/docs/remaining-bundles.md) before integration. This package does not deploy or modify PentCloud.

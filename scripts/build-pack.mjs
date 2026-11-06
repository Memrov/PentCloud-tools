import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)),
  name = process.argv[2];
if (
  ![
    "http",
    "nuclei",
    "sqlmap",
    "service",
    "web-context",
    "pcap",
    "file-analysis",
    "password",
    "reference",
    "metasploit",
  ].includes(name)
)
  throw new Error("Select a supported tool pack");
const lock = JSON.parse(
  readFileSync(root + "/packages/" + name + "/tools.lock.json"),
);
function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + " failed");
  return result.stdout;
}
run("python3", ["scripts/prepare-pack.py", name]);
const regctl = process.env.REGCTL || "regctl",
  base = "ocidir://.cache/packs/" + name + "/base:base",
  image = "ocidir://.cache/packs/" + name + "/image:" + name;
run(regctl, [
  "image",
  "copy",
  lock.baseImage,
  base,
  "--platform",
  "linux/amd64",
]);
run(regctl, ["image", "copy", base, image]);
run(regctl, [
  "image",
  "mod",
  image,
  "--replace",
  "--layer-add",
  "tar=.cache/packs/" + name + "/layer.tar",
  "--config-entrypoint",
  '["/bin/sleep","2147483647"]',
  "--config-cmd",
  "",
  "--config-time",
  "set=2026-11-05T00:00:00Z",
  "--label",
  "org.opencontainers.image.version=" + lock.packVersion,
  "--label",
  "org.opencontainers.image.source=https://github.com/Memrov/PentCloud-tools",
]);
run(regctl, [
  "image",
  "mod",
  image,
  "--replace",
  "--config-time",
  "set=2026-11-05T00:00:00Z",
]);
const manifest = run(
  regctl,
  ["manifest", "get", image, "--format", "raw-body"],
  true,
);
const result = {
  packId: name,
  packVersion: lock.packVersion,
  digest: "sha256:" + createHash("sha256").update(manifest).digest("hex"),
  compressedBytes: JSON.parse(manifest).layers.reduce(
    (sum, layer) => sum + layer.size,
    0,
  ),
  platform: lock.platform,
};
writeFileSync(
  root + "/.cache/packs/" + name + "/image-release.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));

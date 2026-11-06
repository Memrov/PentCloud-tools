import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
if (Number(process.versions.node.split(".")[0]) < 26)
  throw new Error(
    "Run development coverage with Node.js 26 or later; the SDK still supports Node.js 22+.",
  );
const output = new URL("../.cache/coverage/", import.meta.url);
mkdirSync(output, { recursive: true });
const python = process.env.PENTCLOUD_COVERAGE_PYTHON || "python3";
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`);
}
run(process.execPath, [
  "--test",
  "--experimental-test-coverage",
  "--test-coverage-include=src/*.mjs",
  "--test-coverage-include-all",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=lcov",
  "--test-reporter-destination=.cache/coverage/javascript.lcov",
  ...["test/commands.test.mjs", "test/runtime.test.mjs"],
]);
run("go", [
  "test",
  "-race",
  "-count=1",
  "-covermode=atomic",
  "-coverprofile=.cache/coverage/go.out",
  "./runner",
]);
run("go", ["tool", "cover", "-func=.cache/coverage/go.out"]);
run(python, [
  "-m",
  "coverage",
  "run",
  "--rcfile=.coveragerc",
  "-m",
  "unittest",
  "discover",
  "-s",
  "test",
  "-p",
  "*_test.py",
]);
run(python, [
  "-m",
  "coverage",
  "xml",
  "--rcfile=.coveragerc",
  "-o",
  ".cache/coverage/python.xml",
]);
run(python, [
  "-m",
  "coverage",
  "report",
  "--rcfile=.coveragerc",
  "--show-missing",
]);
console.log(
  "Coverage reports: .cache/coverage/javascript.lcov, go.out, python.xml",
);

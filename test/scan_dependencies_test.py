"""Exercise the real guard/staging code; external scanners are offline fixtures."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/scan-dependencies.py"


class DependencyScanTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        (self.repo / "scripts").mkdir()
        if SCRIPT.exists():
            (self.repo / "scripts/scan-dependencies.py").write_bytes(SCRIPT.read_bytes())
        self.manifests = {"package.json": {"name": "fixture", "version": "1.0.0", "workspaces": ["packages/*"], "dependencies": {"lib": "1.0.0"}, "devDependencies": {"typescript": "7.0.2"}}}
        self.inventory = {"lib": {"version": "1.0.0"}, "typescript": {"version": "7.0.2"}}
        for number in range(11):
            name = f"@fixture/workspace-{number}"
            self.manifests[f"packages/p{number}/package.json"] = {"name": name, "version": "1.0.0"}
            self.inventory[name] = {"version": "1.0.0"}
        for path, manifest in self.manifests.items():
            file = self.repo / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(json.dumps(manifest))
        (self.repo / "package-lock.json").write_text('{"lockfileVersion": 3}')
        (self.repo / "go.mod").write_text("module example.org/fixture\n")
        (self.repo / "runner").mkdir()
        (self.repo / "runner/main.go").write_text("package runner\n")
        (self.repo / ".gitignore").write_text(".cache/\nnode_modules/\n.env\n")
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        subprocess.run(["git", "add", "."], cwd=self.repo, check=True)
        (self.repo / ".cache").mkdir()
        (self.repo / ".cache/private").write_text("private fixture")
        (self.repo / ".env").write_text("private fixture")
        self.trees = []
        self.results = []
        for target, manifest in self.manifests.items():
            deps = copy.deepcopy(self.inventory) if target == "package.json" else {}
            self.trees.append({**manifest, "dependencies": deps})
            self.results.append({"displayTargetFile": target, "projectName": manifest["name"], "packageManager": "npm", "dependencyCount": len(deps), "ok": True, "hasUnknownVersions": False, "vulnerabilities": []})
        self.trees.append({"name": "example.org/fixture", "version": "", "dependencies": {"go-lib": {"version": "v1.0.0"}}})
        self.results.append({"displayTargetFile": "go.mod", "projectName": "example.org/fixture", "packageManager": "gomodules", "dependencyCount": 1, "ok": True, "hasUnknownVersions": False, "vulnerabilities": []})
        self.bin = self.base / "bin"
        self.bin.mkdir()
        fake = "#!" + sys.executable + "\n" + r'''
import json, os, pathlib, sys
fixture = pathlib.Path(os.environ["SCAN_FIXTURE"])
data = json.loads(fixture.read_text())
repo = pathlib.Path(data["repo"])
if pathlib.Path(sys.argv[0]).name == "npm":
    include = ["--include=dev", "--include=optional", "--include=peer"]
    if sys.argv[1] == "ci":
        base = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]
        assert sys.argv[1:] in [base, base + include], sys.argv
        (repo / "node_modules").mkdir(exist_ok=True)
        if os.environ.get("NODE_ENV") == "production" and "--include=dev" not in sys.argv:
            fixture.with_suffix(".omitted-dev").write_text("yes")
        sys.exit(data.get("installExit", 0))
    base = ["ls", "--all", "--json"]
    assert sys.argv[1:] in [base, base + include], sys.argv
    inventory = data["inventory"]
    if fixture.with_suffix(".omitted-dev").exists() or (os.environ.get("NPM_CONFIG_OMIT") == "dev" and "--include=dev" not in sys.argv):
        inventory.pop("typescript")
    print(json.dumps({"name": "fixture", "version": "1.0.0", "dependencies": inventory}))
    sys.exit(0)
assert sys.argv[1:] == ["test", "--all-projects", "--fail-fast", "--dev", "--strict-out-of-sync=true", "--org=memrov", "--remote-repo-url=https://github.com/Memrov/PentCloud-tools", "--print-deps", "--json"], sys.argv
view = pathlib.Path.cwd()
assert view != repo
assert not (view / "package-lock.json").exists()
assert not (view / ".git").exists()
assert not (view / ".cache").exists()
assert not (view / ".env").exists()
assert (view / "runner/main.go").read_text() == "package runner\n"
for path in data["manifests"]:
    assert (view / path).read_bytes() == (repo / path).read_bytes()
    assert (view / path).parent.joinpath("node_modules").is_dir()
fixture.with_suffix(".view").write_text(str(view))
if data.get("mutateLock"):
    (repo / "package-lock.json").write_text("changed")
output = data["output"]
if fixture.with_suffix(".omitted-dev").exists():
    decoder, values, remaining = json.JSONDecoder(), [], output.strip()
    while remaining:
        value, end = decoder.raw_decode(remaining)
        if isinstance(value, dict) and value.get("name") == "fixture":
            value.get("dependencies", {}).pop("typescript", None)
        values.append(value)
        remaining = remaining[end:].lstrip()
    output = "\n".join(json.dumps(value) for value in values)
print(output)
sys.exit(data.get("scanExit", 0))
'''
        for name in ["npm", "snyk"]:
            path = self.bin / name
            path.write_text(fake)
            path.chmod(0o755)

    def run_scan(self, *, trees=None, results=None, output=None, **options):
        fixture = self.base / "fixture.json"
        values = [*(self.trees if trees is None else trees), self.results if results is None else results]
        fixture.write_text(json.dumps({"repo": str(self.repo), "manifests": self.manifests, "inventory": self.inventory, "output": output if output is not None else "\n".join(json.dumps(value, indent=2) for value in values), **options}))
        env = {**os.environ, "PATH": str(self.bin) + os.pathsep + os.environ["PATH"], "SCAN_FIXTURE": str(fixture)}
        if options.get("ambientProduction"):
            env.update(NODE_ENV="production", NPM_CONFIG_OMIT="dev")
        result = subprocess.run([sys.executable, "scripts/scan-dependencies.py"], cwd=self.repo, env=env, text=True, capture_output=True)
        report = self.repo / ".cache/snyk-installed-inventory.json"
        self.assertTrue(report.exists(), result.stdout + result.stderr)
        if fixture.with_suffix(".view").exists():
            self.assertFalse(Path(fixture.with_suffix(".view").read_text()).exists(), "temporary view leaked")
        return result, json.loads(report.read_text())

    def test_full_scan_checks_tracked_source_and_cleans_temporary_view(self):
        result, report = self.run_scan()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(report["status"], "passed")
        self.assertEqual(len(report["projects"]), 13)
        self.assertEqual(report["npmDependencies"], ["@fixture/workspace-0@1.0.0", "@fixture/workspace-10@1.0.0", *[f"@fixture/workspace-{n}@1.0.0" for n in range(1, 10)], "lib@1.0.0", "typescript@7.0.2"])
        self.assertEqual(report["sourceHashes"], report["sourceHashesAfter"])

    def test_green_twelve_project_scan_missing_root_is_rejected(self):
        result, report = self.run_scan(results=self.results[1:])
        self.assertEqual(result.returncode, 2)
        self.assertIn("target", report["error"].lower())

    def test_production_environment_cannot_drop_development_dependencies(self):
        result, report = self.run_scan(ambientProduction=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("typescript@7.0.2", report["npmDependencies"])

    def test_package_omission_is_rejected_even_when_report_counts_match(self):
        trees = copy.deepcopy(self.trees)
        del trees[0]["dependencies"]["lib"]
        result, report = self.run_scan(trees=trees)
        self.assertEqual(result.returncode, 2)
        self.assertIn("inventory", report["error"].lower())

    def test_missing_submitted_workspace_tree_is_rejected(self):
        result, _ = self.run_scan(trees=self.trees[:1] + self.trees[2:])
        self.assertEqual(result.returncode, 2)

    def test_snyk_workspace_extraneous_diagnostic_does_not_hide_present_identity(self):
        trees = copy.deepcopy(self.trees)
        trees[0]["dependencies"]["@fixture/workspace-0"].update(valid=False, extraneous=True, problems=["extraneous workspace diagnostic"])
        result, _ = self.run_scan(trees=trees)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_empty_submitted_dependency_is_not_treated_as_optional_npm_omission(self):
        trees = copy.deepcopy(self.trees)
        trees[0]["dependencies"]["unresolved"] = {}
        result, _ = self.run_scan(trees=trees)
        self.assertEqual(result.returncode, 2)

    def test_inconsistent_clean_result_and_vulnerability_exit_are_rejected(self):
        result, _ = self.run_scan(scanExit=1)
        self.assertEqual(result.returncode, 2)
        results = copy.deepcopy(self.results)
        results[0]["vulnerabilities"] = [{"id": "fixture-issue", "severity": "high"}]
        result, _ = self.run_scan(results=results)
        self.assertEqual(result.returncode, 2)

    def test_complete_vulnerability_scan_preserves_exit_one(self):
        results = copy.deepcopy(self.results)
        results[0].update(ok=False, vulnerabilities=[{"id": "fixture-issue", "severity": "high"}])
        result, report = self.run_scan(results=results, scanExit=1)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report["status"], "vulnerabilities")

    def test_trailing_non_json_output_and_unknown_versions_fail_closed(self):
        result, _ = self.run_scan(output="{}\nscanner warning")
        self.assertEqual(result.returncode, 2)
        results = copy.deepcopy(self.results)
        results[0]["hasUnknownVersions"] = True
        result, _ = self.run_scan(results=results)
        self.assertEqual(result.returncode, 2)

    def test_malformed_tree_replaces_old_passed_report_with_failure(self):
        result, _ = self.run_scan()
        self.assertEqual(result.returncode, 0)
        trees = copy.deepcopy(self.trees)
        trees[0]["dependencies"]["lib"]["dependencies"] = []
        result, report = self.run_scan(trees=trees)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(report["status"], "failed")

    def test_malformed_graph_package_info_fails_with_fresh_report(self):
        graph = {"schemaVersion": "1.3.0", "pkgManager": {"name": "npm"}, "pkgs": [{"id": "root", "info": {"name": "fixture", "version": "1.0.0"}}, {"id": "lib", "info": []}], "graph": {"rootNodeId": "root-node", "nodes": [{"nodeId": "root-node", "pkgId": "root", "deps": [{"nodeId": "lib"}]}, {"nodeId": "lib", "pkgId": "lib", "deps": []}]}}
        result, report = self.run_scan(trees=[graph, *self.trees[1:]])
        self.assertEqual(result.returncode, 2)
        self.assertEqual(report["status"], "failed")

    def test_graph_json_uses_reachable_packages_and_excludes_root(self):
        pkgs = [{"id": "root", "info": {"name": "fixture", "version": "1.0.0"}}]
        nodes = [{"nodeId": "root-node", "pkgId": "root", "deps": []}]
        for name, package in self.inventory.items():
            identity = name + "@" + package["version"]
            pkgs.append({"id": identity, "info": {"name": name, "version": package["version"]}})
            nodes[0]["deps"].append({"nodeId": identity})
            nodes.append({"nodeId": identity, "pkgId": identity, "deps": []})
        graph = {"schemaVersion": "1.3.0", "pkgManager": {"name": "npm"}, "pkgs": pkgs, "graph": {"rootNodeId": "root-node", "nodes": nodes}}
        result, _ = self.run_scan(trees=[graph, *self.trees[1:]])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        graph["graph"]["nodes"][0]["deps"] = []
        result, _ = self.run_scan(trees=[graph, *self.trees[1:]])
        self.assertEqual(result.returncode, 2)

    def test_authoritative_lock_mutation_fails_and_is_recorded(self):
        result, report = self.run_scan(mutateLock=True)
        self.assertEqual(result.returncode, 2)
        self.assertNotEqual(report["sourceHashes"], report["sourceHashesAfter"])

    def test_install_failure_never_scans(self):
        result, _ = self.run_scan(installExit=1)
        self.assertEqual(result.returncode, 2)
        self.assertFalse((self.base / "fixture.view").exists())


if __name__ == "__main__":
    unittest.main()

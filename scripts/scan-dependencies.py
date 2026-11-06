#!/usr/bin/env python3
"""Scan a clean installed tree and reject incomplete Snyk project/inventory results."""
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile


class ScanError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ScanError(message)


def run(command, cwd):
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True)


def hashes(root, paths):
    return {path: hashlib.sha256((root / path).read_bytes()).hexdigest() for path in paths}


def tree_inventory(tree, installed=False):
    require(isinstance(tree, dict) and isinstance(tree.get("dependencies", {}), dict), "Invalid dependency tree")
    identities = set()
    for name, child in tree.get("dependencies", {}).items():
        require(isinstance(child, dict), "Invalid dependency tree")
        # npm ls represents uninstalled optional platform dependencies as {}.
        if not child:
            require(installed, "Submitted dependency version missing")
            continue
        require(not child.get("missing") and not child.get("invalid") and not (installed and child.get("problems")), "Unresolved installed dependency")
        version = child.get("version")
        require(isinstance(version, str) and version, "Dependency version missing")
        identities.add(f"{child.get('name', name)}@{version}")
        identities.update(tree_inventory(child, installed))
    return identities


def submitted_inventory(document):
    if "graph" not in document:
        require(isinstance(document.get("name"), str) and isinstance(document.get("dependencies"), dict), "Unsupported submitted tree")
        return document["name"], tree_inventory(document)
    graph = document["graph"]
    require(isinstance(graph, dict) and isinstance(document.get("pkgs"), list) and isinstance(graph.get("nodes"), list), "Invalid submitted graph")
    require(all(isinstance(package, dict) and isinstance(package.get("id"), str) and isinstance(package.get("info"), dict) for package in document["pkgs"]), "Invalid submitted package info")
    require(all(isinstance(node, dict) and isinstance(node.get("nodeId"), str) and isinstance(node.get("pkgId"), str) and isinstance(node.get("deps"), list) for node in graph["nodes"]), "Invalid submitted graph node")
    packages = {package["id"]: package["info"] for package in document["pkgs"]}
    nodes = {node["nodeId"]: node for node in graph["nodes"]}
    require(len(packages) == len(document["pkgs"]) and len(nodes) == len(graph["nodes"]), "Duplicate submitted graph identity")
    root = graph["rootNodeId"]
    require(root in nodes, "Submitted graph root missing")
    visited, pending, identities = set(), [root], set()
    while pending:
        node_id = pending.pop()
        if node_id in visited:
            continue
        require(node_id in nodes, "Submitted graph edge missing")
        visited.add(node_id)
        node = nodes[node_id]
        package = packages[node["pkgId"]]
        require(all(isinstance(edge, dict) and isinstance(edge.get("nodeId"), str) for edge in node["deps"]), "Invalid submitted graph edge")
        if node_id != root:
            require(package.get("name") and package.get("version"), "Dependency version missing")
            identities.add(f"{package['name']}@{package['version']}")
        pending.extend(edge["nodeId"] for edge in node["deps"])
    require(visited == set(nodes), "Unreachable submitted graph dependencies")
    return packages[nodes[root]["pkgId"]]["name"], identities


def validate_scan(output, exit_code, manifests, expected, installed):
    require(exit_code in (0, 1), "Snyk scan failed")
    decoder, documents, remaining = json.JSONDecoder(), [], output.strip()
    while remaining:
        value, end = decoder.raw_decode(remaining)
        documents.append(value)
        remaining = remaining[end:].lstrip()
    require(bool(documents), "Snyk JSON output missing")
    results = documents.pop()
    require(isinstance(results, list) and all(isinstance(item, dict) for item in results), "Snyk project results missing")
    targets = [item.get("targetFile", item.get("displayTargetFile")) for item in results]
    require(len(targets) == len(set(targets)) and set(targets) == expected, "Snyk target set is incomplete or unexpected")
    by_name = {}
    vulnerable = False
    for result, target in zip(results, targets):
        manager = "npm" if target in manifests else "gomodules"
        require(result.get("packageManager") == manager, "Unexpected project package manager")
        require(result.get("hasUnknownVersions") is False and not result.get("error"), "Unknown versions or failed project")
        issues = result.get("vulnerabilities")
        require(isinstance(issues, list) and isinstance(result.get("ok"), bool), "Incomplete vulnerability result")
        require(result["ok"] == (not issues), "Inconsistent vulnerability result")
        vulnerable |= bool(issues)
        name = result.get("projectName")
        require(isinstance(name, str) and name not in by_name, "Ambiguous project name")
        if target in manifests:
            require(name == manifests[target]["name"], "Unexpected npm project name")
        by_name[name] = target
    require(exit_code == int(vulnerable), "Inconsistent Snyk exit status")
    submitted, actual = set(), set()
    for document in documents:
        require(isinstance(document, dict), "Unsupported submitted dependency output")
        name, identities = submitted_inventory(document)
        require(name in by_name and name not in submitted, "Unexpected or duplicate submitted dependency tree")
        submitted.add(name)
        if by_name[name] in manifests:
            actual.update(identities)
    require(set(manifest["name"] for manifest in manifests.values()) <= submitted, "Submitted npm project tree missing")
    require(actual == installed, "Submitted npm inventory differs from npm ls")
    return results, actual


def scan(root, report):
    tracked = run(["git", "ls-files", "-z"], root)
    require(tracked.returncode == 0, "Cannot list tracked source")
    paths = tracked.stdout.rstrip("\0").split("\0")
    paths = [path for path in paths if not {".git", ".cache", "node_modules"}.intersection(Path(path).parts)]
    manifests = {path: json.loads((root / path).read_text()) for path in paths if Path(path).name == "package.json"}
    require("package.json" in manifests and "package-lock.json" in paths, "Authoritative root manifest/lock missing")
    require(all(isinstance(manifest, dict) and isinstance(manifest.get("name"), str) and manifest["name"] for manifest in manifests.values()), "Named npm manifests required")
    expected = set(manifests) | ({"go.mod"} if "go.mod" in paths else set())
    source_paths = sorted(set(manifests) | {"package-lock.json"} | ({"go.mod", "go.sum"} & set(paths)))
    report["sourceHashes"] = hashes(root, source_paths)
    revision = run(["git", "rev-parse", "HEAD"], root)
    report["revision"] = revision.stdout.strip() if revision.returncode == 0 else None
    try:
        include = ["--include=dev", "--include=optional", "--include=peer"]
        install = run(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund", *include], root)
        require(install.returncode == 0, "npm ci failed")
        require(hashes(root, source_paths) == report["sourceHashes"], "Authoritative manifest or lock changed")
        inventory = run(["npm", "ls", "--all", "--json", *include], root)
        require(inventory.returncode == 0, "npm ls failed")
        npm_tree = json.loads(inventory.stdout)
        require(isinstance(npm_tree, dict) and not npm_tree.get("problems"), "npm ls reported dependency problems")
        installed = tree_inventory(npm_tree, installed=True)
        report["npmDependencies"] = sorted(installed)
        with tempfile.TemporaryDirectory(prefix="pentcloud-snyk-") as temporary:
            view = Path(temporary)
            for path in paths:
                if Path(path).name == "package-lock.json":
                    continue
                source, destination = root / path, view / path
                require(not source.is_symlink(), "Tracked source symlinks are unsupported")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
            for path in manifests:
                relative = Path(path).parent / "node_modules"
                own = root / relative
                (view / relative).symlink_to(own if own.is_dir() else root / "node_modules", target_is_directory=True)
            result = run(["snyk", "test", "--all-projects", "--fail-fast", "--dev", "--strict-out-of-sync=true", "--org=memrov", "--remote-repo-url=https://github.com/Memrov/PentCloud-tools", "--print-deps", "--json"], view)
            results, actual = validate_scan(result.stdout, result.returncode, manifests, expected, installed)
            report["submittedNpmDependencies"] = sorted(actual)
            report["projects"] = [{key: item.get(key) for key in ("projectName", "packageManager", "displayTargetFile", "targetFile", "dependencyCount", "ok", "hasUnknownVersions")} | {"vulnerabilityCount": len(item["vulnerabilities"])} for item in results]
            report["status"] = "passed" if result.returncode == 0 else "vulnerabilities"
            return result.returncode
    finally:
        report["sourceHashesAfter"] = hashes(root, source_paths)
        require(report["sourceHashesAfter"] == report["sourceHashes"], "Authoritative manifest or lock changed")


def main():
    root = Path(__file__).resolve().parents[1]
    report = {"status": "failed", "platform": f"{platform.system()} {platform.machine()}"}
    try:
        exit_code = scan(root, report)
    except (ScanError, OSError, ValueError, KeyError, TypeError, AttributeError, IndexError, RecursionError) as error:
        # External stdout/stderr may contain authentication data: never save it.
        report.update(status="failed", error=str(error) if isinstance(error, ScanError) else "Invalid scanner output or local scan setup")
        exit_code = 2
    report["exitCode"] = exit_code
    destination = root / ".cache/snyk-installed-inventory.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Snyk installed dependency scan: {report['status']}; report: {destination}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())

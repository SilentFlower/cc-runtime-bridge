#!/usr/bin/env python3
"""用开工前基线补登本项目关联仓库，保留 Flower 运行器的审计与状态写入。"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from copy import deepcopy
from pathlib import Path
from typing import Any

from auto_loop import (
    _append_item_decision,
    _append_manifest_revision,
    _load_blocked_state,
    _protected_drift_present,
    _repo_root,
    _write_state,
)


def git(repository: Path, *arguments: str) -> str:
    """读取指定仓库的 Git 证据。

    @param repository 仓库工作树根目录。
    @param arguments 只读 Git 参数。
    @return Git 标准输出；失败抛出 ValueError。
    """
    result = subprocess.run(["git", "-C", str(repository), *arguments], capture_output=True, text=True)
    if result.returncode:
        raise ValueError("git-evidence-unavailable")
    return result.stdout.strip()


def registrations(root: Path, state: dict[str, Any], baseline: dict[str, Any],
        repositories: list[Path]) -> list[dict[str, Any]]:
    """根据保存的旧基线生成新增仓库记录，全部校验通过后交给调用方写入。

    @param root 当前 Trellis 项目根目录。
    @param state 原生运行器加载的终态记录。
    @param baseline 开工前保存的仓库身份与文件摘要。
    @param repositories 明确请求登记的真实 Git 根目录。
    @return 待追加的仓库记录；任何漂移均抛出 ValueError。
    """
    if state.get("schema_version") != 2 or state.get("profile") != "commit-only":
        raise ValueError("unsupported-run")
    if state.get("status") != "completed_with_blocked":
        raise ValueError("run-not-terminal-blocked")
    if any(item.get("pending_artifact_decision") or item.get("last_action")
            for item in state.get("queue", [])):
        raise ValueError("run-action-pending")
    if _protected_drift_present(root, state):
        raise ValueError("protected-baseline-drift")
    known = {item["root"] for item in state["repositories"]}
    snapshots = {item["root"]: item for item in baseline["repositories"]}
    output = []
    for requested in sorted(set(repositories)):
        repository = requested.absolute()
        if repository.resolve() != repository:
            raise ValueError("repository-symlink")
        key = str(repository)
        if key not in snapshots:
            raise ValueError("repository-missing-from-baseline")
        saved = snapshots[key]
        if git(repository, "rev-parse", "--show-toplevel") != key:
            raise ValueError("repository-root-mismatch")
        if (git(repository, "rev-parse", "HEAD") != saved["head"]
                or not saved["branch"]
                or git(repository, "branch", "--show-current") != saved["branch"]):
            raise ValueError("repository-identity-drift")
        if git(repository, "diff", "--cached", "--name-only") or git(repository, "ls-files", "-u"):
            raise ValueError("repository-index-unsafe")
        for name in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
            path = Path(git(repository, "rev-parse", "--git-path", name))
            if (path if path.is_absolute() else repository / path).exists():
                raise ValueError("repository-integration-pending")
        statuses = {line[3:]: line[:2] for line in saved["status"].splitlines() if line}
        files = {item["path"]: item["sha256"] for item in saved["files"]}
        if set(statuses) != set(files) or any(status not in (" M", "??") for status in statuses.values()):
            raise ValueError("baseline-status-invalid")
        dirty = []
        for name, digest in sorted(files.items()):
            relative = Path(name)
            path = repository / relative
            if relative.is_absolute() or ".." in relative.parts or not path.is_file():
                raise ValueError("baseline-path-invalid")
            if path.resolve() != path.absolute():
                raise ValueError("baseline-symlink")
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise ValueError("retained-content-drift")
            dirty.append({"path": name, "xy": statuses[name], "sha256": digest})
        if key not in known:
            output.append({"root": key, "dirty": dirty, "owned_dirty": [],
                "protected_retained": [{"repository": key, "path": item["path"], "sha256": item["sha256"]}
                    for item in dirty]})
    return output


def main() -> int:
    """校验基线并按显式参数补登仓库，默认仅预览。

    @return 成功返回0，证据或状态异常返回1。
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--baseline-sha256", required=True)
    parser.add_argument("--repository", type=Path, action="append", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        root = _repo_root()
        if root is None:
            raise ValueError("not-trellis-project")
        raw = args.baseline.read_bytes()
        if hashlib.sha256(raw).hexdigest() != args.baseline_sha256:
            raise ValueError("baseline-file-drift")
        path, state = _load_blocked_state(root, args.run_id)
        previous = path.read_bytes()
        added = registrations(root, state, json.loads(raw), args.repository)
        if args.apply and added:
            updated = deepcopy(state)
            updated["repositories"].extend(added)
            for item in updated["queue"]:
                _append_item_decision(item, "project_repositories_registered", "按开工前基线补登关联仓库",
                    {"repositories": [entry["root"] for entry in added], "baseline_sha256": args.baseline_sha256})
            _append_manifest_revision(updated, change_source="project-repositories-registration")
            # 原生写入器负责 manifest 审计、任务游标与原子状态发布。
            if path.read_bytes() != previous:
                raise ValueError("run-state-changed")
            _write_state(path, updated)
        print(json.dumps({"status": "registered" if args.apply else "preview", "run_id": args.run_id,
            "added": [item["root"] for item in added],
            "protected_files": sum(len(item["protected_retained"]) for item in added)}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "error", "reason": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""多仓恢复的旧基线保护与失败关闭验证。"""

import hashlib
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from contextlib import redirect_stdout
from unittest.mock import patch

from project_repositories import main, registrations


class RepositoryRegistrationTests(unittest.TestCase):
    """只使用临时 Git 仓库验证补登边界。"""

    def setUp(self):
        """创建独立仓库和旧文件基线。@return 无返回值。"""
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.repository = self.root / "consumer"
        self.repository.mkdir()
        self.git("init", "-b", "main")
        self.git("config", "user.name", "合成测试")
        self.git("config", "user.email", "synthetic@example.test")
        (self.repository / "code").write_text("初始代码")
        self.git("add", "code")
        self.git("commit", "-m", "合成初始提交")
        (self.repository / "old task").write_text("受保护历史")
        self.state = {"schema_version": 2, "profile": "commit-only", "status": "completed_with_blocked",
            "queue": [{"task": "synthetic", "status": "blocked"}], "repositories": []}
        self.saved = {"root": str(self.repository), "head": self.git("rev-parse", "HEAD"), "branch": "main",
            "status": "?? old task\n", "files": [{"path": "old task", "sha256": hashlib.sha256("受保护历史".encode()).hexdigest()}]}
        self.baseline = {"repositories": [self.saved]}

    def git(self, *arguments):
        """在临时仓库执行测试命令。@param arguments Git 参数。@return 标准输出。"""
        return subprocess.check_output(["git", "-C", str(self.repository), *arguments], stderr=subprocess.DEVNULL).decode().strip()

    def prepare(self):
        """生成纯预览结果。@return 新仓库记录。"""
        return registrations(self.root, self.state, self.baseline, [self.repository])

    def test_original_dirty_is_protected_and_new_work_is_independent(self):
        """旧文件受保护，新代码保持后续任务归属，原状态保持。@return 无返回值。"""
        (self.repository / "code").write_text("新的实现")
        added = self.prepare()
        self.assertEqual([item["path"] for item in added[0]["protected_retained"]], ["old task"])
        self.assertEqual(self.state["repositories"], [])
        self.state["repositories"] = added
        self.assertEqual(self.prepare(), [])

    def test_retained_drift_and_unknown_repository_are_rejected(self):
        """拒绝旧文件漂移及基线外仓库。@return 无返回值。"""
        (self.repository / "old task").write_text("被改写")
        with self.assertRaisesRegex(ValueError, "retained-content-drift"):
            self.prepare()
        with self.assertRaisesRegex(ValueError, "repository-missing-from-baseline"):
            registrations(self.root, self.state, self.baseline, [self.root])

    def test_index_head_and_integration_are_guarded(self):
        """拒绝暂存、身份变更与未完成集成。@return 无返回值。"""
        (self.repository / "code").write_text("变化")
        self.git("add", "code")
        with self.assertRaisesRegex(ValueError, "repository-index-unsafe"):
            self.prepare()
        self.git("commit", "-m", "测试身份变化")
        with self.assertRaisesRegex(ValueError, "repository-identity-drift"):
            self.prepare()
        self.saved["head"] = self.git("rev-parse", "HEAD")
        (self.repository / ".git/MERGE_HEAD").write_text(self.saved["head"])
        with self.assertRaisesRegex(ValueError, "repository-integration-pending"):
            self.prepare()

    def test_running_pending_and_escaping_paths_are_rejected(self):
        """活动动作与越界路径均失败关闭。@return 无返回值。"""
        self.state["status"] = "running"
        with self.assertRaisesRegex(ValueError, "run-not-terminal-blocked"):
            self.prepare()
        self.state["status"] = "completed_with_blocked"
        self.state["queue"][0]["last_action"] = {"action": "commit_only"}
        with self.assertRaisesRegex(ValueError, "run-action-pending"):
            self.prepare()
        self.state["queue"][0].pop("last_action")
        self.saved["status"] = "?? ../outside\n"
        self.saved["files"][0]["path"] = "../outside"
        with self.assertRaisesRegex(ValueError, "baseline-path-invalid"):
            self.prepare()

    def test_cli_previews_and_uses_native_audited_writer_only_after_validation(self):
        """预览保持只读，应用经原生审计写入器且保留队列及授权字段。@return 无返回值。"""
        baseline = self.root / "baseline.json"
        baseline.write_text(json.dumps(self.baseline))
        state_path = self.root / "run.json"
        state_path.write_text(json.dumps(self.state))
        arguments = ["project_repositories", "--run-id", "synthetic", "--baseline", str(baseline),
            "--baseline-sha256", hashlib.sha256(baseline.read_bytes()).hexdigest(), "--repository", str(self.repository)]
        with patch('project_repositories._repo_root', return_value=self.root), \
                patch('project_repositories._load_blocked_state', return_value=(state_path, self.state)), \
                patch('project_repositories._write_state') as writer, redirect_stdout(io.StringIO()):
            with patch('sys.argv', arguments):
                self.assertEqual(main(), 0)
            writer.assert_not_called()
            with patch('sys.argv', arguments + ['--apply']):
                self.assertEqual(main(), 0)
            updated = writer.call_args.args[1]
            self.assertEqual(updated['status'], 'completed_with_blocked')
            self.assertEqual(updated['profile'], 'commit-only')
            self.assertEqual(updated['queue'][0]['status'], 'blocked')
            self.assertEqual(updated['manifest_revision'], 1)
            self.assertEqual(len(updated['repositories']), 1)
            self.assertEqual(self.state['repositories'], [])
            writer.reset_mock()
            baseline.write_text('{}')
            with patch('sys.argv', arguments + ['--apply']):
                self.assertEqual(main(), 1)
            writer.assert_not_called()


if __name__ == "__main__":
    unittest.main()

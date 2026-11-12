# 实际验证记录

- `npm run build --prefix cc2api/web`：Vue/TypeScript与Vite生产构建通过。
- `PYTHONPATH=orchestrator:deploy/v3 .venv/bin/python -m unittest test_content_capture_settings test_system_platform_version test_account_runtime.AccountRuntimeTests.test_content_capture_uses_real_lifecycle_and_preserves_identity test_account_runtime.AccountRuntimeTests.test_native_layout_rebuild_after_quiesce_keeps_busy_sender_protected test_account_runtime.AccountRuntimeTests.test_saved_role_cpu_policy_is_used_when_recreating_containers test_system_release`：20项通过。
- 实际AccountRuntime的合成Docker生命周期验证开启/关闭、sender目录、原身份、内核选择及租约收口；CPU策略重建与签名合同分别回归。
- Rust：management_bridge过滤2项、content_capture_bridge过滤1项、diagnostics_routes_require_admin_and_expose_committed_requests过滤1项通过。`cargo fmt --package claude-code-gateway --check`通过。
- 原环境浏览器17场景通过；联合管理浏览器在Asia/Shanghai、America/Los_Angeles及390/1280px通过，script_errors为空，主动模型调用0。
- 真实前端与原生JS均为本地实际文件，管理API使用合成夹具。报告和截图：bench `.deploy/management-ui/{environment,combined}`。
- `node --check webui/{app,environments,projects}.js`、相关Python语法与git diff空白检查通过。
- 全workspace格式检查因vendor缺失bench/examples和既有格式差异结束；本任务包格式检查通过。

## 最终重检

- FBK-001已修复：采集维护显式使用pending_upgrade(include_preparing=True)，前端同步禁用；17项定向后端回归及最新联合浏览器矩阵通过。
- 原调用默认保持原判定，全部直接引用已核对；后端下载中零租约、零重建、原代次保留均有断言。
- 全面重检通过，CHK/FBK剩余0。5份权威规范已同步，git diff空白检查通过。
- 下一步为精确Git交付。
- 上线后由维护者核对签名制品版本展示与实际空闲账号采集开关回执。

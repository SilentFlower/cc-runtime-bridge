# 实施计划

## 顺序

- [x] 通过任务 Brief 评审后激活任务，进入 `trellis-route(target=implement)` 并完成 `trellis-before-dev`。
- [x] 在 `src/control/header-policy.ts` 增加精确协议字段集合及名单外删除分支，复用既有分类、决策和合并合同。
- [x] 更新 `tests/unit/header-policy.test.ts`，覆盖已准入字段、代理/CDN 与客户端附加头、名单外重复项及名单内冲突。
- [x] 更新 `tests/integration/control.test.ts` 与 `tests/native/native.test.ts`，验证真实控制入口、普通/原生入站、独立 TLS 接收端与日志决策。
- [x] 将 `tests/fixtures/tls-upstream.py` 与 `tests/native/tls-verifier.test.ts` 的响应模式改走已有私有控制通道，继续验证错误、长流、取消与部分读取场景。
- [x] 同步 `AGENTS.md`、`README.md`、`docs/api.md`、`docs/header-policy.md`，明确调用方白名单和运行时自行生成字段的边界。
- [x] 完成下方实现阶段验证。
- [x] 进入 Check-All，按 `trellis-update-spec` 同步已验证合同，再进入精确 Push 计划。

## 验证命令

1. `bun run typecheck`
2. `bun test tests/unit`
3. `bun test tests/integration/control.test.ts --timeout 45000`
4. `bun run test:native`，使用脚本已有的独立网络空间、合成凭据和原版 293。
5. `bun run test:tls`，覆盖迁移后的独立 OpenSSL 接收及原生 TLS 验证器完整套件。
6. `git diff --check` 并搜索本轮范围内残留的“未知头默认保留”说明。

只有发生后续改动、失败或未解决问题时，才重复对应验证。

## 实现阶段验证结果

- `bun run typecheck` 通过；`bun test tests/unit` 为 174 通过；控制服务集成为 21 通过。
- 原版离线套件为 64 通过；该命令中的 46 个可选 TLS 项跳过，由独立 `test:tls` 实际运行并得到 44 通过。两套命令退出码均为 0。
- 默认安装路径的二进制已发生变化，首次原生验证按来源校验拒绝。后续使用 SHA256 恰为 `8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978` 的官方 2.1.293 副本，来源与副本校验记录在 `artifacts/header-whitelist-20261110-ugxlkjnn/runtime.json`。
- 两条原生命令均设置 `CCRB_TEST_CLAUDE_BINARY=/root/project/cc-runtime-bridge/artifacts/header-whitelist-20261110-ugxlkjnn/claude-2.1.293`；`test:tls` 另设置 `CCRB_TLS_REPORT=/root/project/cc-runtime-bridge/artifacts/header-whitelist-20261110-ugxlkjnn/tls-report.json`。日志为同目录 `native.log`、`tls.log`，全程使用脚本的无外网空间及合成凭据。
- `git diff --check`、Python 夹具 AST 语法和 `task.py validate` 通过。现行调用方说明已同步白名单；运行时规范由后续 Update-Spec 更新。

## 收尾检查

- Check-All 采用 full：三件套实现、实现假设及完整性与规范均通过，CHK/FBK 均为 0。复用上述有效命令证据，按 HTTP/信封、控制服务、私有作业、原生合并、独立 TLS 与日志阶段追踪合同。
- Update-Spec 结果为 `written`，仅更新 `.trellis/spec/backend/runtime-contract.md`：替换未知头默认保留规则并补齐六节白名单场景，反向核对源码、测试及 `git diff --check -- .trellis/spec` 通过。
- 进入精确 Push 计划，业务与当前任务记录分别提交。任务进度和完成态由获准 Git 动作成功后的 `task_progress.py write --complete` 统一写入。

## 检查重点

- AC1/AC4：过滤由精确登记集合决定。名单外重复项全部删除，名单内重复和冲突保持明确行为。
- AC2：最终实收缺少代理/CDN、new-api、客户端私有和测试探针头；正文、缓存、会话、父子关系及单次发送保持既有语义。
- AC3：原始入站与过滤决定分别可见，秘密值脱敏和最终采集来源保持既有合同。
- AC5：三个固定 293 可选协议头有定义依据与离线验证，测试模式经私有通道生效。

## 交付边界

- 业务修改围绕请求头准入及必要的离线夹具适配，不加入工具参数校验或正文修补。
- 原版适配器由现有 build 重建。单文件运行时的重新构建、身份接纳和真实部署属于独立交付；旧产物继续保持原身份。
- Git 操作遵守后续精确范围计划，并保护任务创建前已经存在的工作区变更。

# 本地池启动诊断与故障隔离实施计划

## 开工条件

- [x] 读取初始化、TLS、隔离代理、私有帧及 CLI 错误处理定义。
- [x] 保存 48 次研究和观察器证据缺口；历史 503 原因仍未知。
- [x] 收敛 PRD 并明确设计、兼容性和回退边界。
- [x] 从最新三件套生成并展示完整 Brief，用户已明确“确认”。
- [x] 已运行 task.py start，经 trellis-route(target=implement) 解析为内联实施，不派发子代理。

## 执行顺序

1. [x] 实现 local-pool-startup.ts 的合同、白名单、解码及受控错误；定向单元已覆盖未知、扩展字段及合成秘密。
2. [x] 更新 pool-common.ts、local-pool-protocol.ts 的可选 fatal 诊断，集中重建并兼容旧帧；pool-process.ts 的既有失败增加固定代码，不变更等待与关闭行为。
3. [x] local-pool-engine.ts、pool-forwarder.ts、local-pool-driver.ts、pool-network.ts 采集实际阶段，区分初始化与运行期错误，保留已核验子阶段。
4. [x] 将资源创建纳入失败捕获，分别尝试清理全部自身资源且保留首错；不添加重试或放宽 TLS/环境校验。
5. [x] 新增 tests/local-pool/startup.test.ts 等离线故障测试，11 类失败及各自独立恢复、4 实例并发逐次回执通过，实际模型调用 0，未观察到遗留资源；注入只在测试工装。
6. [x] 新增 tests/local-pool/session-isolation.test.ts 及受控 PTY 工装，双客户端各 3 个 Explore 子代理、四类取消/退出及存活会话继续已通过，421 项断言，36 次假池调用、真实调用 0；保存归属和发送证据。
7. [x] 完整回归通过：类型、140 单元、28 集成（含 19 项离线本地池）、56 原生；首次失败证据保留，不用复跑成功替代根因。
8. [x] Check-All、启动诊断规范及业务推送已完成；用户确认的独立任务记录由本次收尾提交同步，既有其他变更保留。

## 验证命令与证据

固定原版：`/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`，2.1.293，SHA256 `8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978`。

1. `bun run typecheck`。
2. `bun test tests/unit`，包含新增诊断、通道及私有帧检查。
3. 定向隔离：`env -i PATH=/root/.bun/bin:/root/.nvm/versions/node/v22.23.4/bin:/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 CCRB_TEST_ORIGINAL_BINARY=/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe unshare --net /root/.bun/bin/bun test tests/local-pool/startup.test.ts tests/local-pool/session-isolation.test.ts --timeout 180000`。用例先启用并核验仅 lo，否则停止。单用例允许 150 秒以容纳十一种故障及独立恢复，其中包含原有 10 秒就绪等待和 3 秒关闭宽限；产品超时不变。
4. 通过 tests/integration/local-pool.test.ts 跑完整离线本地池子套件，外层等待调整为 300 秒以覆盖新增场景，保留已有 26 MiB 和 66 秒场景。
5. `bun run test:native` 检查原生生命周期相关回归；如出现产品跨层变更，按 Check-All 影响分析补充相关集成。

研究回执目录为 artifacts/startup-research-20261107T051108338188Z 与 artifacts/startup-observed-20261107T051534122475Z。实施使用新独立目录，逐次记录阶段/受控代码、模型数、资源清理、独立恢复及证据缺口；不持久化原始 IPC/stderr。

## 风险与回退点

- pool-process.ts 被多个离线工具复用，先通过现有协议检查；两个 fatal 解码器先于消费方接入。
- 初始化与就绪后错误边界明确，避免将已发模型失败误记为零调用。
- 清理只操作本轮拥有的 PID 和目录，不重启用户服务、不复用旧账本。
- 失败注入未通过则先修定向问题，不开始重复耗时回归；回退仅撤销本任务改动，保留 b6312a1 等既有修复及任务基线 20 项变更。

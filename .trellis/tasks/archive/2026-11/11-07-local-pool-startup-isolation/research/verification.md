# 实施验证记录

## 已完成

- 启动诊断及原有池映射定向单元：27 项通过、217 项断言。
- 完整单元：`bun test tests/unit`，140 项通过、730 项断言，退出码 0。
- 类型检查通过；最后完整回归的日志另存 `artifacts/startup-isolation-implementation-20261107T054535598463Z/typecheck.log`。
- 启动故障回归：11 类失败、逐次 11 次独立恢复、4 实例并发通过，含清理回执失败时继续清理及保留首错；逐次零模型调用、未观察到资源遗留。
- 双实际交互客户端：各 3 个实际 Explore 子代理；子代理活动期间强杀、排队取消、活动取消、排队强杀全部通过，421 项断言。假池实收 36 次，逐次 36 份 TLS 样本通过独立 CCH/SHA/归属核验，真实调用为 0。证据：`artifacts/startup-isolation-implementation-20261107T054535598463Z/local-pool-session-isolation-proof.json`。
- 完整集成：28 项通过、119 项外层断言，内含 19 项离线本地池、1127 项断言；原有 26 MiB 与 66 秒场景保留。日志 `integration.log`。
- 固定原版原生：56 项通过、2403 项断言，退出码 0，日志 `native.log`。Python 工装语法检查通过。
- 14 份源文件的最终摘要与验证开始时一致；机器回执为同一证据目录的 `source-manifest.json`、`validation-results.json`。原有 20 项变更保持，暂存区为空，见 `workspace-preservation.json`。
- Check-All：full、三个维度通过，CHK/FBK 均为 0；DOC-001 只校正 PRD/Brief 的实施前历史时点。规范补充已写入 `.trellis/spec/backend/logging-guidelines.md`，六节结构、引用及 diff 检查通过。

## 首次失败与工装修正

- 构建错误：故障注入表明本场景的 Bun.build 会同步抛异常，不能只在返回 Promise 上挂 catch。改用 try/await/catch，同时覆盖失败返回值。初次失败保留于 `artifacts/local-pool-startup-build-sync-failure.json`；按真实参数复核的 API 证据为 `artifacts/local-pool-build-exception-proof.json`。
- 测试假池和录制层默认存在 10 秒 idleTimeout，会提前中断主动闸门；已显式设置 0，与产品手工模式一致。未修改产品请求时限。
- 若过早阻塞首个子代理，会占住单账号串行池，使其余 Agent 的权限辅助请求无法完成。改为第六个独立子代理实际发送时再阻塞，并依据实收会话选择故障客户端，不能只依据测试预设顺序声称六个代理已创建。
- 排队取消已断开时，BridgeService 仍在原串行链轮到该请求后才记录终态。测试先核验实际断开，再放行另一活动会话并核验 canceled、零模型和零账本预留；没有修改产品取消机制。
- 实际终端取消会恢复未完成输入。连续测试先清空编辑框再提交新输入，并只发送一次 Escape，避免多余 Escape 将下一字符解释为组合键。此前同窗口输入拼接不属于跨会话污染。
- 上述 CLI 工装失败各有独立 `artifacts/local-pool-session-isolation-<UUID>.json`，没有以成功复跑覆盖原始回执。

## 仍未确认

- 历史偶发 local_pool_startup/503 根因未知；本轮交付可验证的安全诊断与隔离能力，不能追溯补写原因。
- 原始 UND_ERR_SOCKET 根因仍未知，与初始化失败分别保留。

## 收尾

- Git 计划已确认，业务变更已推送；当前任务记录通过本次独立提交同步完成态及 Close，无需追加产品实现或验证。

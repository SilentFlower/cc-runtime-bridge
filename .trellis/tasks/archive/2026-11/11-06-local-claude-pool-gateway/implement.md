# 本地 Claude Code 常驻池联调实施计划

## 实施顺序

- [x] 用户确认最终 Brief，已执行 task.py start，经 trellis-route 进入内联实施并读取开发规范。
- [x] 补齐启动限定的入站兼容策略，沿 PreparedInput、私有解码和原生正文准备传递，先回归严格默认分支。
- [x] 复用私有通道、隔离驱动与原生 Engine，接通 Node TLS 采集端；新增独立手工预算/账本，保留旧验收限制。
- [x] 提前注册池秘密，接入真实 wire_final 采集和健康能力；采集错误独立显示。
- [x] 新增 scripts/local-pool.ts、package 命令及文档，完成配置校验、离线自检、端口冲突和有界关闭。
- [x] 完成下面离线验证后启动本机实例，仅检查健康/页面，提供 Base URL、临时命令、预算及停止方式，等待用户手工请求。
- [x] 进入 Check-All，修复后执行 Spec 评估及后续交付；不擅自提交或推送。

## 验证

- 基础：bun run typecheck、bun run build、bun run test、bun run test:integration。新变更或失败需要时才重复。
- 入站：扩展 tests/unit/native-input.test.ts，覆盖策略来源、cli/sdk-cli、缺失/有效/重复/损坏 CCH、版本、归因及控制字段；严格默认分支保持。
- 原生：无外网命名空间内用实际 293 客户端、合成池验证单轮、工具调用/结果续轮、取消及重建，核对真实入口和 TLS CCH。
- 转发：扩展 tests/unit/pool-forwarder.test.ts、tests/integration/pool-forwarder.test.ts，验证手工 20 次限制、32768 tokens、旧三次/128 tokens、账本排他、JSON/SSE、超时、无重放。
- 安全与日志：实测错误 CONNECT/普通代理拒绝、worker 无池 Key/宿主代理、完整/跨块凭据回显不泄漏、最终段哈希/来源准确；缺失/截断/失败、off/summary、取消均明确；页面和健康不触发模型。
- 实际启动不运行新 live 验收、不发送真实提示词；由用户自己的 CLI 发起实际池请求。

## 重点范围与回退

- 入站/运行时：src/shared/input.ts、native-input.ts、contracts.ts、protocol.ts、src/runtime/293/job.ts。
- 服务/采集：src/control/server.ts、service.ts、trace.ts，重点回归默认选项。
- 联调：scripts/testing/pool-common.ts、pool-forwarder.ts、pool-driver.ts、pool-process.ts 及新增手工入口，按实际重复做最小复用抽取。
- 固定二进制、参考配置、旧账本只读；8791 历史报告保留；失败仅清理本次进程与临时资源。

## 开工前状态

- 用户已批准实施；所有自动验证继续使用离线模拟池，真实池调用为零。
- 已进入实施。原轻量产物内嵌旧入口，本模式先复用固定原版与最新预加载，不改二进制。

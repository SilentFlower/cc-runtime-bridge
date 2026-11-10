# 执行计划

## 实施顺序

- [x] 最终 Brief 评审后启动任务，进入 trellis-route(target=implement) 和 trellis-before-dev。
- [x] 先核对 shared 合同、原生识别、头策略、服务、日志快照/线程/查询、API 解码及页面定义；明确新增证据、关联视图、来源和失败语义。
- [x] 从固定官方源码及实收样本固化可重复的分类特征，确认动态规则和普通请求反例；建立失败回归后实现 auxiliary/auto_mode 一致上下文。
- [x] 实现有界 Agent 启动证据、脱敏持久化和按会话的只读关联；验证先到/后到、嵌套、冲突、上限、重启和清理，保留历史快照。
- [x] 扩展集中解码和页面的类型/来源/未知展示，验证桌面、手机、安全渲染及旧记录。
- [x] 用实际 293 CLI 完整运行 Agent → 分类 → 子代理 → SubagentHandback 回环，核对入站、TLS、业务字段、SHA/CCH、响应终态及唯一发送；新增真实模型调用为 0。
- [x] 按 Phase 2.1 的 Pre-Check 进入质量检查；通过后评估 Spec 和精确 Git 计划，未经对应确认不提交。

## 验证计划

- `bun run typecheck`，运行受影响的 native-input、header-policy、证据提取及集中解码单测，含部分特征、动态规则、冲突和上限反例。
- 使用现有 `test:native` 入口验证 auxiliary/auto_mode、显式父子上下文及 CCH；依据实际影响选择范围。
- `CCRB_TEST_ORIGINAL_BINARY=<固定原版> bun test tests/integration/local-pool.test.ts` 使用无外网包装器；补入真实 Agent 回传，不以合成上下文代替自动识别。
- 相关日志存储/重启/清理集成及现有 UI 验证，覆盖桌面和 390 像素；保留旧离线/真实账本。

## 边界与回退

- 主要文件：src/shared/contracts.ts、native-input.ts、log-api.ts，src/control/header-policy.ts、service.ts、trace.ts、log-store.ts，web/client.ts；必要时同步运行时构建来源清单和 API/Spec。
- 不改旧任务完成状态、不清理既有未提交文件、不改用户 CLI。可选字段允许旧记录缺失；归因损坏明确展示缺口，不回退到伪造信息。

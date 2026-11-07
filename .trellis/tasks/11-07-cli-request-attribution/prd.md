# 修复实际 Claude Code 请求归因与代理关联

## 目标

让本地日志正确区分实际 Claude Code 自动权限分类调用，并为子代理展示有证据的父子关联、类型及缺失状态，便于排查实际调用。

## 背景与证据

- 来源：用户要求修复上一轮主动联调发现的两项问题；报告为 `../11-07-pool-connection-recovery/active-cli-verification.md`。
- F1：分类请求 `500fb04f-c546-49ef-a407-819f972681ae`、`1b0accb6-b906-45d3-962a-263bcef6af91` 被记录为 main / repl_main_thread。`src/control/header-policy.ts:56`、`:65` 缺省按主请求处理；固定原版 Rdo 的实际分类构造使用 querySource=auto_mode。
- F2：子代理 `2992584b-09da-45b4-a9a5-aed85db6ba05` 保留了 session、agent ID、子代理 billing，但入站没有 parent-agent-id / agent-type；`:68` 的 agent:custom 回落不能证明实际类型是自定义代理。
- 只读重放已从同会话、匹配的 Agent tool_use / tool_result 找到该子代理的启动证据与 Explore 类型，见 `research/replay-proof.json`。不是每个请求都有此类证据。
- 入口、快照、详情及页面分别位于 `src/control/service.ts:102`、`src/control/trace.ts:57`、`src/control/log-store.ts:146`、`web/client.ts:134`。

## 需求

- R1：已验证的固定官方 2.1.293 自动权限分类调用归为 auxiliary，标明用途与识别来源；筛选、详情和当前运行时上下文一致。
- R2：结合固定版本构造证据及完整请求结构识别，兼容实收的动态权限规则段；普通消息提到分类、block、Agent 或只有相同 stop 字段不得误识别，未验证变体不冒充已识别分类。
- R3：显式父代理 ID、类型优先；缺失时仅由同会话、同 agent ID、匹配的 Agent 调用和成功启动结果恢复日志关联，标明客户端工具结果来源、证据请求及 tool_use_id。
- R4：无证据、冲突、采集不全、证据过期或被清理时明确展示状态；不能把缺失类型显示为已知自定义类型，不能只凭 session ID 或提示词猜直接父代理。
- R5：后到证据只补充日志视图，不覆盖原始上下文、历史采集或已发送请求头；不修改用户的官方 CLI。
- R6：兼容旧日志和 off/summary/debug；必要关联元数据不依赖调试正文长期留存，不保存完整工具输出或秘密。解析/关联失败不阻塞模型，不触发重放。

## 验收条件

- [x] AC1 / R1–R2：实际 CLI 发起 Agent、SubagentHandback 时，分类请求为 auxiliary，用途与来源可见；实收动态规则变体通过。
- [x] AC2 / R2：普通消息、工具续轮、关键词、单字段匹配、错误版本及损坏特征不误分类；显式上下文冲突按既有规则处理。
- [x] AC3 / R3：实际子代理报告送达主会话，关联视图可据启动结果展示父代理、Explore 类型和证据；覆盖证据先到/后到、多子代理、嵌套父子及跨会话同 ID。
- [x] AC4 / R4–R6：缺失、冲突、提取/查询上限、重启、清理、summary、off、旧记录有明确结果，不伪造信息或重写历史采集。
- [x] AC5 / R5–R6：入站、TLS 实收和响应比较通过；业务正文、已有显式关联、头策略及 SHA/CCH 保持，每个入站最多一次池发送。
- [x] AC6：类型检查、相关单测/集成/原生和桌面/390 像素页面验证通过；实际 CLI 验收使用合成凭据、独立 HOME/config 和无外网回环，新增真实模型调用为 0。

## 范围外

- 原始 UND_ERR_SOCKET、真实池/代理调整、分类计费合同、额外付费测试和未验证 CLI 版本。
- 保证恢复从未提供或已失去证据的完整代理树；修改用户 CLI；伪造过去已发送的关联值或回填旧采集。既有任务与未提交文件保持各自归属。

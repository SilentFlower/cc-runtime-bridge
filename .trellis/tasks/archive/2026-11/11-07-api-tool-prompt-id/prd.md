# 修复普通 API 工具续轮 Prompt ID

## 目标与范围

落实父任务 R3/A2：完整工具往返历史能把本次有效 Prompt ID 传到原生轮次和最终头。负责 src/runtime/293/cli.ts、tests/native/native.test.ts、相应单元夹具与运行时规范/API 说明。

## 已确认事实

P2：cli.ts:98 只向末条消息写入 ID。固定 293 的用户轮次选择排除含 tool_result 的记录，导致以前的用户实体没有 ID；真实续轮 plain-api-tls-tool-followup-7d63f7ae 在组装与最终阶段均无 prompt 头。完整链路见父任务 research/review-prompt-id-cause.json。

## 需求

- R3.1：把 context.promptId 绑定本次历史中最近的、官方可识别的真实用户轮次；工具结果保持工具结果语义，业务历史与顺序不改。
- R3.2：同一作业内日志、原生轮次和最终 x-claude-code-prompt-id 一致；调用方显式复用 promptId 时可延续同一工具往返。
- R3.3：省略 promptId 继续逐请求生成；不把 sessionId 当 promptId，不复用旧原生根。仅含工具结果而无可定位用户轮次的历史返回明确 unsupported_parameter/422，零发送。
- R3.4：普通消息、子代理/工作流/压缩/辅助/侧答及原生 CC 入站的已有归因保真不回归。

## 验收

- A3.1 显式 ID、自动 ID、多个工具往返、混合文本/工具结果均验证最终头与发生时上下文；通过原版实际回环验证。
- A3.2 无可归属用户轮次、冲突和不完整上下文不猜测，明确失败且零出站。
- A3.3 六类上下文、同会话新根、原生 CC 业务保真、单次发送以及 off/verify 验收通过。

## 交付顺序与范围边界

按父任务先完成日志原子性，再执行本项；不引入跨请求历史库，不调整请求类别或手工重算 billing/CCH。

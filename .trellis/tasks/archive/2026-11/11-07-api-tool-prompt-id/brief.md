# Brief — 工具续轮 Prompt ID

## Goal

- 普通 API 工具续轮的日志、原生轮次与最终请求头使用一致的有效 Prompt ID。

## Scope

- 普通 API 消息实体归因、原版回环测试及接口和运行时说明。

## Non-Goals

- 跨请求历史库、复用旧原生根或手工重算 billing/CCH。

## Technical Overview

- 将 ID 绑定到最近的实际用户轮次，保留工具结果语义，由官方构造器生成对应头。

## Context & Decisions

- 显式 ID 可由调用方跨工具往返复用；省略时仍逐请求生成，sessionId 不代替 promptId。

## Risks

- 无可归属用户轮次的历史会明确返回 422，零发送；此兼容边界写入接口说明。

## Acceptance

- 显式/自动 ID、多轮工具、混合内容、六类归因及原生 CC 保真在 off/verify 下通过。

## Next Step

- 日志子任务验证后，激活本项并补工具续轮归因回归。

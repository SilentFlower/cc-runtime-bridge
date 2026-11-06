# Brief — 可选 sub2api 缓存断点策略

## Goal

- 为未自主管理消息断点的请求提供显式可选的 sub2api 尾部选点。

## Scope

- 缓存配置、选点、策略诊断、worker 能力校验和精简构建验收。

## Non-Goals

- 强制覆盖调用方断点、增加 system/tools 断点、会话主线存储及付费命中率实验。

## Technical Overview

- 可优化时选最后一条消息的可缓存块；消息至少四条时再选倒数第二条 user，尾部优先、总预算四个。
- 新标记默认 1h；前置标记为 5m 或省略 TTL 时新标记用 5m。仅转换实际选中的字符串消息，thinking、图片和 tool_use 不作为候选。

## Context & Decisions

- 默认 preserve；显式 sub2api 仍保留调用方已有消息断点、TTL/scope。根缓存、预算不足或不支持形态保持原文并说明。
- 普通 API 仅在没有调用方消息标记时替换 SDK 自动消息标记；日志区分应用、保留和跳过，最终 CCH 仍由原生生成。

## Risks

- 策略影响最终正文，必须在原生封口前应用并由真实接收样本验证 CCH。

## Acceptance

- 覆盖短长历史、工具结果、thinking、图片、混合 TTL、预算及原有标记；默认行为和历史日志兼容。
- 原版、精简两条路径的实际出站和 CCH 正确；旧产物不能静默忽略显式 sub2api。

## Next Step

- 实现共享策略类型、配置解析和能力握手。

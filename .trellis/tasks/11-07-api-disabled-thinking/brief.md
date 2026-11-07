# Brief — 保留显式关闭 thinking

## Goal

- 普通 API 明确的 thinking: disabled 能保留到最终出站。

## Scope

- 参数保留处理、对应测试与合同说明，以及三项修复的联合验收。

## Non-Goals

- temperature/强制工具的通用兼容扩展、修改官方二进制及旧精简产物重发版。

## Technical Overview

- 只补完整对象恰为 {type: disabled} 且被原生省略的情况，同步发送正文后做保留校验，再经同一次官方传输发送。

## Context & Decisions

- 固定官方 293；省略仍用原生默认，原生 CC 入站保真；其它不支持形状保持明确拒绝。

## Risks

- 池可能不遵守关闭，参数写出与上游语义分别报告；真实验收最多四次、每次 max_tokens=128，首错停止。

## Acceptance

- 回环核对 JSON/SSE/工具历史与 TLS 哈希；再用当前 deepseek-flash 池做受控联合验证，保留 8787 历史日志并保持 TLS verify。

## Next Step

- 前两项验证后，激活本项并补显式 disabled 的发送回归。

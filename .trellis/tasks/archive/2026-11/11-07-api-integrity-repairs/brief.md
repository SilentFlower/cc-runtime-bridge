# Brief — 普通 API 完整性三项修复

## Goal

- 修复 thinking 参数、日志快照与工具续轮归因三个已确认问题。

## Scope

- atomic-log-snapshots、api-tool-prompt-id、api-disabled-thinking 三个子任务和联合验收。

## Non-Goals

- 通用参数扩展、旧池连接异常、本机上下文隔离改造和升级官方运行时。

## Technical Overview

- 先稳定事务日志，再校准真实轮次 ID，最后保留显式 disabled 并核对原生发送与 TLS 采样。

## Context & Decisions

- 保持官方 293、唯一发送、原生身份及 CCH、现有日志字段与历史；各子任务独立实现和验证，最终生成分组精确提交计划。

## Risks

- 无用户轮次历史将明确拒绝；上游可能不遵守 disabled。真实新预算最多四次，每次输出上限 128，首错停止。

## Acceptance

- 三个子任务的并发/故障、六类归因、普通/原生输入、off/verify 和联合页面验收完整记录；池语义失败单列。

## Next Step

- 三项已按同批批准完成实现和联合验收；展示精确 Git 计划，确认后统一同步子任务及父任务完成记录。

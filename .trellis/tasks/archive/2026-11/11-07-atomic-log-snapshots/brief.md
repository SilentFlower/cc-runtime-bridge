# Brief — 日志快照原子性

## Goal

- 请求状态与采集阶段始终来自同一已提交快照。

## Scope

- 日志写入、详情读取及相应测试和日志规范。

## Non-Goals

- 数据库迁移、历史回填及模型参数修改。

## Technical Overview

- 正文先准备，请求行和阶段索引同一事务提交；详情元数据同一读快照取得后异步读取正文。

## Context & Decisions

- 已用实际 LogStore 复现 success 与旧 incomplete 混读；保留异步写线程和响应热路径。

## Risks

- 写入故障必须整组回滚，旧正文仍可读，失败后孤儿文件按现有规则清理。

## Acceptance

- 并发读取与 SQL 故障回滚通过；存储、相关集成、类型检查和构建通过。

## Next Step

- 激活此子任务，先补能复现旧问题的回归测试。

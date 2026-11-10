# Brief — 入站请求头协议白名单

## Goal

- 采用协议白名单，统一过滤代理、CDN、new-api 和其他客户端的额外请求头。

## Scope

- 普通 API 与原生 CC 入站的头部准入、处理日志、说明文档及离线验证。
- TLS 测试夹具的响应模式迁移到现有私有控制通道。

## Non-Goals

- 工具参数校验、正文自动修补、版本升级、单文件运行时重新发版及真实账号推理。

## Technical Overview

- 在统一 `prepareInput` 边界登记精确字段，名单外头逐项删除并记录原因；名单内字段沿已有重复、版本和上下文规则处理。
- 原生运行时继续生成鉴权、身份和传输头。请求正文与上游响应沿已有合同处理。

## Context & Decisions

- 依据为 vm2api、既有抓包和固定 293 源码，研究只记录头名与来源阶段。
- 可透传或进入版本适配的字段：`accept`、`accept-language`、`cache-control`、`anthropic-version`、`anthropic-beta`、`anthropic-dangerous-direct-browser-access`、`x-claude-code-prev-tool-durations`、`x-claude-code-compaction`、`x-claude-code-context-compacted`。
- 六个已登记的会话、分类及父子代理字段继续提取上下文。UA、Stainless、鉴权与传输字段继续按运行时归属处理。
- 用户已选择名单外附加头统一过滤。未来新增扩展头通过显式登记接纳。

## Risks

- 依赖任意自定义头透传的调用方会受到这次兼容行为调整影响。
- TLS 夹具迁移需要保持错误、长流、取消与部分读取场景的真实验证能力。

## Acceptance

- 普通 API 与原生 CC 的最终 TLS 实收均符合白名单，支持大小写、合法多值与既有主子代理关联。
- 入站采集及每项过滤原因可见，正文、缓存与单次发送符合原合同。
- 类型检查、单元、控制服务集成、原版离线与最终 TLS 验证通过。

## Next Step

- 激活任务并实现统一入口的请求头白名单。

# Brief — 本地 Claude Code 常驻池联调入口

## Goal

- 启动本机服务，让你的 Claude Code 通过 Base URL 请求并查看入站、真实出站和响应。

## Scope

- 常驻 API 与日志页、293 自定义 Base URL 入站兼容、TLS 采集及 deepseek-flash 转发。
- 提供 Bash/PowerShell 临时配置与停止方式。

## Non-Goals

- 真实 Anthropic、OAuth、多账号、公网部署、其他 CC 版本及运行时压缩改动。

## Technical Overview

- Claude Code → 本地接口 → 隔离的固定运行时 → TLS 实收采集 → deepseek-flash。

## Context & Decisions

- 已启动 http://127.0.0.1:8787；健康接口及 Windows PowerShell 回环访问均返回 200。
- 离线实测发现自定义 Base URL 请求缺少 CCH，--print 标为 sdk-cli；需补兼容，最终出站仍由实际 CLI 运行时生成。
- 本地联调先复用已校验原版 293 和当前预加载；现有轻量文件内嵌旧入口，本轮不改二进制。
- 本次最多 20 次转发，单次 max_tokens 上限 32768、池超时 30 秒；池 Key 只在采集转发侧持有，遥测关闭。

## Risks

- 客户端自动重发会消耗预算；池可能拒绝部分原生扩展，保留实际错误供观察。

## Acceptance

- 真实 293 客户端配合离线模拟池通过单轮、工具续轮及取消验证。
- 页面展示脱敏入站与 TLS 实收最终出站，凭据不泄漏；默认严格入口和旧验收限制保持。
- 自动验证和实际启动不产生真实推理，留下运行服务等待你手工请求。

## Next Step

- 确认后激活任务并开始实现。

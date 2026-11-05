# 项目约定

- 用户交流、项目说明和新增代码注释使用中文。
- 使用现有类型或函数前先读取定义；新增合同必须先明确字段、语义和失败行为。
- 固定官方运行时的版本、二进制校验值和采集位置；不能以修改版本字符串替代兼容验证。
- 主会话、子代理、工作流和压缩请求按实际上下文处理，保持头部、metadata、billing 及父子标识一致。
- 合法端到端扩展头默认保留，删除、重建和拒绝均须有明确原因；日志脱敏独立于转发策略。
- 中间组装值不能称为最终出站值；缺失、截断和采集失败必须可见。
- 默认使用合成凭据及离线回环验证，不在测试中自动触发真实账号或付费推理。

<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

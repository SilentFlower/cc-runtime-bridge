# 本地 Claude Code 常驻池联调入口

## Goal

让本机 Claude Code 通过回环 Base URL 请求固定 293 运行时，经本地 TLS 采集转发至 deepseek-flash，并查看脱敏入站与真实出站。

## Background

- 用户要求启动本机服务，由自己的 Claude Code 指向该 Base URL 手工联调；沿用此前选择的池 Messages 接口与 deepseek-flash。
- src/control/server.ts:101 有常驻 API 和日志页，但无池转发模式。scripts/test-pool.ts:72 和 scripts/testing/pool-driver.ts:61 是有限场景验收流程，真实池上限三次、每次 128 输出 tokens。
- 本次隔离离线探针使用本机 2.1.293 的 --print 客户端，自定义 Base URL 后实收 billing 不含 CCH、入口为 sdk-cli、max_tokens=32000；src/shared/native-input.ts:35 首先拒绝缺失 CCH，随后还有 cli 检查。证据见 research/baseurl-shape.json，真实上游调用为零。

## Requirements

- R1：新增本地常驻池联调命令，API 与现有日志页监听 127.0.0.1:8787，端口冲突明确失败。
- R2：仅显式本地模式接纳固定 293 自定义 Base URL 请求的 cli/sdk-cli、缺失 CCH 形状。有 CCH 时仍检查形状，重复、损坏、错误版本、关联冲突和本机控制字段继续拒绝。普通启动保持严格校验。
- R3：保留业务正文、工具及缓存位置，省略 tools 仍表示无工具。出站采用固定运行时实际 CLI 上下文，由原生传输生成最终 CCH，不能人工补算或替换日志标签冒充。
- R4：池地址、根 model=deepseek-flash、鉴权只在 TLS 采集端映射。原生侧独立 HOME/config、合成凭据、遥测 off、仅回环网络；池 Key 不进入工作进程，不访问真实 Anthropic。
- R5：本次手工运行最多 20 次池转发，单次 max_tokens 上限 32768、池超时 30 秒。超限明确拒绝，不裁剪正文；每个入站最多一次转发，无服务端重试或模型回退，客户端重发计入新调用。启动、自检、健康和页面刷新不产生真实推理。
- R6：现有日志页展示脱敏原始入站、发送前参数、TLS 实收的最终 CC 出站及逻辑响应。最终采集点在池映射之前，池映射有明确说明，不能称为池端实收；缺失、截断和失败可见。
- R7：日志保存前注册池秘密，继续遵守 debug/summary/off 和保留上限。仅经过采集自检的本地实例报告最终采集能力，普通实例不受影响。
- R8：离线验证后留下实际运行的服务，提供 Bash/PowerShell 临时配置及停止方式，不改用户永久配置，不覆盖历史账本。

## Acceptance Criteria

- [x] A1（R1、R8）：本机端口、健康接口及日志页可用，交付准确 Base URL、预算与停止方式。
- [x] A2（R2、R3）：实际 293 客户端离线单轮和工具续轮通过；覆盖 cli/sdk-cli、缺失/有效/损坏 CCH、归因和 tools 省略；严格默认分支保持。
- [x] A3（R4）：离线池验证约定映射、非零正确原生 CCH、驱动/worker 无池 Key 及宿主代理，错误 CONNECT 和普通代理被拒绝。
- [x] A4（R5）：20 次限制、32768 tokens 边界、超时、JSON/SSE、取消与重发结果可审计；第 21 次不调用池，旧验收三次/128 tokens 保持。
- [x] A5（R6、R7）：真实最终段来源/哈希准确，缺失不补造；合成池完整及分块回显凭据不落盘，刷新和健康不增加模型调用。
- [x] A6（R8）：自动验证全部离线，实际启动后保持零真实推理，等待用户手工 CLI 请求。

## Non-Goals

- 不接入真实 Anthropic、OAuth、多账号、公网部署或其他 CC 版本。
- 不改池服务、参考配置、固定二进制和压缩方案，不自动发起新的真实池验收。
- 不伪造 token 计数，未支持端点明确报错；池不兼容的字段保留并显示实际失败。

# 请求头策略

本文件描述首版实现合同，对应 src/control/header-policy.ts 和 src/runtime/293/preload.ts。

## 原则

普通端到端扩展头默认保留。过滤依据明确的删除规则和字段归属，不能因为某个头未登记就静默丢弃，也不能笼统删除 x-claude-code-*。

转发黑名单与日志脱敏规则独立：允许转发不代表允许把秘密值写进日志。

## 处理顺序

1. 验证头名与头值格式，保留有序多值输入。
2. 解析 Connection 的全部值，删除其中声明的字段，再删除 Connection 本身。
3. 删除固定连接级字段和调用方鉴权字段。
4. 提取调用语义，验证单值字段冲突或不支持的上下文。
5. 将上下文交给官方构造流程，由运行时生成其拥有的字段。
6. 合并其余扩展头，逐项记录保留、删除、重建或冲突的原因。

## 字段归属

| 字段 | 行为 |
| --- | --- |
| Connection 及其声明的字段 | 删除 |
| Keep-Alive、Proxy-Connection、TE、Trailer、Transfer-Encoding、Upgrade | 删除或由实际发送连接重建 |
| Authorization、X-Api-Key、Proxy-Authorization、Cookie | 删除调用方值，上游凭据来自账号运行环境 |
| Host、Content-Length、Content-Encoding、Content-Type、Accept-Encoding | 由实际目标、正文和原生传输生成 |
| User-Agent、X-App、X-Stainless-*、X-Client-Request-Id | 使用实际运行时生成值，避免输入版本或重名请求标识覆盖原生值 |
| x-claude-code-request-class | 映射调用上下文，再由原生链路生成 |
| x-claude-code-agent-id、x-claude-code-parent-agent-id、x-claude-code-agent-type | 保留调用关联语义 |
| x-claude-code-session-id、x-claude-code-prompt-id | 与内部会话、metadata、billing 一起对齐 |
| anthropic-beta、anthropic-version | 交由版本适配器处理，不支持的组合明确报错 |
| 其余合法端到端头 | 默认保留 |

匹配大小写无关，删除覆盖同名头的全部实例。多值按字段语义处理；冲突的单值上下文或原生接口无法正确表达的重复字段应明确报错，不能静默取最后一个值。

扩展头不能指定任意目标 origin、代理、凭据来源或运行时控制配置。

## 分类与关联

- 官方 293 的已知类别为 main、subagent、workflow、compaction、auxiliary、side_reply。
- 已有子代理、工作流或压缩语义时保留原类别，不统一改成 main。
- 类别、agent 类型、agent ID、父 agent ID、会话及 billing 子代理标记作为一组处理。
- 如需映射标识，须稳定映射整个关联链；不默认重铸全部标识。
- 普通 API 无来源分类时，可以建立桥接器自己的普通主调用上下文，日志标明来自默认值。
- 普通主来源为 repl_main_thread，human 只用于实际主会话用户输入；工具结果、代理和辅助消息不借用 human 来源。
- 当前版本不能表达的显式上下文明确拒绝，不靠改名掩盖。

子代理须提供 agentId，workflow 还须提供 workflowRunId。promptId 必须为 UUID；不提供时由桥接器生成。独立 root agentId 通过 context.agentKind=main 明示。main 与显式子代理上下文冲突时返回错误，不能猜测调用身份。

anthropic-version 必须与原生值一致；anthropic-beta 只能要求本次原生构造已经生成的能力。未知端到端头仍会保留，但额外 beta 无法由当前原生参数表达时返回 422，不附加未验证能力。

## 正文与最终发送

请求头黑名单不决定哪些 JSON 字段可以丢弃。正文逐字段适配，无法支持的显式参数明确报告。

293 的 JS 参数可能仍含 cch=00000，原生链路会继续处理。此前的参数不能冒充最终正文，实际长度与编码由最终发送链路决定。

User-Agent 由原生 CLI 生成，不主动附加 SDK client-app。CLI 的交互请求构造与 -p 打印模式有不同提示词和上下文；仅出现 cc_entrypoint=cli 不能证明内容对齐。本机 TLS 接收端的 wire_final 样本与 cc_prepared、生产自动采集能力分别记录，历史样本保留原值。

## 规范依据

- [RFC 9110，第 7.6.1 节](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.6.1)：Connection 字段及连接级字段处理。
- [RFC 9112，第 6.3 节](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)：消息长度和传输编码规则。

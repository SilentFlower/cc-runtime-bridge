# 固定 293 原生运行时合同

## Scenario: 结构化 API 到单次原生发送

### 1. Scope / Trigger

- 新增 HTTP API、私有 JSONL 和原生 SDK 适配，属于跨层执行合同。
- 实现依据：src/shared/input.ts、src/control/header-policy.ts、src/control/engine.ts、src/runtime/293/preload.ts。
- 版本只由 src/runtime/profile.ts 定义；内部绑定依据该二进制实测，不得猜测混淆符号。

### 2. Signatures

- parseInput(raw: unknown, incomingHeaders: HeaderPair[] = []): BridgeInput。
- prepareInput(input: BridgeInput): PreparedInput。
- NativeEngine.run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void>。
- POST /v1/messages 接收正文；POST /api/requests 还接收 schema_version、request_id、body、headers、context。
- decodeRuntimeEvent(line: string, requestId: string): RuntimeEvent 是私有事件唯一解码入口。

### 3. Contracts

- 固定官方 2.1.293，SHA256 为 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。启动及每个作业校验；官方程序与提取源码不提交。
- 原生模式显式提供 CCRB_CLAUDE_BINARY、CCRB_CLAUDE_HOME、CCRB_CLAUDE_CONFIG_DIR；可提供 CCRB_NATIVE_API_KEY、CCRB_NATIVE_OAUTH_TOKEN、CCRB_PROXY_URL、CCRB_CA_FILE。子进程使用环境白名单。
- 每个作业一个官方进程，服务串行执行，最多 16 个执行中或排队作业；关闭服务后不再接收作业。
- 请求只支持 docs/api.md 登记的正文键。内部 Re/Kc 负责消息实体；原生规范化后的显式消息、工具、thinking 等必须保留，不可表达时拒绝。
- K_t 先完成构造并在发送前中止；yN 创建官方 SDK，按明确 stream 标志通过 Ree 实际发送一次。maxRetries=0；不得替换全局 fetch 或让 SDK 消费、重试原始响应。
- JSONL 绑定 schema_version=1、request_id；事件包含 ready、cc_prepared、response_headers、response_chunk、completed、error。首版 attempt=1，片段使用可逆 base64。
- cc_prepared 的 body_bytes、body_sha256 对应原始观测正文，headers 只在私有管道传递，控制层注册秘密后脱敏存储。stdout 不兼任普通日志。
- Connection 声明字段和连接级字段删除；调用方凭据不作为上游凭据；版本、传输、X-Stainless-*、X-Client-Request-Id 等由运行时生成。其余合法端到端扩展默认保留，不允许笼统删除 x-claude-code-*。
- 上下文为类别、agentKind、agentId、parentAgentId、agentType、sessionId、promptId、workflowRunId 的同一来源。promptId 必须为 UUID。
- 类别支持 main、subagent、workflow、compaction、auxiliary、side_reply。子代理必须有 agentId；workflow 还需要 workflowRunId；主代理独立 agentId 须显式 agentKind=main。
- 响应逻辑字节原样返回，删除不匹配逻辑正文的长度、编码及连接字段。工具交给调用方，不注册本地执行器。取消解除待消费片段并收口原生进程，不重放模型请求。
- 新增公共类、接口和公开方法写中文 JSDoc；导入或调用现有内部接口前读取定义与实测证据。

### 4. Validation & Error Matrix

| 条件 | 行为 |
| --- | --- |
| 不支持的正文键、system 缓存参数、beta 或原生无法保留的显式值 | 422，发送前拒绝 |
| 上下文冲突、非法头、无效 promptId | 400 |
| 重复 request_id | 409，不覆盖已有记录 |
| 队列已满 | 429 |
| 原生初始化时配置或二进制 hash 不匹配 | 失败类型 status=503，不能暗中回退 demo |
| 作业期间二进制 hash 改变 | 当前请求失败，不执行变更后的程序 |
| HTTP 上游错误 | 保留原始状态和正文，不重试 |
| 本地异常发生在响应头之后 | 结束逻辑流，日志记录错误；不拼接伪造 SSE |
| 原生接口不匹配或协议格式错误 | 明确失败，不猜字段或符号 |

### 5. Scenarios and Examples

- 正常：普通正文无来源上下文，生成 main，source=bridge-default；原生 metadata.user_id 内的 session_id、请求头和 billing 的 cc_prompt_id 关联一致。
- 边界：子代理发生压缩，requestClass=compaction，仍保持子代理 agentContext 和父子关系。
- 错误用法：子代理只强行声明 requestClass=main；这样会使身份与 billing 矛盾。正确做法是保留 subagent 和真实关联，冲突明确拒绝。
- 错误用法：将整个 API JSON 转成 prompt，或收到 tool_use 后本地执行。正确做法是结构化映射，单轮返回原始工具事件。
- 演示必须显式选择 demo；它只产生合成内容，不能作为原生发送证明。

### 6. Tests Required

- tests/unit/header-policy.test.ts：未知头保留、动态 Connection 删除、凭据/原生请求 ID 归属、冲突与默认来源。
- tests/unit/profile.test.ts：错误二进制不执行、不回退。
- tests/native/native.test.ts：无外网 TLS 上游独立核对 CCH、metadata/session/prompt、六类请求、thinking/工具历史、非流式、HTTP/SSE 错误及取消后下一请求；实际模型发送次数必须符合 attempt=1。
- 原生验证仅使用专用 HOME、合成凭据和 unshare 网络命名空间；不能因测试失败切换真实账号。

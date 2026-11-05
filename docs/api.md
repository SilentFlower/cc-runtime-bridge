# 接口合同与配置

## 请求入口

POST /v1/messages 接收 JSON Messages 正文。POST /api/requests 还支持下列信封；两者使用相同的校验和执行链路：

    {
      "schema_version": 1,
      "request_id": "request-001",
      "body": {
        "model": "claude-sonnet-4-6",
        "max_tokens": 128,
        "stream": true,
        "messages": [{"role": "user", "content": "查询状态"}]
      },
      "headers": [["x-future-feature", "preserved"]],
      "context": {
        "requestClass": "subagent",
        "sessionId": "11111111-1111-4111-8111-111111111111",
        "promptId": "22222222-2222-4222-8222-222222222222",
        "agentId": "child-001",
        "parentAgentId": "root-001",
        "agentType": "Explore"
      }
    }

request_id 可省略，使用 1–128 位字母、数字、连字符、下划线。重复标识返回 409，不覆盖旧日志。schema_version 只支持 1。HTTP 入口上限 2 MiB，只接收未压缩 JSON。

信封 headers 是有序二元字符串数组，提供后替代外层 HTTP 头作为业务转发输入；日志仍会保存实际入站 HTTP 头。没有信封 headers 时使用 HTTP 头。鉴权、传输字段、Connection 动态字段及原生上下文按 [头部策略](header-policy.md) 处理。

## 正文能力

| 字段 | 首版行为 |
| --- | --- |
| model | 必填；由实际官方构造器处理 |
| messages | 必填；user / assistant，文本或内容块数组 |
| system | 业务文本，或仅含 type/text 的文本块 |
| tools | API schema 通过原生 extraToolSchemas 输入；不注册本地执行器 |
| tool_choice | 由原生工具选择参数表达，发送前校验保留 |
| max_tokens、temperature | 映射原生输出预算和温度参数，发送前校验 |
| thinking | disabled、enabled、adaptive；enabled 需要不小于 1024 的 budget_tokens |
| output_config | effort、format；模型或原生能力不能表达时返回 422 |
| stream | true 返回原始 SSE；false 或省略返回原始 JSON |

工具调用、工具结果、thinking 及签名等历史通过内部消息实体输入。发送前对显式字段做保留检查；文本字符串与等价文本块按相同语义比较，原生添加的缓存等字段允许保留。会被合并、删除或改变含义的历史明确拒绝，不宣称完整兼容任意 Messages 历史。

已封口的 x-anthropic-billing-header system 前缀、显式 system cache_control、top_p、metadata、stop_sequences 和未登记正文/消息字段当前不支持，返回明确错误。未知 JSON 字段采用拒绝策略；未知合法端到端请求头采用默认保留策略。

原生默认参数与所选模型相关。显式 enabled thinking 若被模型原生规则转换成 adaptive，也会因无法原样表达而返回 422。调用方应按实际需要明确选择受支持参数。

## 上下文

支持 main、subagent、workflow、compaction、auxiliary、side_reply。requestClass 可由 context 或相应 x-claude-code-* 头提供，两处冲突时拒绝。

- 无分类或 agent 身份时生成普通主上下文，source 标明 bridge-default。
- 显式 agentKind=main 可提供 root agentId；单独提供 agentId 默认按子代理处理。
- 子代理需要 agentId，workflow 还需要 workflowRunId；父 agent、agent 类型、session 和 prompt 一起传给原生链路。
- agentKind 支持 main、subagent、teammate；类别与身份冲突返回错误。
- 压缩可以保留主代理或子代理身份，不能只改变 request-class 头。
- sessionId、promptId 未提供时生成；promptId 必须为 UUID。

每个作业使用新官方进程，并以原生 session transition 恢复指定会话身份。它保留请求关联，不在本地维护可执行的用户代理循环。

## 响应与取消

HTTP 状态、合法端到端响应头及响应逻辑字节原样返回。content-length、content-encoding、连接级字段与 set-cookie 不沿用，以适配原生 Response 可能已解压的内容。

响应附加 x-ccrb-request-id 和 x-ccrb-engine。工具调用事件直接返回，不执行调用方工具。禁用模型隐式重试，每个日志记录仅有 attempt=1。

客户端断开、请求预算耗尽和服务关闭会取消当前作业并解除背压。HTTP 头发出后直接结束逻辑流，不拼接新事件；SSE 调用方须检查 message_stop，不能以 HTTP 200 判定完整完成。日志将 HTTP 错误、流内错误、缺失终态、本地错误和取消分开记录。

## 配置

Bun 读取本机 .env；该文件已被 Git 忽略。参考仓库 .env.example。

| 变量 | 默认或用途 |
| --- | --- |
| CCRB_MODE | native；显式 demo 才生成合成响应 |
| CCRB_CLAUDE_BINARY | 官方固定 293 程序绝对路径，原生模式必需 |
| CCRB_CLAUDE_HOME、CCRB_CLAUDE_CONFIG_DIR | 专用 HOME 与配置目录，原生模式必需 |
| CCRB_NATIVE_API_KEY、CCRB_NATIVE_OAUTH_TOKEN | 显式原生凭据；也可由专用配置提供 |
| CCRB_PROXY_URL、CCRB_CA_FILE | 原生进程 HTTPS 代理与额外 CA 文件 |
| CCRB_WORKDIR | 默认专用 HOME |
| CCRB_HOST、CCRB_PORT | 127.0.0.1、8787；仅允许回环监听 |
| CCRB_DATA_DIR | data |
| CCRB_LOG_MODE | debug，可选 off、summary |
| CCRB_CAPTURE_BYTES | 单阶段正文 1048576，允许 1024–8388608 |
| CCRB_LOG_BYTES | 总载荷 536870912，允许 1024–2147483648 |
| CCRB_RETAIN_DAYS | 摘要 7 天，允许 1–90 |
| CCRB_DEBUG_RETAIN_DAYS | 正文 3 天，不超过摘要保留期 |
| CCRB_TIMEOUT_MS | 包含排队的请求预算 90000，允许 1000–600000 |

真实 OAuth、账号刷新及生产请求仍需独立验收。本项目不会读取现有 cc2api 配置来自动接管账号。

## 只读查询

GET /api/logs 支持 requestId、model、state、requestClass、sessionId、since、until、limit、offset。时间使用 ISO 8601 UTC；limit 默认 50、最多 100。GET /api/logs/:id 返回发生时的请求快照、上下文、头部决策和阶段数据。GET /api/health 返回引擎、日志模式、采集故障和最终采样能力。

查询仅使用本地日志库，不创建官方进程。页面和 API 拒绝跨来源访问，不提供公开管理鉴权或多租户隔离。

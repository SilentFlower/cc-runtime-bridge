# cc-runtime-bridge

用于本地联调的运行时适配与日志工具，提供 HTTP 接口和日志查看页面。

目前按单账号、串行请求运行，服务默认仅监听本机回环地址。

## 功能

- 接收结构化请求，适配运行时并转发响应。
- 保存请求关联信息、头部处理结果和各阶段日志。
- 在本地页面筛选记录、查看详情和复制脱敏内容。

## 本地预览

需要 Linux 和 Bun 1.3.14 或更高版本。

```bash
bun install --frozen-lockfile
bun run build
bun run start --demo
```

打开 http://127.0.0.1:8787。演示模式使用合成数据，不访问真实上游。可生成一条示例日志：

```bash
curl --no-buffer http://127.0.0.1:8787/api/requests \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"demo-001","headers":[["x-future-feature","preserved"]],"body":{"model":"claude-sonnet-4-6","max_tokens":64,"stream":true,"messages":[{"role":"user","content":"查看本地日志"}]}}'
```

## 连接运行时

当前适配 Claude Code 2.1.293，程序需与[来源配置](src/runtime/293/source-profile.ts)登记的版本和 SHA256 匹配。运行时程序需自行准备，构建、校验和回退方式见[运行时说明](docs/runtime.md)。

参考 [.env.example](.env.example) 创建本机 `.env`，填写运行时路径、专用 HOME、配置目录及所需凭据。配置文件和运行数据不纳入版本管理。

```bash
install -d -m 700 runtime/home runtime/config
bun run build
bun run start
```

工作进程在首个请求时启动，正常请求复用进程。取消或异常后会重建，不自动重放当前请求。完整参数及支持范围见[接口说明](docs/api.md)。

缓存策略默认 `CCRB_CACHE_POLICY=preserve`，可显式选择 `sub2api`；第一方遥测默认 `CCRB_TELEMETRY=off`，可按需开启。配置修改后重启，健康接口显示配置和实际初始化状态，具体规则见[接口说明](docs/api.md#配置)。

## 接口

### 用自己的 Claude Code 联调

本地池模式提供常驻 API 和日志页，接收固定 2.1.293 客户端使用自定义 Base URL 发出的请求。链路为本地接口、隔离原生运行时、TLS 采集器、兼容 Messages 的池；模型在采集器第二段映射为 deepseek-flash。

```bash
bun run start:pool --run manual-001 \
  --binary /你的路径/claude-2.1.293 \
  --pool-env /你的路径/pool.env
```

池配置文件仅所有者可读（0600），使用 `CCRB_TEST_POOL_BASE_URL` 和 `CCRB_TEST_POOL_API_KEY`；也兼容 `PROJECT_REQUESTER_BASE_URL/API_KEY`。只读取地址与 Key，不读取其中的模型和 fallback。Key 不通过命令行传递，不进入原生工作进程。

目前此模式需要已登记 SHA256 的原版 293 和当前预加载代码；现有轻量文件内嵌旧入口，暂不用于此模式。原有轻量运行方式保持。

默认地址与日志页均为 http://127.0.0.1:8787。新开一个终端，按当前会话设置客户端（无需填写池 Key）：

```bash
unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
export ANTHROPIC_AUTH_TOKEN=ccrb-local-client
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
claude --model claude-sonnet-4-6
```

PowerShell：

```powershell
Remove-Item Env:ANTHROPIC_API_KEY,Env:CLAUDE_CODE_OAUTH_TOKEN -ErrorAction SilentlyContinue
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:8787"
$env:ANTHROPIC_AUTH_TOKEN = "ccrb-local-client"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
claude --model claude-sonnet-4-6
```

Base URL 不加 `/v1`。客户端模型使用上述 Claude 标识，池侧实际模型固定 deepseek-flash。当前只支持 2.1.293；可先运行 `claude --version` 核对。

手工联调不限请求次数，不附加本地请求总超时，原生模型参数交由池校验；客户端重发作为新请求计数。请求大小、排队和调用预算由前置服务管理，桥接保持单账号串行执行。启动、自检、健康检查和页面刷新不调用模型，服务端不自动重试、重定向或换模型。运行目录为 `artifacts/local-pool-runs/<run>`，保存请求账本、日志与含 PID 的 ready.json；同目录不能覆盖历史记录。停止用 Ctrl+C 或启动信息中的 `kill <PID>`，关闭临时终端即可结束客户端环境设置。

连接异常可查看该轮 `ledger.json` 的 `failureCode` 与 `transportDiagnostics`，区分发送前、等待响应头及响应体阶段。阶段仅表示本地观测，字节数是关联连接的累计计数；缺失为未知，不能据此断定模型没有执行或安全重试。未收到池响应头时 `upstreamStatus` 保持 `null`，本地错误码单独记录。

手工服务自动把失败现场保存到该轮 `incidents/reports/<请求ID>.json`，取证状态为 `incidents/status.json`。报告仅包含已脱敏元数据、传输诊断和有来源的标识，不读取提示词或响应正文，也不新增模型调用。它按运行和请求精确关联，等待短暂收口后保存；已有报告不覆盖，缺失、冲突或采集失败明确可见。旧平铺报告继续只读识别，原文件保留；新报告与状态分目录，合法请求 ID `status` 不再冲突。正常取消不自动报故障。日志关闭、过期、丢失或进程强杀可能缺证；本地 TLS 实收与发送事件均不能证明池端执行，原始断连根因仍需结合现场调查。

可以在服务停止后补采尚有记录的失败请求；`--output` 必须使用新目录，适合单独保存迟到证据，不覆盖原报告：

```bash
bun run collect:pool-incidents --run manual-001 \
  --run-dir artifacts/local-pool-runs/manual-001 \
  --request-id 请求ID --output artifacts/manual-001-supplement
```

省略 `--request-id` 补采本轮所有失败记录，省略 `--output` 使用该轮 incidents 目录。来源轮次冲突时拒绝拼接；旧记录缺少诊断时保持未知。取证异常只记录固定故障码，不改变业务响应或重试策略。

日志详情的“最终出站采样”来自 Node TLS 实收，位于池映射之前；发送前参数与它分别展示。池映射后的参数不代表池端网络实收。原生工作进程使用合成凭据、独立 HOME/config、仅回环网络，遥测关闭。池若不支持某个原生字段，将显示实际错误，不静默删字段。

### HTTP 入口

- `POST /v1/messages`：接收固定 293 原生 CC 正文或受支持的 Messages API 正文。
- `POST /api/requests`：接收带 request_id、headers、context 的信封。
- `GET /api/logs`、`GET /api/logs/:id`：只读查询；`GET /api/health` 查看运行来源和采集故障。

## 日志

默认采用 debug 模式，保存有界的脱敏原文；也可选择 summary 或 off。正文单段默认 1 MiB、总载荷 512 MiB，摘要保留 7 天、正文保留 3 天。

发送前参数与接收端实测数据分开记录。默认发送链路尚未自动采集最终出站值，缺失、截断和采集失败会明确显示。采集来源、保留规则和查看方式见[日志说明](docs/request-logs.md)。

## 验证

```bash
bun run typecheck
bun run test
bun run test:integration
bun run test:native
bun run test:ui
```

运行测试前先完成构建。运行时和页面测试使用独立网络命名空间，需要 `unshare` 权限、`ip` 和 `openssl`；页面测试另需 Node.js 和系统 Google Chrome。测试使用合成凭据、独立 HOME 和本地回环服务。

## 适用范围

项目主要用于本地开发和联调。已进行合成输入与隔离回环验证，真实 OAuth、生产流量和多账号并发仍需另行验证。

## 文档

- [请求头策略](docs/header-policy.md)
- [请求日志与展示](docs/request-logs.md)
- [接口合同与配置](docs/api.md)
- [轻量运行时与常驻执行](docs/runtime.md)
- [版本适配记录](docs/research/claude-code-293-study.md)

# cc-runtime-bridge

基于官方 Claude Code 运行时的请求桥接与可审计日志项目。首版固定 2.1.293，复用原生请求构造和发送链路，提供请求日志列表与详情页。

首版提供可运行的本地 HTTP 服务和日志页面。真实 293 链路通过隔离回环验证；尚未接入现有 cc2api，也未使用真实 OAuth 账号验收。

## 首版范围

- 结构化入参适配，保留主会话、子代理及压缩等请求的语义。
- 请求头以黑名单和字段归属处理，合法端到端扩展默认保留。
- 返回原始响应逻辑内容，支持工具调用、流式、取消与背压。
- 记录并展示入站、头部处理、CC 组装、可用的最终采样和上游响应。
- 明确显示中间值、最终值、未采集、截断及采集失败。

## 本地预览

需要 Linux、Bun 1.3.14 或更高版本。运行：

```bash
bun install --frozen-lockfile
bun run build
bun run start --demo
```

打开 http://127.0.0.1:8787。演示模式只生成合成响应，页面会明确标识。可提交一条演示请求生成日志：

```bash
curl --no-buffer http://127.0.0.1:8787/api/requests \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"demo-001","headers":[["x-future-feature","preserved"]],"body":{"model":"claude-sonnet-4-6","max_tokens":64,"stream":true,"messages":[{"role":"user","content":"查看本地日志"}]}}'
```

## 原生模式

准备官方 Linux x64 的 2.1.293 程序，SHA256 必须为：

```text
8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978
```

本仓库不分发官方程序。创建专用 HOME 和配置目录，在被 Git 忽略的 `.env` 中配置实际绝对路径，参考 [.env.example](.env.example)。由操作者提供 API key、OAuth token 或专用配置中的凭据；子进程不继承宿主的通用账号环境变量。

```bash
install -d -m 700 runtime/home runtime/config
bun run build
bun run start
```

启动和每轮作业都会校验二进制。原生初始化失败会明确报错。每个作业创建一个官方进程，单账号串行执行，最多接纳 16 个执行中或排队作业。它复用官方消息构造和原生发送；API 工具仅作为 schema 和历史数据传入，返回的 tool_use 交给调用方。

## 接口与日志

- `POST /v1/messages`：接收受支持的 Messages API 正文。
- `POST /api/requests`：接收带 request_id、headers、context 的信封。
- `GET /api/logs`、`GET /api/logs/:id`：只读查询；`GET /api/health` 查看运行来源和采集故障。
- 页面默认仅监听回环地址，支持筛选、父子关联、阶段原文与复制。

本地默认 debug 模式。正文单段默认 1 MiB，载荷总量默认 512 MiB，摘要保留 7 天、正文保留 3 天，可通过环境变量调整。日志写入在独立线程进行；故障显示采集缺口，不为补日志重放模型请求。

293 的 JS 组装结果仍含 CCH 占位符，真实原生发送会继续处理。当前生产采集位置覆盖 `cc_prepared`，`wire_final` 始终显示“未采集”；隔离测试的 TLS 接收端会独立核对最终 CCH。

## 验证

```bash
bun run typecheck
bun run test
bun run test:integration
bun run test:native
bun run test:ui
```

原生和页面验收会创建无外网网络命名空间，需要 `unshare` 权限、`ip`、`openssl`；页面验收另需 Node.js 和系统 Google Chrome。原生测试仅使用合成凭据、独立 HOME 和本地 TLS 上游，没有权限创建命名空间时直接失败。构建产物须先由 `bun run build` 生成。

## 当前边界

首版支持的 API 字段及拒绝规则见 [接口合同](docs/api.md)。它尚未完成真实 OAuth、生产流量或跨账号并发验收。每个进程的专用环境也不等同于 Docker 隔离。本地验证不能证明账号风险下降。

## 文档

- [请求头策略](docs/header-policy.md)
- [请求日志与展示](docs/request-logs.md)
- [接口合同与配置](docs/api.md)
- [293 离线研究](docs/research/claude-code-293-study.md)
- [首版需求](.trellis/tasks/11-05-native-runtime-logs/prd.md)
- [技术设计](.trellis/tasks/11-05-native-runtime-logs/design.md)
- [实施计划](.trellis/tasks/11-05-native-runtime-logs/implement.md)

项目定位为运行时桥接与调试组件，后续由 cc2api 等调用方接入。账号池、计费及公开管理平台不属于首版范围。

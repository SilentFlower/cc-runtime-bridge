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

# 规划引用规范摘录

本文件按来源与行号保存当前规范摘录。实施前按相关场景继续读取原文，新增合同以本任务 PRD/design 为准。

## /root/project/vibecoding-bench/.trellis/spec/cc2api/backend/service-architecture.md

来源 SHA256：`615ac27cf9c2ef37f25b1610a8b24ea16b98831bea0dc40392a3c4944ddb035d`。

### 第 13–40 行

src/store/
src/tlsfp/
```

## 分层契约

- `main.rs` 只负责装配：加载 `Config`、初始化 tracing、注册 SQLx Any driver、初始化 DB/cache/store/service、启动后台 poller、构建 router。
- `handler/router.rs` 负责 HTTP 路由、DTO 解析、管理 API 返回形状和静态资源 fallback，不把复杂业务逻辑塞进 handler。
- `middleware/auth.rs` 只处理管理端 Bearer 密码认证；网关 API token 鉴权留在 `gateway_fallback` 进入 `TokenStore` 查询。
- `model/` 是 DB/API 共享结构。新增字段要同步 store 映射、前端类型和迁移。
- `service/` 放业务逻辑：账号调度、Gateway 转发、OAuth、usage poller、telemetry、rewriter、version profile。
- `store/` 放持久化与缓存抽象。不要让 handler 直接写 SQL。
- `tlsfp/` 和 `craftls/` 是 TLS 指纹链路，改动要按协议/抓包任务处理。

## Gateway 热路径规则

`GatewayService::handle_request` / `handle_request_inner` 是最高风险路径。修改前必须明确：

- 请求是否应在账号选择前拦截，例如 assistant prefill、warmup、Auto Mode classifier、非流探针缓存。
- 请求是否会消耗账号并发/RPM；粘性会话下不能因为 RPM 超限随意切号破坏缓存。
- 请求体是否被读取、解压、改写或缓存；读取后转发必须使用最终 body。
- Claude Code 请求改写必须在 CCH 和 `cc_version` 重新计算前完成。
- 上游非成功响应如果要重试，必须保留原有错误体兼容性和敏感信息边界。
- SSE 流式响应只能插入明确允许的 keepalive/comment，不要重排上游 chunk。

## Scenario: Gateway 压缩请求编解码

### 1. Scope / Trigger

## /root/project/vibecoding-bench/.trellis/spec/cc2api/backend/settings-database.md

来源 SHA256：`892740cb20fd55ee5700a4ddae33b98bea8671be92d4aa2214c141ead0ea5d45`。

### 第 43–66 行

## Account 字段同步

账号字段跨越多层：

```text
src/model/account.rs
src/store/account_store.rs
src/service/account.rs
src/handler/router.rs
web/src/api.ts
web/src/components/Accounts.vue
```

新增账号字段时必须同步读写、分页列表、更新接口、前端类型和 UI。涉及 token、邮箱、OAuth、usage 的字段必须默认脱敏展示。

`AccountStore` 使用 SQLx Any：PostgreSQL 的 JSONB 写入参数必须显式转为 `::JSONB`；查询和 INSERT RETURNING 的原生 JSONB/时间列须投影为 TEXT 后解码。时间解析同时接受 SQLite RFC3339 和 PostgreSQL 带时区文本，不能把无法直接解码的原生类型误当作空 JSON、无到期时间或当前时间。

`five_hour_usage_limit_percent`、`seven_day_usage_limit_percent` 的账号字段、双库升级和局部更新合同见 [每账号 5h/7d 用量控制线](./service-architecture.md#scenario-每账号-5h7d-用量控制线)。凭据刷新、进程指标更新和状态快捷操作必须保留这两个配置；状态与控制线同时提交时用独立控制线 SQL 避免旧 Account 快照覆盖新凭据或状态。

## 时间字段

- 后端持久化时间优先使用 RFC3339 字符串。
- 前端展示前只做格式化，不反推出业务窗口。
- usage window、RPM window、telemetry session 过期时间不能混用。

## /root/project/vibecoding-bench/.trellis/spec/cc2api/backend/testing-quality.md

来源 SHA256：`a8029569c22412606ed523af01338ec2fbe3a70862dc14b521a466a05dbc08b6`。

### 第 3–40 行

## 基础验证

Rust 后端提交前默认执行：

```bash
cd cc2api
cargo fmt --check
cargo test
```

如果只改文档或 Trellis spec，可以说明未运行代码测试；如果改 `src/`，不要跳过。

## 定向测试策略

- 请求体改写、CCH、`cc_version`：补 `rewriter` / `version_profile` 相关单测，覆盖多 text block、Fable、Haiku/title、小请求。
- 账号调度、RPM、粘性会话：补 service/store 层测试，明确并发、队列、超时和降级条件。
- settings：测试默认值、非法值、热刷新路径。
- DB migration：至少覆盖 SQLite；涉及 SQL 兼容时人工检查 PostgreSQL 语法。
- gateway 错误体：保留 Anthropic/OpenAI 可解析 error object，不要把本地拒绝改成裸字符串。

## 敏感数据边界

测试 fixture、日志和 spec 中禁止提交：

- OAuth `access_token` / `refresh_token`
- `Authorization` / `Cookie`
- 完整 prompt、tool input、响应正文
- 完整 `http_capture.jsonl`
- 邮箱、组织 ID、账号 UUID 的真实映射

需要记录抓包结论时，只写字段差异、header 顺序、hash 结果和脱敏摘要。

## 本地拒绝错误体边界

- 访问策略本地拒绝必须保留 Anthropic/OpenAI 可解析的 error object，`error.code` / `setting` 用于机器识别。
- `allowed_user_agents` 未命中时，响应可以返回当前请求的 `User-Agent`，便于客户端自查；但不得返回 `allowed_user_agents` 原始配置、允许 pattern 列表或“允许规则”引导文案。
- `allowed_claude_code_versions` 的版本范围是独立策略；是否隐藏必须按任务范围明确，不要和 `allowed_user_agents` 规则混改。
- 修改访问策略错误体时，至少补单测断言：状态码、`error.code` / `setting`、当前 UA 是否按需求出现、允许列表 pattern 是否未泄露。

## /root/project/vibecoding-bench/.trellis/spec/vibecoding-bench/backend/account-runtime-v3.md

来源 SHA256：`b013190abb66cc58f32ea63d902c496d897e7afdd3807ff24d7044c1a1994624`。

### 第 71–82 行

### 3. Contracts

- 内部接口同时要求管理 Bearer 与 `x-v3-service-token`；能力返回 `{credential_ownership_protocol:1}`。交接响应含 `protocol:1/ownership/receipt`，完整凭据快照只向受信任内部调用方返回。浏览器仅接收无身份秘密的 `owner/phase/message/remote_id/environment_id/direction` 摘要；列表批量读取，不逐账号刷新或扫描 HOME。
- 输入为 `protocol/operation_id/action/direction/identity/expected_generation/source_refresh_sha256/lease_owner/credentials`，拒绝未知字段；action 为 prepare/commit/finish/cancel/status，direction 为 create/attach/return/authorize/detach/reauth/retire。操作和代次为 32 位小写十六进制；identity 固定 deployment_id、environment_id、bench_account_id、device_id、email、account_uuid、organization_uuid，device_id 为 64 位十六进制。凭据为 access_token/refresh_token/expires_at（UTC 毫秒），不保存到待办、回执或证明表。
- owner 为 gateway/local；phase 为 ready/handoff/reauth/reconcile。仅 gateway/ready 允许网关新上游活动；无所有权记录的普通账号沿用原行为。坏记录只隔离所属账号，不影响整个账号列表或其他账号调度。
- prepare 先关闭新准入、持久归属并排空最多 8 秒。活动许可必须覆盖实际网络发送至结束，SSE 持有到流释放；模型、count_tokens、Hello/bootstrap、预热、额度、测试、遥测、OAuth/401 共用门禁。作用域允许的原 sticky 账号暂停时返回维护，保留绑定；不跨号绕过。归属拒绝不应触发认证停用，RPM/并发/优先级等普通配置仍可热编辑。
- detach 在本地空闲、网关排空后取当前权威快照，镜像/解绑并发布完整 HOME，远端提交 local/ready 后完成。return 必须有原本地接管回执、原 ID 与代次；由本地所有者按需刷新后交回当前 HOME，绑定并恢复 AT-only，再 finish 为 gateway/ready。root profile 落后时不能作为当前 HOME 的来源证明。
- attach 仅在当前 RT 摘要及设备/账号证明一致时认可远端当前凭据；来源不明拒绝。成功本地强制重授权可记录无令牌证明：原环境/设备/身份、RT 摘要及本次登录冻结的 `session.version`；关联时再次按该版本核验当前 HOME 后使用 authorize。独立登录未具备设备来源时允许保存本地账号、清除旧证明；不能据此解除 retired/refresh_pending 或跳过后续关联校验。
- reauth 保留原绑定及原 `login:` 租约；凭据导入回执 `import_operation_id` 与所有权回执关联，确认实际新授权导入后才允许 finish。回执保存 source_phase，取消返回原阶段，原 reconcile 不能被取消变 ready。普通执行不得冒用登录来源；未完成原操作不能开启另一个交接。
- 受管刷新发送前落库待确认；确定结果保存且 HOME 收口后才恢复 ready。断线/解析失败/崩溃不重试未经确认的旧 RT。finish 已提交而响应丢失时查同操作回执；若同代已提交后又进入远端 reconcile，确认原绑定完成并保持 `gateway_refresh_pending`，允许明确重授权，仍不放开普通执行。
- retire 无需有效 RT：先暂停原网关账号再本地删除，保留原 ID/HOME/历史；本地 retired 继续关闭普通执行，明确且身份核验成功的本地重授权才可恢复。远端明确删除仍须原绑定完整缺失证明，不能将新目标 404 当成成功。
- 两角色镜像标签 `vibebench.credential-ownership-protocol=1`，联合清单 `credential_ownership_protocol:1`；已有任一所有权记录时，只读兼容检查拒绝旧清单回退。US 沿用现有资源参数、不做生产备份、不重新计算内存；最终同批发布及健康验收由部署流程承接。

## /root/project/vibecoding-bench/.trellis/spec/cc2api/frontend/frontend-guidelines.md

来源 SHA256：`f115c16fb1e5337bf97da90158e8d827591fbdfa86d736152d2265666624ad27`。

### 第 14–49 行

```

构建产物由 Rust 后端嵌入/拷贝到 `web/dist`，生产镜像只运行单个 gateway 二进制。

## API Client 契约

- 所有管理端请求统一走 `web/src/api.ts` 的 `request<T>`。
- 管理端鉴权使用 `Authorization: Bearer <admin password>`，由 `setAuth` 写入内存。
- 新增后端字段必须先更新 TypeScript interface，再更新组件。
- API path 以 `/admin/...` 为准；普通 Anthropic 代理请求不走前端 API client。
- 错误体优先读取 `{ error }`，后端本地错误要保持这个 shape。

## Router / Auth

- `router.ts` 负责恢复 `localStorage` 中的 `claude-code-gateway_auth` 并用 `api.getDashboard()` 校验。
- 需要登录的页面放在 dashboard children 下并设置 `meta.requiresAuth`。
- 不要在组件里绕过 router auth 直接判断密码；统一使用 `login` / `logout`。

## Settings 页面规则

新增 setting UI 必须：

1. 使用后端实际 setting key，不发临时别名。
2. 控件类型匹配值域：布尔用开关/选择，枚举用 select，数字用 number input。
3. 保存前做前端基础校验，但以后端校验为最终真相。
4. 说明文字聚焦风险和作用范围，不写营销式描述。
5. 与 `settings_store.rs` 默认值、`router.rs` 校验和 `GatewayService::reload_*` 同步。

### Scenario: Settings 表单字符串契约

#### 1. Scope / Trigger

- Trigger: 修改 `web/src/components/Settings.vue` 的 setting 表单、`web/src/api.ts` 的 `/admin/settings` 解析，或新增 number input 类型 setting。
- 目的: `settings` 表持久化值是字符串，但 Vue number input / 历史响应 / 代理响应在运行时可能给前端带来 `number | boolean | null`，不能让表单代码直接假设 `.trim()` 一定存在。

#### 2. Signatures

## /root/project/vibecoding-bench/.trellis/spec/cc2api/deploy/deploy-guidelines.md

来源 SHA256：`02d0c885013087bda085370310c987f0d89769b445f09156923887d3e79a2367`。

### 第 3–37 行

## 构建形态

`cc2api` 交付物有两种：

- 单二进制：`scripts/build.sh` / `scripts/build.bat` 先构建 `web/dist`，再构建 Rust 后端。
- Docker 镜像：`docker/Dockerfile` 分三段构建 frontend、backend、runtime。

前端资源是构建时产物；改 `web/` 后必须重新 build，不能只重启旧二进制。

## 本地开发

```bash
cd cc2api
./scripts/dev.sh
```

脚本会在需要时构建前端，再 `cargo run`。如果只改后端但前端 dist 过期，仍要让脚本处理。

## Docker Compose

`cc2api/docker/docker-compose.yml` 默认服务名：

```text
claude-code-gateway
```

默认端口来自 `SERVER_PORT`，服务内监听 `5674`。容器数据在 `claude-code-gateway-data` volume 的 `/app/data`，默认 SQLite DB 位于该目录下。

## 远程部署规则

- 远程环境变量通常由本仓 `.deploy/cc2api.env` 记录 SSH 信息；不要把密码或 token 写入 spec、README 或任务日志。
- 部署前确认子模块提交已推送到 `https://github.com/SilentFlower/cc2api.git`，父仓只固定 gitlink。
- 镜像升级后必须 recreate 服务，不能只 `docker compose pull`。
- 涉及 `canonical_env`、settings、allowed versions 的改动，部署后必须查 DB 分布，不只看容器 `Up`。
- 远程时区使用 `TZ=Asia/Shanghai`，峰值预热依赖本地小时。

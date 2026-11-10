# cc2api 二进制接入初步研究

## 核对基线

- cc-runtime-bridge：`a9e97c6af7dbdbd11d5233c982310ff10bf4e490`。本轮新增内容仅为规划文件，原有其他任务变更按任务创建基线保留。
- vibecoding-bench：`875e4140689c19e7a535175a99bf0d3beee86afd`。已有协议研究文档及其他任务的工作区变更。
- cc2api 独立仓库：`47e75ef4a1e982e2693edab81d5387eedb6adf40`，读取时工作区 clean。其 Rust package 为 `claude-code-gateway` 1.6.0。
- 历史 `vibecoding-bench/.trellis/tasks/11-04-cc2api-cli-request-runtime/prd.md` 记录用户在 2026-11-04 暂缓 V4。新需求单独规划，旧任务中的整体命名与容器合并选择继续保持历史状态。

## 当前实际边界

- `cc2api/src/service/gateway.rs:2390` 附近已有正文改写及后续 CCH 更新；`:2617` 把 `final_headers/final_body` 交给 `forward_request`。
- `gateway.rs:3008` 的 `forward_request` 接收已改写、已封口的正文，按冻结编码重编码；`:3035` 构造 `PreparedRequest`，再准备发送环境、取得许可并提交。
- `cc2api/src/service/runtime_transport.rs:42` 的 `TransportBinding` 绑定账号、环境、代次、endpoint、secret、release。`:54` 的 `PreparedRequest` 携带目标、方法及有序头，正文另行传递。
- `runtime_transport.rs:189` 的 `PreparedRoute` 当前区分 Direct 与 V3。V3 使用管理端登记的账号 sender，通过内部鉴权向 `/internal/send` 提交。`:492` 的 handler 核验配置、归属及期限后调用现有 Rust HTTP 客户端，响应流持有活动 guard。
- `cc2api/src/model/account.rs:170` 的 `Account` 已含 auth_type、setup/access/refresh token、proxy_url、device_id、canonical_env、account_uuid 等真实定义。新的运行时不应成为另一个 refresh token 所有者。
- `src/shared/contracts.ts:224` 的当前私有协议以 `prepared: PreparedInput` 提交，支持 cancel/shutdown、ready/request_event/idle。
- `src/runtime/293/worker.ts:99` 起每个进程串行处理单个账号的作业；`:112` 每轮建立独立原生根，取消或异常后收口退役。
- `scripts/runtime/compile.ts:30` 附近生成的精简入口直接启动 `startWorker`。该二进制属于账号运行时，HTTP 服务和日志页面属于控制层。

## 技术建议，待规划收敛

- 将产物定位为 cc2api 管理的原生请求执行后端。网关负责鉴权、账号选择、准入与用量；原生二进制负责已选账号的请求构造、头部策略、最终 CCH 和唯一发送。
- 原生后端应在 Rust 最终正文/头部/CCH 改写之前分流，避免把已封口正文再次交给另一套构造。调度、凭据所有权、额度观察和流结束许可应继续沿既有路径。
- 每个账号使用独立环境及常驻执行实例。固定来源的工作进程启动、ready、取消、idle 与退役可复用现有合同。
- 当前 WorkerCommand 直接接受 PreparedInput。跨 Rust 接入需明确由二进制统一运行 parseInput/prepareInput 的原始输入边界，并保持头部白名单在实际业务入口生效。
- 构建须包含最新源码并重新验收新哈希。已有 26.12 MiB 仅为旧精简运行时的实测参照。最终体积与依赖按新产物独立测量。

## 后续必须闭合的合同

- 用户已明确选择按账号独立设置转发方式。
- 固定 293 的原生入站版本能力与 cc2api 现有画像策略之间的接入行为。
- 当前权威凭据及 device/account 身份如何从账号环境交给二进制，更新时如何排空和重建。
- 单进程串行能力与 cc2api 账号并发许可如何对应；流生命周期、取消与提交未知状态继续明确处理。
- V3 账号 sender 容器的进程、挂载与网络边界；纯直连兼容路径的支持范围。
- Messages 与 count_tokens、bootstrap、遥测等端点的职责分配，原后端的回退边界。

## 按账号选择后的并发核对

- 用户已确认各账号独立选择转发方式。
- `cc2api/src/model/account.rs:209` 定义 `concurrency: i32`，`:266` 默认返回 3；创建 API 的 `router.rs:749` 及 SQLite/PostgreSQL 表默认值同为 3。
- `cc-runtime-bridge/src/control/engine.ts` 的 NativeEngine 固定账号环境并串行复用；`src/runtime/293/worker.ts:99` 在已有活动作业时拒绝另一作业。
- 用户选择推荐方案：保留账号现有并发量，按需启动账号内工作进程池，每个物理进程保持单作业与独立根。
- `orchestrator/account_isolation.py:223` 在账号 sender 角色内运行 `/usr/local/bin/account-sender`，UID/GID 为 1001，配置以只读目录挂载；新运行时的私有 HOME、凭据和资源须纳入同一账号生命周期。
- 旧精简运行时的单进程作业后 RSS 样本为 187654144 B，来源 `docs/runtime.md:91`。这属于既有测试条件的观测值；新池的实际内存占用须独立测量。

## 规范入口

- 当前项目：`.trellis/spec/backend/runtime-contract.md` 与 `logging-guidelines.md`。
- bench：`.trellis/spec/cc2api/{backend,protocol,deploy,frontend}/index.md`；账号归属与刷新合同见 `.trellis/spec/vibecoding-bench/backend/account-runtime-v3.md` 的“v3 凭据单一所有者与交接协议 1”。
- 已读相关索引、前端指南、服务架构的分层及热路径/请求编解码段、账号凭据所有权合同。正式设计与实施前继续按影响范围加载精确场景。

## 并发决定后的约束补充

- `cc2api/src/service/account.rs:51` 定义标准槽比例 2，普通请求占 2 单位，Haiku 占 1 单位；`gateway.rs:4528` 按 Messages 根模型选择权重。进程池容量需要覆盖现有加权调度允许的同时活动请求，不能只按标准并发数截断。
- `orchestrator/resource_budget.py:39` 当前将 sender 固定为 128 MiB；`:40` 从账号总 RAM 中扣除 network/sender 后给 CLI，CLI 最低 512 MiB。原生池需要新模式专用的显式预算校验，旧布局继续保持。
- 资源配置采用启动侧显式值；未配置原生池预算或预算不足时明确拒绝原生准备。开发验收测量默认并发和 Haiku 半槽条件的实际峰值，作为发布要求的一部分。生产资源调整留给用户部署，不执行远程变更。
- 网关已有 `resolve_upstream_token(account.id)`；原生工作进程只接收当前解析后的 bearer，不持有 refresh token。进程 HOME/配置按账号及凭据代次隔离，身份以账号已登记设备和账号信息为准；固定官方原生配置字段须在实现前读取对应定义并以实收验证。
- `gateway.rs:2657` 后的旧 401 刷新重放和 signature retry 属于旧路径。原生路径保持一次模型提交，回传原错误；凭据恢复只影响后续请求。
- 当前原生解析 `src/shared/native-input.ts:45` 明确固定 2.1.293。新后端首版继续固定该能力，其他原生版本明确失败；旧后端继续按现有多版本画像处理。
- 同一端到端交付覆盖三仓：二进制接口与实际 cc2api 消费一起验收，部署文件和发布附件是该接入的交付步骤。

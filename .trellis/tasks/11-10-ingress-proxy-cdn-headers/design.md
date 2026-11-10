# 技术设计

## 边界与数据流

- `parseInput` 继续选择 HTTP 入站头或显式内部信封头，`prepareInput` 统一执行调用方请求头策略。两类正文共用这一边界。
- 本轮新增静态的精确协议字段集合，沿用现有运行时归属、上下文字段、连接及凭据分类。
- 白名单作用于调用方可带入的字段。官方运行时独立生成自己的发送头，`runNativeJob` 继续按现有覆盖和版本能力规则合并已准入字段。

## 白名单合同

- 直接进入现有适配/合并分支的精确字段为：`accept`、`accept-language`、`cache-control`、`anthropic-version`、`anthropic-beta`、`anthropic-dangerous-direct-browser-access`、`x-claude-code-prev-tool-durations`、`x-claude-code-compaction`、`x-claude-code-context-compacted`。
- `CONTEXT_HEADERS` 中的六个字段继续提取上下文；`RUNTIME_HEADERS` 和 `x-stainless-*` 继续交给真实运行时归属处理。
- 先验证全部输入格式并处理 Connection 声明，再沿现有连接、凭据、运行时规则分类。
- 对既非上下文也非协议白名单的字段，记录 `drop` 和固定原因后结束该项处理。此步骤位于重复字段检查之前，使名单外同名重复项均被删除。
- 白名单字段沿原单值/多值规则检查。`anthropic-beta` 和 `anthropic-version` 继续使用原有专用适配行为。未知上下文字段的名称按名单外字段处理，已登记上下文字段的冲突仍明确失败。
- 不按 `x-claude-code-*` 或 `anthropic-*` 整个前缀放行，不增加由请求指定的白名单或旁路开关。

## 日志与正文

- 复用 `HeaderDecision` 的既有 `drop` 动作，固定原因描述“调用方请求头未登记到协议白名单”。不新增共享协议字段或数据库列。
- `ingress` 继续保留实际入站表示并按既有规则脱敏；`header_policy` 展示过滤决定，`cc_prepared` 与 `wire_final` 继续标明各自阶段和来源。
- 本轮只调整调用方请求头准入。模型正文、会话与父子关联、缓存、单次发送、响应头及取消行为保持现有合同。

## 测试夹具私有控制

- Python TLS 上游的响应模式改为每个已启动上游服务器的内部属性，默认 `json`。
- 在现有 stdin/JSONL 通道新增 `response_mode` 指令，字段为 `type`、`port`、`mode`，仅指向已启动的 TLS 上游端口；返回同字段确认帧。
- TypeScript 夹具维护 `RunningServer` 与其 `Endpoint` 的映射，在发送请求前通过私有通道设置模式并校验确认帧。
- Python 在开始处理请求时固定该请求的模式，保留原有响应构造。长流和取消的直接 fetch 同样先走此控制通道。
- `x-fixture-mode` 保留为可选的过滤反例；生产白名单不登记测试控制头。

## 兼容与回退

- 用户已选择未登记字段统一过滤，原 `x-future-*`、客户端探针以及代理/CDN 头的默认透传行为随之改变。未来新增协议头需要登记并补充依据及验证。
- `BridgeService` 先生成经过白名单处理的 `PreparedInput`，引擎再把该结果交给工作进程；原版和单文件引擎共用当前控制面的过滤边界。原版适配器通过现有 build 重建。
- 旧单文件内部代码与身份保持原样，本轮不把控制面更新宣称为单文件产物重新构建或接纳。
- 如需回退，恢复本轮头部策略、对应测试和说明，再构建适配器并执行相同离线验证。

## 验证形态

- 单元层覆盖全部准入字段、代理/CDN、未知客户端及未知协议前缀字段、大小写、名单外重复项、非法格式和既有上下文冲突。
- 控制服务集成层核对 HTTP 入站与信封输入、头部决策及原始采集表示。
- 原版 293 离线 TLS 实收核对普通 API 与原生 CC 的过滤结果、合法多值、可选协议字段和主子代理归因。
- 最终 TLS 验证器套件核对私有夹具控制迁移后各响应场景、真实接收头、单次发送和采集阶段证据。

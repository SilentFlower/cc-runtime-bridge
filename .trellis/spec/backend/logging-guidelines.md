# 请求日志合同

## Scenario: 采集、持久化及只读查询

### 1. Scope / Trigger

- 日志贯穿运行时、服务、SQLite、正文文件和页面，不能由各层自行解释采集完整性。
- 权威类型位于 src/shared/contracts.ts、src/control/log-schema.ts；终态及采集投影由 RequestTrace 统一生成。

### 2. Signatures

- LogStore.record(snapshot: LogSnapshot): boolean，有界非阻塞提交。
- LogStore.list(filters: LogFilters = {}): { rows: RequestRow[]; total: number }。
- LogStore.detail(id: string): Promise<RequestDetail | null>。
- RequestTrace.event(event: RuntimeEvent): void；finish(state: RequestState, error?: string): RequestState。
- requests 表保存 id、created_at、model、state、request_class、session_id、payload、context_json、decisions_json。
- captures 表保存 request_id、stage、attempt、payload、body_file；正文独立文件，payload.text 留空，按 request_id 级联删除。

### 3. Contracts

- CaptureStage 固定为 ingress、header_policy、cc_prepared、wire_final、upstream_response；每段绑定 attempt、capturedAt、source、representation、status、observedBytes、storedBytes、sha256、text、headers、note。
- ingress 使用 HTTP 原始 UTF-8 正文；不能 JSON 重序列化后声称是原文。哈希使用原始观测字节，预览先脱敏、再按完整 UTF-8 字符限长。
- cc_prepared 是 JS 原生传输前参数，CCH 可能为 00000。当前 wire_final 始终 unavailable，不能重算补写或把中间值改标签充当最终值。
- context.inputFormat 可选 api / claude_code，只由输入解析写入，沿既有 context_json 持久化，不增数据库列或回填旧记录。普通 API 中间段来源为 claude_code_293_cli_prepared，原生为 claude_code_293_native_ingress_prepared；默认 preserve 的原生说明只改账号身份及 CCH 占位。显式 sub2api 实际应用时说明增加消息缓存断点处理；运行时可选 cache_policy 诊断经共享协议校验后投影到已有 capture.note，记录应用/保留/跳过及原因和位置。历史缺失字段保持可读，不把这些诊断称为真实缓存命中。demo 始终保持 demo_fixture，不能因输入是原生形状就标成实际原生发送。
- 响应 representation=response_logical_bytes。原生 fetch 可能已解压，不称为线上压缩帧。
- 模式 off 不新增记录；summary 保存摘要、关联、阶段状态而不保存原文和头值；debug 保存有界脱敏原文。既有历史不会因 off 删除。
- CCRB_CAPTURE_BYTES 默认 1048576，CCRB_LOG_BYTES 默认 536870912，CCRB_RETAIN_DAYS 默认 7，CCRB_DEBUG_RETAIN_DAYS 默认 3 且不超过摘要期。
- 总量按 JSON UTF-8 载荷和正文大小计数，SQLite 页/索引/WAL 另有开销；执行中记录暂不回收，结束后按最旧完成记录回收。启动、写入及每分钟清理。
- 独立线程写入，队列最多 64 快照或 16 MiB。热路径不等待 flush；日志故障不得阻塞当前响应或触发模型重放。
- 私有运行时头先注册已知秘密，再统一脱敏；覆盖原生端单独持有凭据的情况。私有 IPC 不能另作普通诊断日志落盘。
- 响应片段先拼接有界前缀再脱敏；截断或中断时额外省略秘密边界，不能保存部分凭据。展示哈希不得对脱敏或格式化后的内容复算。
- 请求终态与采集状态分开：HTTP 200 不代表 SSE 成功，正文截断也不意味着模型失败。
- 只读查询不初始化 CC、不登录、不刷新账号，失效进程不影响持久详情。
- requests 快照中的 binarySha256 为实际执行体身份：原版是原文件 SHA，轻量版是经 /proc 核对的 memfd 载荷 SHA。来源与外层分发 SHA 在固定接纳表及构建清单中独立保留，不改写既有历史记录，也不把外层 SHA 冒充执行体。常驻复用和本地初始化不生成额外业务请求日志。

### 4. Validation & Error Matrix

| 条件 | 请求/采集行为 |
| --- | --- |
| SSE error 或非流式 error 内容 | stream_error，HTTP 状态及字节仍保留 |
| 缺少 message_stop、JSON 无完整 message、观察超限 | incomplete |
| 调用方取消 | canceled，响应采集 incomplete |
| 预览超过上限且上游完整完成 | 请求 success，阶段 truncated |
| 正文文件丢失 | 阶段 failed，不伪造空原文 |
| 正文过期 | 阶段 unavailable，保留摘要 |
| 写入或队列故障 | captureError/健康状态提示缺口，停止后续采集，不重放 |
| 重启发现 queued/running | incomplete，并记录未保存终态的说明 |

### 5. Scenarios and Examples

- 正常：收到完整 SSE message_stop，记录 success；原文 SHA256 等于实际转发字节的 SHA256。
- 边界：日志截断 1 MiB 之外的输出，但实际响应继续返回，模型仍可成功。
- 错误用法：从 cch=00000 的中间正文自行重算后保存 wire_final。正确做法是保留中间值，最终采样标为 unavailable。
- 错误用法：将上游错误里的原生配置密钥直接写入数据库。正确做法是从实际发送头注册秘密，对查询、正文文件和错误说明统一脱敏，调用方响应保持原始字节。
- 错误用法：为了补日志重试一次模型。正确做法是展示采集缺口，保留唯一 attempt。
- 错误用法：给轻量运行时的请求行写入官方来源文件 SHA。正确做法是写入实际执行载荷 SHA，来源与加载器作为独立构建证据；历史原版请求继续保留原来有效的实际文件 SHA。

### 6. Tests Required

- tests/integration/control.test.ts：原始入站空白、扩展头决策、off/summary、截断、取消、慢消费者、写入故障和持锁写线程不阻塞/不重放。
- tests/integration/storage.test.ts：容量、摘要/正文分期过期、重启、正文丢失。
- tests/unit/observer.test.ts：分片、CRLF、错误、缺失终态、完整大事件也受观察上限约束。
- tests/unit/redaction.test.ts：原对象不变、已知秘密、代理密码、UTF-8 与部分凭据边界。
- tests/native/native.test.ts：控制层事先不知道原生密钥时，上游错误回显的秘密仍不能进入可查询日志。
- 同一原生套件对原版与轻量产物验证 binarySha256 真实；多轮复用、取消与流中退出后的日志归属和采集状态独立，初始化不制造虚假作业。
- 新原生样本导入前后核对既有详情投影哈希不变；独立 Node TLS rawHeaders 与实体正文可作有序原始头证据，Bun 接收的规范化头不能冒充 rawHeaders。生产最终采集能力不因离线补采而改变。

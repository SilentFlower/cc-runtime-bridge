# 本轮相关规范原文

来源：.trellis/spec/backend/logging-guidelines.md；完整规范仍以源文件为准，实施前按 spec_router 复核。

## .trellis/spec/backend/logging-guidelines.md:15

- RequestTrace.event(event: RuntimeEvent): void；finish(state: RequestState, error?: string): RequestState。
- requests 表保存 id、created_at、model、state、request_class、session_id、payload、context_json、decisions_json。
- captures 表保存 request_id、stage、attempt、payload、body_file；正文独立文件，payload.text 留空，按 request_id 级联删除。

### 3. Contracts

- CaptureStage 固定为 ingress、header_policy、cc_prepared、wire_final、upstream_response；每段绑定 attempt、capturedAt、source、representation、status、observedBytes、storedBytes、sha256、text、headers、note。
- ingress 使用 HTTP 原始 UTF-8 正文；不能 JSON 重序列化后声称是原文。哈希使用原始观测字节，预览先脱敏、再按完整 UTF-8 字符限长。
- cc_prepared 是 JS 原生传输前参数，CCH 可能为 00000。默认 off 的 wire_final 为 unavailable；按需 TLS 验证和显式本地常驻池实例分别遵循下文来源合同，不能重算补写或把中间值改标签充当最终值。
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

## .trellis/spec/backend/logging-guidelines.md:75

### 2. Signatures

- RequestContext.modelSelection?: { requested: string; effective: string; source: 'request' | 'startup_override' }；isModelSelection(value: unknown): value is ModelSelection。
- FinalCaptureSample 保留 body、headers、httpVersion、capturedAt、verified、note；新来源可附 source='native_tls_verifier'、observedBytes、sha256: string | null、complete、flushed、status='failed'。
- decodeTlsVerifierFrame(line: string, instanceId: string, previewLimit: number): TlsVerifierEvent；RequestTrace.finalCapture(read: () => FinalCaptureSample | null): void。
- GET /api/health 增加 tlsCapture、tlsVerifier 和 upstream；日志详情继续返回 RequestDetail。

### 3. Contracts

- 原始入站模型保留在 ingress；前置有效模型写入 RequestRow.model，选择证据沿 context_json 保存。共享解码器核对 effective 与行/作业根模型相同；历史缺字段保持缺省，不从当前配置补写。
- 私有封套固定 schema_version=1、instance_id；command_id 单调，指令为 init/begin/expected/finish/shutdown。ready 核对辅助 PID 和画像；capture 绑定 request_id、worker_id、worker_pid、connection_id 和单调 sequence。重复、跨归属或非法完整性关系不得写到下一请求。
- capture 来自最后上游 TLS 写入器实际接受的明文；body_bytes/body_sha256 覆盖实体已接受范围，http_bytes/http_sha256 覆盖请求行、头和实体。complete 表示全范围已接受，flushed 单独表示刷出成功，verified 再核对同次准备值及原生 CCH 槽位；待发送缓冲区不能整体算作已写出。
- wire_final 的新 source='native_tls_verifier'、representation='http_entity_from_final_tls_write'；note 记录 worker/连接、整体 HTTP 字节及哈希、刷出和固定原因。它不等于加密网络帧、第一跳接收，也不证明上游接收或执行。
- body_preview_b64 有启动侧预览上限，增量整体计数/哈希不截断。先注册实际发送头中的秘密，再脱敏保存正文和有序头；不完整前缀省略秘密边界，UTF-8/格式化后的预览不用于重算原观测哈希。summary/off 不保存原文，采集截断独立于模型终态。
- 默认 off 未取得样本时为 unavailable，不用准备值补写。部分写出或刷出失败为 incomplete；完整但核验不符为 failed。私有通道缺证显示 failed、sha256=null 和范围未知说明，不能把未知零值当成已确认没有发送。采集失败不触发模型重放。
- final_capture_ready 只通知已存入本请求的独立样本，允许流结束前刷新日志；completed/错误收口再次检查时不得覆盖已保存证据。旧池省略新来源字段时，仍保持 local_pool_node_tls_receiver/http_entity_body_after_native_transport 的接收语义。
- 健康 nativeFinalCapture 表示配置能力，不表示每次采集成功。tlsVerifier 包含 profile、sha256、target、recipe、state；upstream 只公开 endpoint 选择来源、根模型覆盖和 ingressPolicy，不返回真实端点或凭据。辅助程序失效单独显示 failed，不能仅以日志数据库健康认定验证器可用。


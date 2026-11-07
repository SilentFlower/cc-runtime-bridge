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
- cc_prepared 是 JS 原生传输前参数，CCH 可能为 00000。普通启动的 wire_final 仍为 unavailable；显式本地常驻池实例按下文独立合同采集，不能重算补写或把中间值改标签充当最终值。
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

## Scenario: 测试专用 TLS 最终采集与池 Messages 验证

### 1. Scope / Trigger

- scripts/test-pool.ts 在测试链路中采集 CC 原生最终出站，再向明确的 Messages 池转发；报告字段 ccFinal 不扩展生产 CaptureStage，生产 nativeFinalCapture 仍为 false。
- 复用已接纳的官方/精简二进制、Engine、RequestTrace 和 Redactor，不修改原生运行时、CC 目标、生产 EngineConfig 或数据库；池响应不能作为 Anthropic 鉴权或缓存命中证明。

### 2. Signatures

- bun run test:pool --binary <已登记文件> --output <新目录> [--serve <回环端口>]：缺省离线假池；控制端和假池处于独立无外网空间。
- bun run test:pool --live --pool-env <受保护文件> [--live-run <ID>] --binary <已登记文件> --output <新目录>：显式有界真实验收。
- bun run test:pool --report-only <报告目录> --serve <端口>：宿主只读查看；bun run test:pool:page <报告目录>：无外网浏览器验证，不运行模型场景。
- scripts/testing/pool-common.ts 统一定义 PoolConfig、BodySample、ForwarderFrame、DriverFrame 及解码器；pool-report.ts 定义 schemaVersion=1 的 PoolReport/PoolCaseReport。
- loadPoolConfig(path): Promise<PoolConfig>；validatePoolConfig(config): void；poolLedgerName(runId='first-run'): string；poolProxyEnvironment(env, live): Record<string,string>。

### 3. Contracts

- 配置文件为不超过 64 KiB 的普通文件，group/other 无权限，只解析赋值、不执行 shell。只读 CCRB_TEST_POOL_BASE_URL/API_KEY，兼容 PROJECT_REQUESTER_BASE_URL/API_KEY；来源冲突拒绝，模型/fallback 字段不读取，模型固定 deepseek-flash。
- Key 仅支持 4–4096 位 ASCII 字母数字及 ._~-。含引号、反斜杠、Unicode 等不支持格式在宿主与 Node 初始化时拒绝，避免 JSON 转义绕过字面脱敏；错误说明不回显 Key。此限制属于测试工具，不改变生产凭据合同。
- 真实目标必须 HTTPS；离线只允许回环 HTTP(S)。拒绝 URL 凭据/query/fragment 及 Anthropic/Claude 域名（含末尾点）；/v1 只拼接一次，保留原生 /v1/messages 查询串，不转换 OpenAI 协议。
- CC 驱动另处于仅 lo 的网络空间，独立 HOME/config、合成 Key、遥测 off，环境只有 HOME/LANG/PATH。CONNECT 仅接受 api.anthropic.com:443，固定接入权限 0600 的 Unix socket，不解析或直连该公网目标；启动自检实际拒绝普通 HTTP 和错误 CONNECT。
- 宿主独立 Node TLS 接收端保留实收 rawHeaders、实体正文和 HTTP 版本，启动校验有序重复头。2 MiB 请求预算只用于有限 acceptance；手工模式不套用。只收完整 UTF-8 的 Messages 正文，先由宿主独立核验非零原生 CCH 后才允许第二段；核验不能补写或生成出站 CCH。
- 第二段只改目标、根 model、鉴权及传输字段，保留其余业务、合法扩展头与父子归因。删除原 CC/代理凭据、Cookie、连接级字段及 Connection 声明字段，重建 Host、长度和 x-api-key，逐项说明原因。
- 真实池 Node 可通过 --use-env-proxy 复用经校验的 HTTP_PROXY/HTTPS_PROXY/NO_PROXY；大小写来源冲突、URL 凭据及非 HTTP(S) 代理拒绝。离线不继承宿主代理，CC 驱动也不继承；Node 缺少该选项时启动失败，不回退绕过代理。
- 每轮最多三次、串行、max_tokens=128，池预算 30 秒、CC 45 秒，首错停止，不重试、重定向、换模型或删字段。默认账本 artifacts/pool-tls-forwarder-live-first-run.json 排他创建，发送前预留场景；新预算须显式选择 --live-run，ID 限 1–64 位 ASCII 字母数字/下划线/连字符且首位为字母数字，使用独立同前缀账本。已有账本不覆盖，不自动开启下一轮；缺失回执时预留数是次数上界。
- 报告分别记录 ingress、ccPrepared、ccFinal、poolPrepared、poolResponse、bridgeResponse。ccPrepared 是中间值；ccFinal 来自 Node TLS 实收；poolPrepared 是客户端组装参数，不能称为池端原始网络头。各段保留来源、表示、原始 SHA256、观测/保存长度及完整性，预览最多 1 MiB，完整响应继续流动并参与哈希。
- forwarding 分开记录 attempted、outcome、upstreamStatus、localStatus、failureCode/error。只有观测到池响应头才设置 upstreamStatus；否则它及 poolResponse 为 null，本地 400/502 只出现在本地转发状态与调用方响应。异常只保存白名单码及受控说明，响应表示始终为逻辑字节。
- 驱动日志 off，必要数据走私有管道交宿主二次脱敏后持久化，结束并关闭驱动后扫描专用目录。Node 和驱动的脱敏上下文按请求隔离，避免上一响应的敏感名称标志值污染下一请求预览。预览含脱敏标记时以原始哈希比对，不反向填充值、不为补证据重放。
- 响应 JSON/SSE 逻辑字节直接返回，删除不匹配解压后正文的长度、编码及连接字段；取消向池请求传播，原生进程退役。场景终态复用 RequestTrace，HTTP 200/EOF 不能替代完整 Messages 终态。
- 报告写入独立新目录；只读服务器仅在回环开放 index.html/report.json，动态文本统一转义，无推理入口，查看或刷新不初始化 CC、不新增模型调用。旧回执和原版/精简身份保持。

### 4. Validation & Error Matrix

| 条件 | 必须行为 |
| --- | --- |
| 配置/Key 格式不支持、rawHeaders 自检失败 | 受控启动失败，零池模型发送，不回显秘密 |
| 非 Messages 路径、损坏 UTF-8、超限、CCH 不符 | 拒绝/关闭连接或标记采集失败，不转发池，不用中间值填补最终采集 |
| 连接失败、池超时且尚无响应头 | upstreamStatus=null、poolResponse=null；本地 502 单列，无重试 |
| 池 401/429/500 或 3xx | 保留已观测状态/逻辑字节，3xx 不跟随，真实验收首错停止 |
| SSE error、缺少 message_stop | stream_error/incomplete；不得因 HTTP 200 判成功 |
| 主动取消或慢流超时 | 取消中止池转发并报告 canceled；超时报告 timeout/未完成采样，清理有界 |
| 秘密回显、跨片段、超过预览限额 | 脱敏预览，保留实际观测字节哈希；截断不阻塞完整响应 |
| 已有轮次账本、仅查看报告 | 不覆盖或重新推理；查看不暴露配置/证书/任意文件 |

### 5. Scenarios and Examples

- 正常：Claude 模型原生请求经 TLS 完成 CCH 后，仅第二段改为 deepseek-flash；真实 JSON/SSE 响应的逻辑字节 SHA256 与调用方一致，池模型名和输出不改写。
- 边界：调用方在 SSE 首片后取消，转发器 canceled、工作进程退役；这只证明本地转发已中止，不证明池内计费或后台执行已结束。
- 错误用法：把未收到池响应时生成的本地 502 写成 real_pool_response。正确做法：poolResponse=null，并显示 forwarding.localStatus 与受控诊断。
- 错误用法：复用整个运行批次的脱敏上下文，上一响应 allow-credentials=true 导致后续 stream=true 被遮住。正确做法：按请求建立上下文；历史预览保留原样，以原始 SHA256 验证请求差异。
- 错误用法：失败后删除账本自动再试或改用 Gemini。正确做法：保留原轮次及失败；明确新预算后才显式选择独立轮次，仍执行相同三场景与首错停止。

### 6. Tests Required

- tests/unit/pool-forwarder.test.ts：受保护配置、来源冲突、ASCII Key 格式、JSON/SSE 跨片段回显、哈希/截断、路径/模型映射、预算、轮次安全、私有帧解码、报告转义与文件白名单。
- tests/integration/pool-forwarder.test.ts → tests/pool/transport.test.ts：独立无外网空间内真实 Node rawHeaders、非法 Key 零请求、拒绝/超限、单次发送、HTTP 错误、重定向、背压、取消、超时、无池响应的本地 502、代理路由和跨请求脱敏隔离。
- 原版/精简分别跑 test:pool 离线矩阵，核对 CCH、头部/metadata/父子归因、仅根 model 改动、准备预览、凭据边界、取消退役及结束后的目录扫描。
- 显式真实验收独立记录三次上限、原始 CCH/哈希及 JSON/SSE/取消结果；失败保留实际结果，普通 test/typecheck/build 不访问真实池。页面验收覆盖桌面、390 像素、文本安全、三次刷新零推理及历史文件摘要不变。

## Scenario: 本地 Claude Code 常驻池联调与最终采集

### 1. Scope / Trigger

- scripts/local-pool.ts 提供用户手工发请求的常驻 Base URL，独立于三次小预算验收；复用产品服务、原生 Engine、TLS 接收端、脱敏和日志页。
- 有限验收和用户手工链路保持独立，既有账本不覆盖；桥接缺省无预算规则由 runtime-contract.md 所有。只有本地实例配置已自检采集端时，才报告 nativeFinalCapture=true。

### 2. Signatures

- bun run start:pool --run <新ID> --binary <固定原版293> --pool-env <受保护文件> [--port <端口>]；默认 127.0.0.1:8787。
- startLocalPool(options: LocalPoolOptions): Promise<LocalPoolRunning>；startServer(config, injectedEngine?, startup: ServerStartupOptions = {}): Promise<RunningServer>。
- ServerStartupOptions 包括 nativeIngressPolicy、secrets、finalCapture(requestId)、localPoolStatus()，仅启动调用方可设置，不接受 HTTP 注入。
- FinalCaptureSample = {body, headers: HeaderPair[], httpVersion, capturedAt, verified: boolean, note}；RequestTrace.finalCapture(read: () => FinalCaptureSample | null): void。
- LocalPoolLedger.create(path, runId, live, budget)、reserve(requestId)、finish(requestId, result)；LocalPoolEngine.takeFinalCapture(requestId) 取出并清理同请求样本。
- PoolTransportObserver.run<T>(operation: () => Promise<T>): Promise<T>、snapshot(): PoolTransportDiagnostics、close(): void；decodePoolTransportDiagnostics(value: unknown): PoolTransportDiagnostics 集中规范化观测字段，ForwarderFrame.finished 可携带 transportDiagnostics。
- startIsolatedProxy(socketPath: string): Promise<IsolatedProxy> 使用隔离空间内的 Node 字节代理；私有初始化只含 socketPath，回执为 ready(port) / stats(proxyRequests,rejectedRequests)，仅接受 shutdown 或父管道 EOF 关闭。

### 3. Contracts

- PoolConfig.mode 显式区分 acceptance/manual；缺省沿用原验收。live 必须如实表示真实池或离线回环，不得用 false 放开外部调用。原有 URL、Key、模型映射及代理规则复用上文测试 TLS 合同。
- CLI 手工模式默认不限请求次数，PoolConfig.maxRequests=null；null 仅允许 manual，显式有限手工实例仍支持 1–20 次。模型参数原值交池判断，不设输出范围、温度范围、thinking 枚举/最小预算或工具组合政策；必要结构检查沿 runtime 合同。手工 PoolConfig.timeoutMs=0、桥接/驱动预算为 0，不附加请求总时限、旧 50 秒事件等待或旧 5 秒核验截止；0 不创建计时器，有限实例的显式正预算仍可用于测试。每个入站最多一次池发送，不重试、不跟随重定向、不回退；客户端重发为新调用。旧真实验收三次/128 tokens、显式超时和首错停止保持，不能用 null 或 0 绕过自动验收预算。
- artifacts/local-pool-runs/<run>/ledger.json 排他创建，发送前持久预留，同目录不覆盖重置；预留数是异常情况下实际尝试上界。保存 requestId、时间、attempted、upstreamStatus、localStatus、outcome，以及可选 failureCode、transportDiagnostics，不保存 Key 或正文；旧记录缺少新增字段时保持未知，不回填。
- PoolTransportDiagnostics.phase 为 unknown / before_send / sending / awaiting_headers / response_body；bodySentObserved 为 boolean|null，connectionBytesWritten/connectionBytesRead 为非负安全整数或 null。阶段只表示本地观测：sendHeaders 早于实际写入，bodySent 也不能证明池已执行。计数来自当前模型 POST 所关联连接的累计值，不是每个请求或池端实收字节；CONNECT、其它请求及无可靠关联的计数不得混入。
- 诊断按模型 POST 的异步作用域和 request 对象关联；当前转发结束释放订阅、请求映射及连接引用。不可用观测降为 unknown/null，不改变模型结果或触发重放。集中解码仅保留固定诊断字段与 POOL_FAILURE_CODES 白名单；未知错误码采用通用类型，不持久化任意异常 message、URL、头或正文。
- /api/health.localPool 返回 runId、model、live、budget、reserved、remaining；不限次数时 budget/remaining 为 null，reserved 持续计数，不能把 null 当成零额度。ready.json 保存 PID/Base URL 与运行元数据；启动、自检、健康检查和页面刷新均不发模型请求。
- 驱动环境只有 HOME/LANG/PATH，独立仅 lo 网络、专用 HOME/config、合成 Key、遥测 off；只接受固定 CONNECT 接入私有 socket。池真实 Key 仅由宿主/Node 持有，不进入原生进程、进程命令行或私有资源文件。
- CONNECT 密文由隔离空间内的专用 Node 进程透明转发，继续拒绝普通 HTTP 和错误目标；Bun 管道的大正文 TLS 解密失败不能靠改正文、降级 TLS 或降低测试大小绕过。代理只回传端口与计数，凭据不进入配置，关闭清理自身进程及临时 bundle。
- 原生 ready 回调在业务投递之前逐物理进程核验启动环境并保留证据；不能在大正文处理后依赖不完整 /proc 环境采样误判凭据变化。私有帧保留结构、归属及 EOF 校验，不对业务正文设置 8/24 MiB 门槛；日志预览继续独立有界。
- 驱动 run/cancel/shutdown 指令及 LocalDriverFrame 由集中解码器负责，沿用 RuntimeEvent 校验；同请求终态和真实 idle 收口，产生 TLS 采集时还须等待其 finished，之后才释放串行槽位。PrivateProcess.next(0) 允许常驻空闲，不能套用有限验收的空闲超时。
- wire_final source=local_pool_node_tls_receiver，representation=http_entity_body_after_native_transport，来自 Node 实收 rawHeaders/实体/版本，采集在第二段根模型及鉴权映射前。先核对活动请求、唯一采集、会话及独立正确非零 CCH 才允许池转发；拒绝重复或错归属帧。
- 池 Key 在 RequestTrace 创建前注册；TLS 样本在处理池响应头前保存，避免敏感名称响应标志影响此前请求预览。继续遵守 off/summary/debug、UTF-8 限长及原始哈希；脱敏预览不能用于反向校验或补造原文。
- 提供者返回 null 表示 unavailable，异常或 verified=false 表示 failed 并显示 captureError；采集故障不改变已取得响应的模型终态、不触发重放。第二段参数与真实池端实收仍严格区分。

### 4. Validation & Error Matrix

| 条件 | 必须行为 |
| --- | --- |
| 相同目录已有账本 | local_pool_run_exists，保留原内容，CLI 启动失败 |
| 回环端口冲突 | local_pool_port，清理本次启动资源，零池推理 |
| 手工原生正文 max_tokens=128000、thinking.type=adaptive | 保留参数转发；模型能力由池校验，池错误沿现有响应路径返回 |
| 入站关键字段结构不合法或数值不能表示为有限 JSON 数值 | 本地拒绝 400，不发送池；不把模型范围问题混入 |
| 手工首响应等待超过 50 秒、完整请求 66 秒 | 正常完成，不套用本地默认截止 |
| 手工正文 26 MiB | 完整转发及独立哈希/CCH；日志仅截断预览 |
| 不限次数的手工实例超过 20 次 | 继续转发并计数，不产生本地额度错误 |
| 显式有限实例耗尽其配置次数 | 本地 429/POOL_BUDGET_EXHAUSTED，不发送池，upstreamStatus=null |
| 池连接失败或显式预算超时，尚无响应头 | 本地 502，池状态为 null，单次尝试记入预算 |
| 模型 POST 正文发送后、收到池响应头前断连 | 可记录 awaiting_headers/bodySentObserved=true，upstreamStatus=null；不据此判定池未执行或自动重试 |
| 代理 CONNECT 失败，模型请求尚无发送观测 | before_send 或 unknown，模型连接累计计数保持 null，不使用代理握手的计数 |
| 诊断缺失、字段损坏或订阅回调异常 | 缺失保持兼容；非法观测归一化为 unknown/null，额外载荷丢弃，原转发结果不受影响 |
| 取消或响应异常 | 取消传到池，原生进程退役，后续新作业可重建，当前不重放 |
| 最终样本缺失、失败、日志截断 | 分别显示 unavailable/failed/truncated，不拿中间值补写 |

### 5. Scenarios and Examples

- 正常：用新轮次及受保护配置启动，再在临时终端设置 ANTHROPIC_BASE_URL=http://127.0.0.1:8787、合成 ANTHROPIC_AUTH_TOKEN，运行 claude --model claude-sonnet-4-6。池侧根 model 实际为 deepseek-flash，原生进程不取得池 Key。
- 边界：默认手工实例超过 20 次继续发送，128000 输出预算与 adaptive thinking 原样到达池；26 MiB 正文、52 秒首响应等待及 66 秒全程正常完成。显式配置 20 次的有限实例在第 21 次本地拒绝；同轮目录不能覆盖历史报告和账本。
- 错误用法：从某个 Claude 模型的默认输出预算推断池上限，再本地拒绝或裁剪。正确做法：手工链路保留原值，由实际池返回支持情况；自动验收仍用显式小预算。直接用有限验收脚本常驻、把 live=false 指向真实池、给 Base URL 再加 /v1，或把预览 CCH 当作原始校验输入仍属于错误用法。
- 错误用法：收到 UND_ERR_SOCKET 且未见池响应头，就认定请求没有发送并重试。离线可复现池读完整 POST 后关闭连接的同一错误；正确做法是记录观测阶段和受控错误，单次失败收口，允许下一独立请求执行。诊断改进不能冒充原始真实故障已解决。

### 6. Tests Required

- tests/unit/pool-forwarder.test.ts：手工 null/0 及连续 25 次账本记录、验收拒绝 null/0、真实/离线手工 32769 与 128000 原值保持、大正文私有帧、显式有限 20 次预留、旧三次/128 限制、账本排他与真实状态。
- 同一单元套件核对诊断损坏降级、零值/未知区别、额外敏感字段丢弃、错误码白名单、旧回执兼容及观测失败不改变原操作；tests/pool/transport.test.ts 的真实 Node 直连/HTTPS 代理矩阵核对收头前断连、流中断、CONNECT 拒绝、单次池实收和下一请求恢复，tests/local-pool/gateway.test.ts 核对实际 CLI 回执经宿主持久化到账本。
- tests/integration/control.test.ts：启动侧秘密、最终样本缺失/异常、off/summary/debug、原始 SHA256 与截断，采集失败不改变响应。
- tests/integration/local-pool.test.ts 包裹 tests/local-pool：无外网模拟池，真实客户端/工具续轮/交互终端、子代理、端口冲突、取消、错误/显式超时/重定向、显式有限 20 次拒绝及不限次数连续 25 次保持参数；另验证 Sonnet 5、26 MiB 完整正文和 66 秒长请求、启动环境及凭据落盘；桌面及 390 像素页面、脚本安全、三次刷新零推理。
- 当前原版 + preload 的离线池场景回归，旧轻量产物不声明已包含新源码合同；真实手工实例只检查健康/页面及隔离，不自动发送真实池推理。

## Scenario: 基于客户端启动证据的代理关联视图

### 1. Scope / Trigger

- 实际 CLI 子代理可能只提供 session、agent ID 和子代理 billing，没有 parent-agent-id 或 agent-type。日志可补充有证据的关联视图，不能冒充原始入站或当时实际发送值。

### 2. Signatures

- collectAgentLaunches(prepared: PreparedInput): AgentLaunches；resolveAgentAssociation(context: RequestContext, candidates, incomplete): AgentAssociation。
- RequestRow.agentLaunches 可选；LogStore.detail(id) 的 RequestDetail.agentAssociation 可选；isAgentLaunches / isAgentAssociation 与 decodeLogDetail 集中验证。

### 3. Contracts

- 只对已识别原生入站提取：assistant Agent tool_use 与 user 的同 tool_use_id 成功 tool_result，固定 293 成功启动格式中的 childAgentId，匹配调用的 subagent_type，以及证据所属请求的规范 parentAgentId。自由文本、失败结果或孤立块不构成启动证据，重复/未知成功格式明确不完整。
- AgentLaunches={state:complete|incomplete,links:[{childAgentId,parentAgentId,agentType,toolUseId}]}，两个缺失关联字段为 null。最多 32 条、JSON 容器及分隔符在内最多 16 KiB、最多扫描 4096 个内容块；父代理和类型沿既有 512 字符及 Latin-1 无控制字符边界，childAgentId/toolUseId 另限 128 位字母数字下划线连字符。
- 元数据经 Redactor 后沿既有 request payload 保存，不新增表或迁移历史。脱敏破坏身份、超限、提取异常时保存 incomplete，不把占位符当 ID。off 不保存新记录，summary 保留必要证据摘要而不保存工具正文，证据随日志容量及保留期清理。
- 详情关联只读查询同 sessionId、同 childAgentId；数据库先按声明去重再返回最多 32 条，额外取一条检测溢出。重复历史不耗尽额度，取出的内容和证据请求 ID 同源，不扫描调试正文或创建全局永久关系 Map。
- AgentAssociation={state,parentAgentId,agentType,parentSource,typeSource,evidence:[{requestId,toolUseId}]}。state=explicit|linked|unknown|conflict|incomplete；来源=explicit|client_tool_result|unknown。显式值优先，不同声明不任意取最新值；空值和 unknown 来源一致。
- 后到证据在刷新时可见，不回写 context、原始请求行的父代理值、capture/SHA 或已发送头。旧记录无元数据则未知；证据是客户端声明，不是身份认证。默认 agent:custom 不能证明实际类型为自定义代理。

### 4. Validation & Error Matrix

| 条件 | 关联视图 |
| --- | --- |
| 两字段显式给出且无矛盾 | explicit，值保持 |
| 缺失字段由同会话的完整一致证据补齐 | linked，来源及证据定位可见 |
| 无证据、证据过期、旧记录无新字段 | unknown，不猜直接父代理或类型 |
| 不同父代理/类型，或证据与显式值矛盾 | conflict，显式值保留，不任取冲突值 |
| 提取/查询超限、损坏、查询失败或采集缺口 | incomplete，未确认字段不补齐，不重放模型 |
| 相同 ID 出现在不同会话 | 不关联 |

### 5. Scenarios and Examples

- 正常：子代理先到，主会话后续消息含配对启动记录；刷新子代理详情可显示父代理和 Explore 类型，发生时字段仍为空。
- 边界：同一启动历史出现在 33 条请求中仍可关联；证据正文过期而摘要有效时仍可查，证据摘要被清理后恢复未知。
- 错误用法：把同会话主请求当所有子代理的直接父代理，或用后来证据改写过去的出站头。正确做法：按成功工具结果及所属规范上下文关联，仅更新只读视图。

### 6. Tests Required

- tests/unit/request-attribution.test.ts：角色/ID/工具/成功格式配对，伪造文本、重复、块数/字节/条数上限、显式值、冲突和未知。
- tests/integration/storage.test.ts：迟到、多子代理、嵌套、跨会话、重复去重、超限、损坏、summary/off、脱敏、重启及清理；原始快照不变。
- tests/local-pool/attribution.test.ts 与 tests/browser/logs.spec.ts：实际子代理报告回传、关联与来源、证据跳转、历史兼容和手机布局。

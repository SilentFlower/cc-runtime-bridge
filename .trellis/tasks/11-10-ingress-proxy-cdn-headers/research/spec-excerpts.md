# 规划时项目规范摘录

本文件是任务上下文快照。来源以各段标注的路径、行号及 SHA256 为准。本任务中用户确认的白名单合同覆盖原有未知头默认保留约定。

## .trellis/spec/backend/runtime-contract.md

来源 SHA256：`b6800a3714eaba1cd1804637c8795a4ba6c6b76495f912e705424b786a0d14ca`。

### 第 28–51 行

- 原生模式显式提供 CCRB_CLAUDE_BINARY、CCRB_CLAUDE_HOME、CCRB_CLAUDE_CONFIG_DIR；可提供 CCRB_NATIVE_API_KEY、CCRB_NATIVE_OAUTH_TOKEN、CCRB_PROXY_URL、CCRB_CA_FILE、CCRB_NATIVE_BASE_URL。子进程使用环境白名单；显式代理同时写入 HTTP_PROXY/HTTPS_PROXY，不继承宿主代理或账号。
- 启动工作进程与配对性能脚本统一设置 CLAUDE_CODE_ENTRYPOINT=cli，由原生代码生成 User-Agent 的 cli 入口段及 billing 的 cc_entrypoint=cli；requestClass、agentKind 和父子身份仍独立按真实上下文生成。切换入口须重建进程，历史 sdk-cli 日志保留原采样值，不能仅替换日志或正文中的标签。
- 普通 API 以固定 293 交互 CLI 主请求为参考，主来源为 repl_main_thread、业务用户消息采用 human；-p 的 SDK 行为仅作差异证据。原生 pie、VA/Kz/LT/Uz 及 OM 生成工具、system、提醒和默认模型参数，不手写身份句或用录制请求模板替代；工具结果及六类上下文保持实际来源。完整原生正文走后文的保真分支。
- 两条路径的 tools 省略与 [] 均无工具，非空列表完整采用调用方定义，不加入 CC 内置、延迟、搜索或占位工具。普通 API 的原生 system 和提醒按实际列表生成，CLI 参考须使用对应工具选择；system 省略时使用 CLI 默认正文，显式值按 --system-prompt 替换，空文本/数组同样属于显式替换。普通 API 的显式消息、工具/thinking 和模型参数在发送前核对；工具数组即使省略也核对空列表，不能无损表达时拒绝，不静默删字段。原生业务正文不借用种子的字段政策。
- 每个引擎绑定一个账号环境，首个模型作业惰性启动，正常串行作业复用一个物理进程，不另设 16 项准入门槛。HOME、配置、凭据来源、代理及 cwd 不按请求切换；更换配置须关闭并重建引擎。服务关闭后不再接收作业，并等待队列和常驻进程退出。
- 请求预算、大小与排队政策交前置服务。CCRB_TIMEOUT_MS、EngineConfig.timeoutMs 和 ServiceOptions.timeoutMs 默认 0，不创建请求总计时器；.env.example 同步为 0。显式正整数仅在计时器可表示范围内启用预算。HTTP 不施加 2 MiB 门槛或空闲截止，私有模型正文不施加 8/24 MiB 字节门槛；JSON、归属、状态与完整性校验保留，日志预览上限不限制转发。取消、关闭和取消后的清理宽限独立处理。
- 控制配置中的显式 API key 使用官方本地规则只记录使用确认标识，不保存完整密钥；已有 rejected 决定返回 native_configuration/503，不改写拒绝状态。初始化、预热及测试不能因此触发真实账号登录或付费推理。
- worker_ready 晚于原生绑定、Nst 与本地构造依赖初始化；本地初始化使用独立根，发送前中止，不发模型请求或业务事件，成本计入总启动时间。每轮经 nEr 创建全新原生根，AsyncLocalStorage/yLs 绑定作用域，再调用 t_；同 sessionId 也不能复用上一轮账本、请求日志及取消状态。
- 普通 API 只支持 docs/api.md 登记的正文键。内部 Re/Kc 负责消息实体；原生规范化后的显式消息、工具、thinking 等必须保留，不可表达时拒绝。原生入站的扩展正文及必要改写另见后文合同。
- 普通 API 的 business 构造仅对完整对象恰为 thinking={type:'disabled'} 且原生结果缺失 thinking 的情况补齐原值，同步 result 与 init.body 后再做完整保留校验。省略保持原生默认；额外字段和原生已有不同值不适用补齐，不能静默删改。transport_context 种子与完整原生业务不应用此适配。cc_prepared、同次 Ree 实际发送及 TLS 哈希必须反映相同正文；上游仍返回 thinking 时原样保留，不过滤或重发。
- OM 的 deps.callModel 仅进入一次 K_t；其 fetchOverride 取得同一官方 SDK 的正文、头及发送上下文，在显式字段核验后由 Ree 唯一发送。stream 仅按调用方明确值映射；SDK 不取得 Response，桥接独占原始逻辑响应，读取收口后立即取消原生解析。调用次数守卫禁止模型重试，不创建第二个 SDK，不替换全局 fetch；本地工具、代理循环及自动辅助压缩禁用，显式 compaction 保留。
- 只在精简构建复用固定摘要的六个纯正文格式化函数 KLo、XLo、QLo、nNo、sNo、pNo。每次仍求值原生条件与外层钩子，每个工厂仅保留最近一次原始条件及字符串；UTF-8 键和值每项 ≤64 KiB、六项 ≤384 KiB，不代表堆或 RSS 上限。失败和超限不入缓存；整份提示词、权限/工具选择、会话段落表、memory 读取及请求正文不跨作业缓存。
- HTTP 与 RuntimeEvent 保持 schema_version=1、request_id；事件包含 ready、cc_prepared、response_headers、response_chunk、completed、error；final_capture_ready(attempt=1) 仅由控制侧独立采集器产生，工作进程不得伪造。ready 表示本轮已绑定就绪进程，不代表每轮新建 PID。attempt=1，片段使用可逆 base64。
- 私有 stdin/stdout 使用 schema_version=2、worker_id；request_start 携带 request_id/prepared，request_cancel 携带匹配 request_id，worker_shutdown 关闭进程。输出为 worker_ready(version,pid)、request_event(request_id,payload)、worker_idle(request_id)。payload 禁止覆盖 schema_version、worker_id、request_id。
- 握手前还可返回 worker_error(code=native_configuration,status=503,error)，不带 request_id 或额外字段。error 只公开受控 BridgeError 配置说明，先脱敏且 ≤2048 UTF-8 B，未知异常用通用中文消息；入口等待帧写入完成后退出。错进程归属、握手后错误帧或畸形字段按 runtime_protocol/502 隔离，失败作业不重放。
- 每个物理进程只有一个持续读取器。唯一终态与匹配 worker_idle 缺一不可；释放响应并等待 SDK 收口后才发 idle。重复握手、错代次/错请求、双终态、终态后事件、缺 idle 或畸形帧均隔离进程；读取回调和输出闭包绑定旧代次，不得归入下一作业。取消、异常或状态不明时退役，下一轮重建，不重放当前请求；取消采用 1500 ms 强制终止宽限，空闲关闭优先 shutdown，1500 ms 后仍未退出则强制终止。
- cc_prepared 的正文、body_bytes、body_sha256 在 Ree 前固定，快照输出与唯一发送可并行，但两者成功后才交付响应事件；任一失败取消原生调用并释放未交付响应。原文和 headers 只在私有管道传递，控制层先注册秘密再脱敏持久化；stdout 不兼任普通日志。默认 off 的 wire_final 不可用；启动侧可按下文开启独立验证，来源必须对应实际采集位置，不以 cc_prepared 冒充最终值。
- Connection 声明字段和连接级字段删除；调用方凭据不作为上游凭据；版本、传输、X-Stainless-*、X-Client-Request-Id 等由运行时生成。其余合法端到端扩展默认保留，不允许笼统删除 x-claude-code-*。
- 透传头与 SDK 默认头重名时，先聚合调用方完整的同名有序值，再覆盖该默认值；不能在默认值后再次 append。Accept 和 anthropic-dangerous-direct-browser-access 不因 SDK 已有相同默认值而重复，调用方显式不同值和合法多值仍保持；beta/version 及运行时所属字段沿各自专用规则处理。
- 上下文为类别、agentKind、agentId、parentAgentId、agentType、sessionId、promptId、workflowRunId 的同一来源。promptId 必须为 UUID。
- 普通 API 的有效 promptId 归到最近一条不含任何 tool_result 的 user 实体，由官方轮次选择器生成 billing 与请求头；工具结果及混合结果不冒充新的 human。显式 ID 可由调用方跨工具往返复用，省略仍按请求生成，不用 sessionId 代替，也不共享上一原生根。没有可归属用户轮次时在构造前返回 unsupported_parameter/422，零发送。
- 类别支持 main、subagent、workflow、compaction、auxiliary、side_reply。子代理必须有 agentId；workflow 还需要 workflowRunId；主代理独立 agentId 须显式 agentKind=main。
- 响应逻辑字节原样返回，删除不匹配逻辑正文的长度、编码及连接字段。工具交给调用方，不注册本地执行器。取消解除待消费片段并收口原生进程，不重放模型请求。
- 新增公共类、接口和公开方法写中文 JSDoc；导入或调用现有内部接口前读取定义与实测证据。

### 第 124–134 行

### 3. Contracts

- CCRB_NATIVE_BASE_URL 可选，不设置时不传 ANTHROPIC_BASE_URL；只接受无凭据、query、fragment 或空白的 HTTP(S) 绝对地址，保留 SDK 路径前缀语义。旧精简运行时尚未验证该配置时明确拒绝。
- CCRB_MODEL_OVERRIDE 只在前置覆盖根 model，原始入站保留；历史消息、工具内部同名字段及分类证据保持。CCRB_NATIVE_INGRESS_POLICY 默认 strict，local_base_url 仅由启动侧开启，与上游和验证开关独立。
- CCRB_TLS_CAPTURE 默认 off：官方 CC 直接对外，不创建辅助进程、监听或私有 CA。verify 仅覆盖 Linux x64、固定官方原版 293、HTTPS Messages/HTTP1.1、遥测 off、直连或 HTTP CONNECT 上游代理；不支持组合明确拒绝，不改用 Node 或隐式直连。
- verify 的 TLS 实现为独立固定画像，CC 仍唯一生成业务、账号上下文及最终 CCH。内部自定义目标是否产生 CCH，取决于同次内部 CC；prepareNativeBody 只按实际生成上下文准备或省略占位，不强行补回。
- 本地认证 CONNECT 同时核对冻结目标及实际 worker PID 的 TCP/socket FD 所有权；一条原生连接对应一条上游连接。上游 CONNECT 沿用原生字节、头顺序和连接特征，只删除本地代理凭据或替换为冻结的上游代理凭据。Messages 请求行、头和正文不经二次 HTTP/JSON 组装。
- 作业在实际 ready 后绑定代次，取得 cc_prepared 校验依据后才写上游；不新增 HTTP 池、请求重试、模型回退或默认总时限。取消/退休先收口本代连接，保留原生复用、重连与半关闭语义；3xx 原状态返回并记 http_error，不自动跟随。
- CCH 槽位定位接受现有 billing 合同的前导空白、尾部空格/制表符、首/末字段；只在观测副本中改变一个已知 ASCII 字符，比较序列化首个差异后换算 UTF-8 偏移。业务可包含任意同名标记或 CCH 示例文本，不能以固定哨兵冲突拒绝；无 CCH 时 offset=null。该过程不改发送正文，也不生成最终 CCH。
- 辅助程序按固定依赖锁、第三方快照及许可独立构建，生产不引用外部 cc2api 工作目录或缓存 rlib。构建记录不自动授信；核验独立 SHA256 后经打开的 FD 执行。产物采用原子更换路径，不能原地截断已运行进程映像。


## .trellis/spec/backend/logging-guidelines.md

来源 SHA256：`56ce264b2ea3d70a0914523baabd7535d134f711c1a695cf828dd84a813bbf57`。

### 第 20–39 行

### 3. Contracts

- CaptureStage 固定为 ingress、header_policy、cc_prepared、wire_final、upstream_response；每段绑定 attempt、capturedAt、source、representation、status、observedBytes、storedBytes、sha256、text、headers、note。
- ingress 使用 HTTP 原始 UTF-8 正文；不能 JSON 重序列化后声称是原文。哈希使用原始观测字节，预览先脱敏、再按完整 UTF-8 字符限长。
- cc_prepared 是 JS 原生传输前参数，CCH 可能为 00000。默认 off 的 wire_final 为 unavailable；按需 TLS 验证和显式本地常驻池实例分别遵循下文来源合同，不能重算补写或把中间值改标签充当最终值。
- context.inputFormat 可选 api / claude_code，只由输入解析写入，沿既有 context_json 持久化，不增数据库列或回填旧记录。普通 API 中间段来源为 claude_code_293_cli_prepared，原生为 claude_code_293_native_ingress_prepared；默认 preserve 的原生说明只改账号身份及 CCH 占位。显式 sub2api 实际应用时说明增加消息缓存断点处理；运行时可选 cache_policy 诊断经共享协议校验后投影到已有 capture.note，记录应用/保留/跳过及原因和位置。历史缺失字段保持可读，不把这些诊断称为真实缓存命中。demo 始终保持 demo_fixture，不能因输入是原生形状就标成实际原生发送。
- 响应 representation=response_logical_bytes。原生 fetch 可能已解压，不称为线上压缩帧。
- Content-Type 仅取分号前的媒体类型主体，去首尾空白并忽略大小写后精确匹配 text/event-stream；参数中的同名文本不切换观察器。SSE 接受 LF、CRLF、CR 及混合换行，CRLF 跨片段时仍为一个换行；规范化只用于内部观察，不改写转发及采集的原始逻辑字节。
- 模式 off 不新增记录；summary 保存摘要、关联、阶段状态而不保存原文和头值；debug 保存有界脱敏原文。既有历史不会因 off 删除。
- CCRB_CAPTURE_BYTES 默认 1048576，CCRB_LOG_BYTES 默认 536870912，CCRB_RETAIN_DAYS 默认 7，CCRB_DEBUG_RETAIN_DAYS 默认 3 且不超过摘要期。
- 总量按 JSON UTF-8 载荷和正文大小计数，SQLite 页/索引/WAL 另有开销；queued/running 的摘要和正文均不参与期限或容量回收。终态后期限仍按原 created_at 计算，可立即过期；容量超限按最旧完成记录回收。启动、写入及每分钟清理。
- 独立线程写入，队列最多 64 快照或 16 MiB。热路径不等待 flush；日志故障不得阻塞当前响应或触发模型重放。
- 同一 LogSnapshot 的请求行、上下文、决策和全部变化阶段索引在一个 SQLite 写事务中发布。先准备本轮唯一正文文件，任一文件或阶段写入失败都不能部分更新已提交索引；未引用的新文件沿用孤儿清理，旧正文继续保护既有读者。
- LogStore.detail 在同一同步只读事务内取得请求、阶段索引及关联元数据，结束事务后才异步读取正文；不得跨 await 持有读事务，也不能用查询端延时替代写入原子性。
- 私有运行时头先注册已知秘密，再统一脱敏；覆盖原生端单独持有凭据的情况。私有 IPC 不能另作普通诊断日志落盘。
- 响应片段先拼接有界前缀再脱敏；截断或中断时额外省略秘密边界，不能保存部分凭据。展示哈希不得对脱敏或格式化后的内容复算。
- 请求终态与采集状态分开：HTTP 200 不代表 SSE 成功，正文截断也不意味着模型失败。
- 只读查询不初始化 CC、不登录、不刷新账号，失效进程不影响持久详情。
- requests 快照中的 binarySha256 为实际执行体身份：原版是原文件 SHA，轻量版是经 /proc 核对的 memfd 载荷 SHA。来源与外层分发 SHA 在固定接纳表及构建清单中独立保留，不改写既有历史记录，也不把外层 SHA 冒充执行体。常驻复用和本地初始化不生成额外业务请求日志。


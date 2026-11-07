# 本轮相关规范原文

来源：.trellis/spec/backend/runtime-contract.md；完整规范仍以源文件为准，实施前按 spec_router 复核。

## .trellis/spec/backend/runtime-contract.md:23

### 3. Contracts

- 固定官方 2.1.293 来源，SHA256 为 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。创建引擎与每次加载新进程校验完整分发文件；暖复用检查真实路径、dev/inode、大小及纳秒 mtime/ctime。通过已核验 FD 启动，避免路径替换后执行另一文件。官方程序与提取源码不提交。
- 轻量入口仅接纳固定登记的外层及执行体身份，外部 manifest 不授信。当前基底为原版 Bun 1.4.3；原生代码保留，ICU 仅按固定 C.UTF-8 环境保留 root/en、完整字符/规范化数据和全部分词规则/字典。它是桥接专用程序，不能宣称具备通用 CLI 的全部 Intl locale 定制。
- BCJ2/LZMA2 与静态 C SDK 加载器单文件分发；载荷 SHA256 自校验后写入封存 memfd 并 fexecve，同 PID 执行，控制层再核对 /proc/<pid>/exe。运行不依赖原版、提取目录或构建工具；磁盘、内存文件与 RSS 分列，不把内存展开当作内存节省。
- 原生模式显式提供 CCRB_CLAUDE_BINARY、CCRB_CLAUDE_HOME、CCRB_CLAUDE_CONFIG_DIR；可提供 CCRB_NATIVE_API_KEY、CCRB_NATIVE_OAUTH_TOKEN、CCRB_PROXY_URL、CCRB_CA_FILE、CCRB_NATIVE_BASE_URL。子进程使用环境白名单；显式代理同时写入 HTTP_PROXY/HTTPS_PROXY，不继承宿主代理或账号。
- 启动工作进程与配对性能脚本统一设置 CLAUDE_CODE_ENTRYPOINT=cli，由原生代码生成 User-Agent 的 cli 入口段及 billing 的 cc_entrypoint=cli；requestClass、agentKind 和父子身份仍独立按真实上下文生成。切换入口须重建进程，历史 sdk-cli 日志保留原采样值，不能仅替换日志或正文中的标签。
- 普通 API 以固定 293 交互 CLI 主请求为参考，主来源为 repl_main_thread、业务用户消息采用 human；-p 的 SDK 行为仅作差异证据。原生 pie、VA/Kz/LT/Uz 及 OM 生成工具、system、提醒和默认模型参数，不手写身份句或用录制请求模板替代；工具结果及六类上下文保持实际来源。完整原生正文走后文的保真分支。
- 两条路径的 tools 省略与 [] 均无工具，非空列表完整采用调用方定义，不加入 CC 内置、延迟、搜索或占位工具。普通 API 的原生 system 和提醒按实际列表生成，CLI 参考须使用对应工具选择；system 省略时使用 CLI 默认正文，显式值按 --system-prompt 替换，空文本/数组同样属于显式替换。普通 API 的显式消息、工具/thinking 和模型参数在发送前核对；工具数组即使省略也核对空列表，不能无损表达时拒绝，不静默删字段。原生业务正文不借用种子的字段政策。
- 每个引擎绑定一个账号环境，首个模型作业惰性启动，正常串行作业复用一个物理进程，不另设 16 项准入门槛。HOME、配置、凭据来源、代理及 cwd 不按请求切换；更换配置须关闭并重建引擎。服务关闭后不再接收作业，并等待队列和常驻进程退出。
- 请求预算、大小与排队政策交前置服务。CCRB_TIMEOUT_MS、EngineConfig.timeoutMs 和 ServiceOptions.timeoutMs 默认 0，不创建请求总计时器；.env.example 同步为 0。显式正整数仅在计时器可表示范围内启用预算。HTTP 不施加 2 MiB 门槛或空闲截止，私有模型正文不施加 8/24 MiB 字节门槛；JSON、归属、状态与完整性校验保留，日志预览上限不限制转发。取消、关闭和取消后的清理宽限独立处理。
- 控制配置中的显式 API key 使用官方本地规则只记录使用确认标识，不保存完整密钥；已有 rejected 决定返回 native_configuration/503，不改写拒绝状态。初始化、预热及测试不能因此触发真实账号登录或付费推理。
- worker_ready 晚于原生绑定、Nst 与本地构造依赖初始化；本地初始化使用独立根，发送前中止，不发模型请求或业务事件，成本计入总启动时间。每轮经 nEr 创建全新原生根，AsyncLocalStorage/yLs 绑定作用域，再调用 t_；同 sessionId 也不能复用上一轮账本、请求日志及取消状态。
- 普通 API 只支持 docs/api.md 登记的正文键。内部 Re/Kc 负责消息实体；原生规范化后的显式消息、工具、thinking 等必须保留，不可表达时拒绝。原生入站的扩展正文及必要改写另见后文合同。
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
- 类别支持 main、subagent、workflow、compaction、auxiliary、side_reply。子代理必须有 agentId；workflow 还需要 workflowRunId；主代理独立 agentId 须显式 agentKind=main。
- 响应逻辑字节原样返回，删除不匹配逻辑正文的长度、编码及连接字段。工具交给调用方，不注册本地执行器。取消解除待消费片段并收口原生进程，不重放模型请求。
- 新增公共类、接口和公开方法写中文 JSDoc；导入或调用现有内部接口前读取定义与实测证据。


## .trellis/spec/backend/runtime-contract.md:116

### 3. Contracts

- CCRB_NATIVE_BASE_URL 可选，不设置时不传 ANTHROPIC_BASE_URL；只接受无凭据、query、fragment 或空白的 HTTP(S) 绝对地址，保留 SDK 路径前缀语义。旧精简运行时尚未验证该配置时明确拒绝。
- CCRB_MODEL_OVERRIDE 只在前置覆盖根 model，原始入站保留；历史消息、工具内部同名字段及分类证据保持。CCRB_NATIVE_INGRESS_POLICY 默认 strict，local_base_url 仅由启动侧开启，与上游和验证开关独立。
- CCRB_TLS_CAPTURE 默认 off：官方 CC 直接对外，不创建辅助进程、监听或私有 CA。verify 仅覆盖 Linux x64、固定官方原版 293、HTTPS Messages/HTTP1.1、遥测 off、直连或 HTTP CONNECT 上游代理；不支持组合明确拒绝，不改用 Node 或隐式直连。
- verify 的 TLS 实现为独立固定画像，CC 仍唯一生成业务、账号上下文及最终 CCH。内部自定义目标是否产生 CCH，取决于同次内部 CC；prepareNativeBody 只按实际生成上下文准备或省略占位，不强行补回。
- 本地认证 CONNECT 同时核对冻结目标及实际 worker PID 的 TCP/socket FD 所有权；一条原生连接对应一条上游连接。上游 CONNECT 沿用原生字节、头顺序和连接特征，只删除本地代理凭据或替换为冻结的上游代理凭据。Messages 请求行、头和正文不经二次 HTTP/JSON 组装。
- 作业在实际 ready 后绑定代次，取得 cc_prepared 校验依据后才写上游；不新增 HTTP 池、请求重试、模型回退或默认总时限。取消/退休先收口本代连接，保留原生复用、重连与半关闭语义；3xx 原状态返回并记 http_error，不自动跟随。
- CCH 槽位定位接受现有 billing 合同的前导空白、尾部空格/制表符、首/末字段；只在观测副本中改变一个已知 ASCII 字符，比较序列化首个差异后换算 UTF-8 偏移。业务可包含任意同名标记或 CCH 示例文本，不能以固定哨兵冲突拒绝；无 CCH 时 offset=null。该过程不改发送正文，也不生成最终 CCH。
- 辅助程序按固定依赖锁、第三方快照及许可独立构建，生产不引用外部 cc2api 工作目录或缓存 rlib。构建记录不自动授信；核验独立 SHA256 后经打开的 FD 执行。产物采用原子更换路径，不能原地截断已运行进程映像。



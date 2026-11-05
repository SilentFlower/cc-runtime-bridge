# 固定 293 原生运行时合同

## Scenario: 结构化 API 到单次原生发送

### 1. Scope / Trigger

- 新增 HTTP API、私有 JSONL 和原生 SDK 适配，属于跨层执行合同。
- 实现依据：src/shared/input.ts、src/control/header-policy.ts、src/control/engine.ts、src/runtime/293/{preload,worker,job}.ts。
- 来源版本及内部模块只由 src/runtime/293/source-profile.ts 定义，profile.ts 重导出；精简产物身份由 compact-profile.ts 单独登记，避免载荷包含自身最终哈希。内部绑定依据固定二进制实测，不得猜测混淆符号。

### 2. Signatures

- parseInput(raw: unknown, incomingHeaders: HeaderPair[] = []): BridgeInput。
- prepareInput(input: BridgeInput): PreparedInput。
- NativeEngine.run(prepared: PreparedInput, signal: AbortSignal, emit: (event: RuntimeEvent) => Promise<void>): Promise<void>。
- Engine.close(): Promise<void>；workerPid: number | null 是只读状态，读取不启动进程。
- verifyRuntime(path: string): Promise<VerifiedRuntime> 保留核验 FD；runtimeFileStamp(path: string): Promise<string> 用于暖复用；verifyExecutionImage(pid: number, identity: RuntimeIdentity): Promise<void> 独立核对内存执行体。
- bun scripts/build-runtime.ts --source <固定原版> --out <新产物> [--sevenzip <固定7zz>] [--sdk <固定源归档>]。
- POST /v1/messages 接收正文；POST /api/requests 还接收 schema_version、request_id、body、headers、context。
- decodeRuntimeEvent(line: string, requestId: string): RuntimeEvent 校验请求事件；decodeWorkerCommand(value: unknown, workerId: string): WorkerCommand 和 decodeWorkerFrame(line: string, workerId: string): WorkerFrame 是常驻管道的统一边界。

### 3. Contracts

- 固定官方 2.1.293 来源，SHA256 为 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。创建引擎与每次加载新进程校验完整分发文件；暖复用检查真实路径、dev/inode、大小及纳秒 mtime/ctime。通过已核验 FD 启动，避免路径替换后执行另一文件。官方程序与提取源码不提交。
- 轻量入口仅接纳固定登记的外层及执行体身份，外部 manifest 不授信。当前基底为原版 Bun 1.4.3；原生代码保留，ICU 仅按固定 C.UTF-8 环境保留 root/en、完整字符/规范化数据和全部分词规则/字典。它是桥接专用程序，不能宣称具备通用 CLI 的全部 Intl locale 定制。
- BCJ2/LZMA2 与静态 C SDK 加载器单文件分发；载荷 SHA256 自校验后写入封存 memfd 并 fexecve，同 PID 执行，控制层再核对 /proc/<pid>/exe。运行不依赖原版、提取目录或构建工具；磁盘、内存文件与 RSS 分列，不把内存展开当作内存节省。
- 原生模式显式提供 CCRB_CLAUDE_BINARY、CCRB_CLAUDE_HOME、CCRB_CLAUDE_CONFIG_DIR；可提供 CCRB_NATIVE_API_KEY、CCRB_NATIVE_OAUTH_TOKEN、CCRB_PROXY_URL、CCRB_CA_FILE。子进程使用环境白名单。
- 每个引擎绑定一个账号环境，首个模型作业惰性启动，正常串行作业复用一个物理进程，最多 16 个执行中或排队作业。HOME、配置、凭据来源、代理及 cwd 不按请求切换；更换配置须关闭并重建引擎。服务关闭后不再接收作业，并等待队列和常驻进程退出。
- worker_ready 晚于原生绑定、Nst 与本地构造依赖初始化；本地初始化使用独立根，发送前中止，不发模型请求或业务事件，成本计入总启动时间。每轮经 nEr 创建全新原生根，AsyncLocalStorage/yLs 绑定作用域，再调用 t_；同 sessionId 也不能复用上一轮账本、请求日志及取消状态。
- 请求只支持 docs/api.md 登记的正文键。内部 Re/Kc 负责消息实体；原生规范化后的显式消息、工具、thinking 等必须保留，不可表达时拒绝。
- K_t 先完成构造并在发送前中止；yN 创建官方 SDK，按明确 stream 标志通过 Ree 实际发送一次。maxRetries=0；不得替换全局 fetch 或让 SDK 消费、重试原始响应。
- HTTP 与 RuntimeEvent 保持 schema_version=1、request_id；事件包含 ready、cc_prepared、response_headers、response_chunk、completed、error。ready 表示本轮已绑定就绪进程，不代表每轮新建 PID。attempt=1，片段使用可逆 base64。
- 私有 stdin/stdout 使用 schema_version=2、worker_id；request_start 携带 request_id/prepared，request_cancel 携带匹配 request_id，worker_shutdown 关闭进程。输出为 worker_ready(version,pid)、request_event(request_id,payload)、worker_idle(request_id)。payload 禁止覆盖 schema_version、worker_id、request_id。
- 每个物理进程只有一个持续读取器。唯一终态与匹配 worker_idle 缺一不可；释放响应并等待 SDK 收口后才发 idle。重复握手、错代次/错请求、双终态、终态后事件、缺 idle、畸形或超限帧均隔离进程；读取回调和输出闭包绑定旧代次，不得归入下一作业。取消、异常或状态不明时退役，下一轮重建，不重放当前请求；取消采用 1500 ms 强制终止宽限，空闲关闭优先 shutdown，1500 ms 后仍未退出则强制终止。
- cc_prepared 的 body_bytes、body_sha256 对应原始观测正文，headers 只在私有管道传递，控制层注册秘密后脱敏存储。stdout 不兼任普通日志。
- Connection 声明字段和连接级字段删除；调用方凭据不作为上游凭据；版本、传输、X-Stainless-*、X-Client-Request-Id 等由运行时生成。其余合法端到端扩展默认保留，不允许笼统删除 x-claude-code-*。
- 上下文为类别、agentKind、agentId、parentAgentId、agentType、sessionId、promptId、workflowRunId 的同一来源。promptId 必须为 UUID。
- 类别支持 main、subagent、workflow、compaction、auxiliary、side_reply。子代理必须有 agentId；workflow 还需要 workflowRunId；主代理独立 agentId 须显式 agentKind=main。
- 响应逻辑字节原样返回，删除不匹配逻辑正文的长度、编码及连接字段。工具交给调用方，不注册本地执行器。取消解除待消费片段并收口原生进程，不重放模型请求。
- 新增公共类、接口和公开方法写中文 JSDoc；导入或调用现有内部接口前读取定义与实测证据。

### 4. Validation & Error Matrix

| 条件 | 行为 |
| --- | --- |
| 不支持的正文键、system 缓存参数、beta 或原生无法保留的显式值 | 422，发送前拒绝 |
| 上下文冲突、非法头、无效 promptId | 400 |
| 重复 request_id | 409，不覆盖已有记录 |
| 队列已满 | 429 |
| 原生初始化时配置或二进制 hash 不匹配 | 失败类型 status=503，不能暗中回退 demo |
| 作业期间二进制 hash 改变 | 当前请求失败，不执行变更后的程序 |
| HTTP 上游错误 | 保留原始状态和正文，不重试 |
| 本地异常发生在响应头之后 | 结束逻辑流，日志记录错误；不拼接伪造 SSE |
| 原生接口不匹配或协议格式错误 | 明确失败，不猜字段或符号 |
| 未登记精简文件、源/载荷 hash 不匹配 | 拒绝，不信任外部清单或回退演示 |
| 终态后缺 idle、错归属或迟到帧 | 本轮失败或隔离空闲进程；下一轮新建，不重放 |
| 构建来源/布局/资源异常、构建期间源码改变或最终文件超预算 | 不输出可接纳产物，清理临时提取内容，已有文件不覆盖 |

### 5. Scenarios and Examples

- 正常：普通正文无来源上下文，生成 main，source=bridge-default；原生 metadata.user_id 内的 session_id、请求头和 billing 的 cc_prompt_id 关联一致。
- 边界：子代理发生压缩，requestClass=compaction，仍保持子代理 agentContext 和父子关系。
- 错误用法：子代理只强行声明 requestClass=main；这样会使身份与 billing 矛盾。正确做法是保留 subagent 和真实关联，冲突明确拒绝。
- 错误用法：将整个 API JSON 转成 prompt，或收到 tool_use 后本地执行。正确做法是结构化映射，单轮返回原始工具事件。
- 演示必须显式选择 demo；它只产生合成内容，不能作为原生发送证明。
- 正常复用：连续两个主/子代理作业保持同 PID，但每轮使用独立 session 根和 prompt；只有下面的匹配空闲帧到达后，才能接收下一作业：

```json
{"type":"worker_idle","schema_version":2,"worker_id":"11111111-1111-4111-8111-111111111111","request_id":"request-001"}
```

- 错误用法：只收到 completed 就重用进程，或把分发文件 SHA 写作内存执行体 SHA。正确做法是等待 idle，并分别登记外层与执行体、核对实际执行体身份。

### 6. Tests Required

- tests/unit/header-policy.test.ts：未知头保留、动态 Connection 删除、凭据/原生请求 ID 归属、冲突与默认来源。
- tests/unit/profile.test.ts：错误二进制不执行、不回退。
- tests/unit/engine.test.ts、worker-protocol.test.ts：同 PID 与哈希次数、文件替换、错归属/载荷覆盖、双终态/缺 idle、迟到帧、取消、背压和关闭；错误作业不得重放。
- tests/native/native.test.ts：无外网 TLS 上游独立核对 CCH、metadata/session/prompt、六类请求、thinking/工具历史、非流式、HTTP/SSE 错误及取消后下一请求；实际模型发送次数必须符合 attempt=1。
- 原版与登记轻量文件运行同一原生套件，核对同 session 多轮、Unicode、空闲及流中崩溃后的重建。独立部署须隐藏原版/源码/构建目录后仍能运行；重复生成核对分发及执行体 SHA256。
- scripts/benchmark-runtime.ts 固定并校验 vm2api 标杆，交错五个新进程、每进程六轮；直接采样总启动到首轮、就绪后首轮及暖复用中位数，均须 ≤标杆 1.10 倍。完整必需部署文件总量 ≤27933052 B；控制面、额外空间、RSS、页缓存和本地合成上游边界分别记录。
- 原生验证仅使用专用 HOME、合成凭据和 unshare 网络命名空间；不能因测试失败切换真实账号。

## Scenario: 官方运行时压缩与新版本适配

### 1. Scope / Trigger

- 升级官方源版本、Bun 基底、模块绑定、资源裁剪策略或打包工具时，重新执行本节准入。当前脚本只接受已核验的 Linux x64、官方 2.1.293 与 Bun 1.4.3；本节提供适配顺序，不表示脚本已支持任意新版本。
- 可复用路线为：核对来源和容器 → 从源码模块重建桥接专用依赖闭包 → 按固定环境裁剪资源 → 压缩完整执行体并加入内存加载器 → 验证独立部署、原生行为和常驻速度。先减少不需要携带的内容，再选择压缩方式；仅给完整官方程序加壳不能替代这套验证。
- 实现入口为 scripts/build-runtime.ts、scripts/runtime/{image.py,compile.ts,loader.c}；最终操作说明见 [docs/runtime.md](../../../docs/runtime.md)，293 的历史方案及最终证据见 [验收记录](../../tasks/11-05-runtime-footprint/research/acceptance.md)。

### 2. Signatures

- buildRuntime(args: string[]): Promise<void>：`bun scripts/build-runtime.ts --source <固定官方文件> --out <尚不存在的产物> [--sevenzip <固定7zz>] [--sdk <固定SDK归档>]`。
- 容器内部步骤：`python3 scripts/runtime/image.py extract <来源> <临时模块目录> <源SHA256>`；`python3 scripts/runtime/image.py prune <专用ELF> <执行体> <裁剪报告>`。它们由构建驱动调用，不是任意版本的通用提取器。
- benchmarkRuntime(args: string[]): Promise<void>：`bun scripts/benchmark-runtime.ts --binary <候选文件> --reference <固定标杆> --output <证据目录>`；候选及标杆均须通过脚本的身份核对。

### 3. Contracts

1. **固定每版输入**：先记录官方版本、完整 SHA256、实际 Bun 版本/revision、模块路径及原生接口定义。293 的来源在 src/runtime/293/source-profile.ts，产物在 src/runtime/compact-profile.ts。新版本必须重新定位并读取实际定义，不能只替换这两处哈希、混淆符号或版本字符串，也不能拿另一个项目的定制程序充当官方来源。
2. **核验容器后提取**：校验 ELF 架构/节表、Bun 尾标/长度/模块表、各指针和路径、编码及 loader；拒绝越界、重复和未知记录。提取到临时目录，保留可读模块/资源及逐项摘要；专用构建不复制原版整套应用字节码与共享缓存。293 的模块数、标志、ICU 偏移和摘要是版本专属断言，新版本须重新测得，不能删除断言让未知布局继续执行。
3. **闭合依赖后重建入口**：只引用桥接需要的原生构造、发送、配置和会话接口。通过 AST 转换已核验的静态 import.meta.require/辅助调用，使 JS、文本及通过路径读取的压缩资源可打包；逐项记录模块摘要、转换位置、内建模块和残余动态调用。空 metafile imports、接口 typeof 正确或一次导入成功均不代表闭包成立；残余动态路径须逐项说明可达性，并用脱离提取目录的真实请求验证。不能全局替换字符串、强改所有引用为静态 import 或为未知工厂添加纯调用标记。
4. **保留已验证的原生能力**：当前通过原版 BUN_OPTIONS 加载构建驱动，Bun.build 的 compile.executablePath 指向已核验原版；env='disable'，关闭 dotenv/bunfig/tsconfig/package.json 自动加载，保留函数名。构建前及裁剪前核对固定原生节；裁剪后 .text、.bun_builtins、.data 必须不变，.rodata 的预期变化单列。其它可追溯 Bun 基底须重新通过真实 TLS 发送、FetchSession/CCH 回归；通用 Bun 的版本相近或 trim 选项不报错都不构成兼容证据，不用 JS 补写缺失 CCH。
5. **按实际使用范围裁剪资源**：当前 LANG=C.UTF-8，保留 ICU root/en/en_*、共享池/索引、完整字符及规范化数据、全部 brkitr 规则/字典。仅清零不需要的 locale 定制资源并压紧目录，保留项地址不动；293 为 3990 项保留 801 项、移除 3189 项、清零 5839120 B。此步骤降低待压缩数据的熵，不缩短 ELF 或保证 RSS 同比例减少；不能把桥接专用产物宣传为完整多语言 Intl CLI。新增 locale 能力或升级 ICU 时重做保留集合及回归。
6. **对完整可执行产物计量**：当前固定 7-Zip 26.05 的 BCJ2 + 三路 LZMA2，主流字典 128 MiB/fb=273、其余两路 16 MiB，单线程并关闭归档时间字段；完整参数以 recipe.archive 为准。C SDK 的解码/SHA256 部分静态编入自有加载器，工具及 SDK 归档均核验 SHA256。比较的是包含加载器及全部新增专属依赖的最终 stat 字节数，不是归档大小或 Bun.build 的 BuildArtifact.size。当前上限为固定 vm2api 标杆的 27933052 B，换标杆须另行固定身份及验收目标。
7. **分开核验三种身份和空间**：官方源、外层分发文件、解码执行体各有独立 SHA256。加载器限制单个非目录载荷、检查解码长度/SHA256，写入封存 memfd，释放解码缓冲后 fexecve，同 PID 执行；控制层经核验 FD 启动，并在握手后检查 /proc/<pid>/exe。外部 manifest 只作证据，不能自行授信；接纳表内的最终身份必须绑定完整验收，失败候选不得交付。部署文件、磁盘展开、内存文件及 RSS 分列。
8. **把启动成本放在进程边界**：正常串行作业复用单账号进程，每轮仍建立新原生根和取消/日志作用域，遵守上一场景的终态加 idle 合同。当前本地构造初始化在 worker_ready 前完成且在模型发送前中止，成本计入启动至首轮完整完成；不能靠提前 ready、漏算解包或每轮重新启动来宣称达标。

构建报告为 `<out>.manifest.json`，schema_version=1；下列实际字段是每版复核入口，不应另外维护一份可自行授信的部署清单：

| 字段 | 类型与含义 |
| --- | --- |
| source.version、source.sha256 | string；固定官方来源身份 |
| kernel.version、kernel.revision、kernel.sections_before_prune | string、string、Record<string,string>；实际基底和裁剪前原生节摘要 |
| launcher.sha256/bytes、image.sha256/bytes | string/number；外层及实际执行体各自身份和字节数 |
| deployment.files、total_bytes、limit_bytes | `{name,bytes,sha256}[]`、number、number；完整必需部署集合及预算 |
| deployment.required_external_files、existing_system_libraries | string[]；新增外部依赖与既有系统库分别登记 |
| deployment.disk_expansion_bytes、memory_file_bytes | number；磁盘展开与内存文件分别登记，不能相互抵扣 |
| recipe.bridge_sources、archive、gcc、tool_sha256、sdk_archive_sha256、sdk_files、icu | 源码摘要、参数、编译器、工具/SDK 身份及资源策略；变更后重做产物验收 |
| closure.mapped_modules、rewrites、native_imports、remaining_dynamic_calls | 依赖映射、转换位置、内建模块及残余动态调用审计 |

### 4. Validation & Error Matrix

| 条件 | 行为或准入结论 |
| --- | --- |
| 来源/工具哈希错误、未知 ELF/Bun/ICU 布局、路径或资源异常 | 构建失败，不以放松断言或读取旧提取目录补齐 |
| 输出或同名 manifest 已存在 | 拒绝覆盖；来源、其它项目及旧产物保持原状 |
| 来源或桥接源码在构建期间变化、最终文件超预算 | 不输出可接纳产物，清理临时目录 |
| 归档、解码长度/SHA256、memfd 或封存/执行失败 | 加载器非零退出，不自动回退或从磁盘展开 |
| 未登记分发文件、实际执行体不符或运行时文件被替换 | 发送前拒绝或隔离进程，不能依赖 manifest 授信 |
| 缺 CCH、支持输入/Unicode 行为退化或多轮状态污染 | 兼容性不通过；不能删减原有覆盖换取体积 |
| 体积、三项配对速度任一不通过 | 保留失败证据，候选不得作为达标版本交付 |

### 5. Scenarios and Examples

- 正常：固定官方输入，在两个独立临时目录以同一工具/源码/配方构建，比较分发及执行体 SHA256；审计数组可按条目集合比较，不能忽略二进制差异。293 已验证最终单文件 26404920 B（25.18 MiB），它是本版结果，不是对新版本的体积保证。
- 边界：先隐藏原版、项目 src/scripts、提取目录与旧临时文件，再在独立 HOME/网络命名空间用合成凭据完成真实回环请求和 shutdown；部署只留下清单中的必需文件。内存执行体约 102.25 MiB，与磁盘 25.18 MiB 分列。
- 错误用法：拿到新版本后只改 PROFILE_293.sha256，沿用旧模块名和 ICU 偏移。正确做法是先重新测定容器、原生符号及资源合同，适配构建，再对最终哈希运行全部准入；当前 293 入口继续只接受原有固定来源。
- 错误用法：用压缩包或 --version 耗时证明体积/速度达标。正确做法是比较完整可执行部署集合，并从相同运行时协议边界直接采样总启动、就绪后首轮及暖复用；各阶段中位数不能相加代替总耗时。

当前版本的可执行验证入口如下；未来适配须先更新各入口内的来源/版本绑定，不能把命令成功假定为支持新版本：

```bash
bun scripts/build-runtime.ts --source /绝对路径/固定官方文件 --out /绝对路径/新产物
CCRB_TEST_CLAUDE_BINARY=/绝对路径/新产物 bun run test:native
bun scripts/benchmark-runtime.ts --binary /绝对路径/新产物 --reference /root/project/vm2api/share/wrap-cli/cli-node --output artifacts/runtime-benchmark
```

### 6. Tests Required

- 构建负例：损坏来源/原生节、未知标志/编码/布局、越界和重复路径、缺资源、超过预算 1 B；断言失败、不生成最终产物且来源未变。当前故障夹具及原始结果保存在上述验收目录，不把临时研究脚本当作通用产品命令。
- 闭包与独立部署：核对模块/资源摘要、原生扩展及每个残余动态调用；隐藏构建输入后完成所有支持路径，记录运行生成文件；只跑导入探针不算通过。
- 原版及最终候选分别执行 tests/native/native.test.ts，独立核对真实 TLS CCH、头部、metadata/billing、父子与压缩标识、工具/thinking、流/非流、Unicode、原始响应和单次发送。默认 Intl、en/zh/ja/th/ar 分词、组合字符及 emoji 另作原版对照。
- tests/unit/{profile,engine,worker-protocol}.test.ts 及 tests/integration/control.test.ts：未知身份/文件替换拒绝，同 PID 多轮的状态隔离，取消/错帧/迟到帧后重建且不重放，关闭不留孤儿进程。
- scripts/benchmark-runtime.ts：交错且反转顺序，两方各五个新进程、每进程六轮；同输入、回环上游和响应负载，每轮一次实际发送。直接记录 startup_to_first_complete_ms、ready_to_first_complete_ms、后五轮 elapsed_ms 的原始样本，三项中位数比值均 ≤1.10；RSS、额外文件、页缓存及协议/控制面边界单列，计时期间不并行压缩。
- 重复构建：固定所有输入和工具，在独立构建目录至少两次生成，断言分发及执行体哈希一致、部署文件总量达标，重新核对 manifest 与实际 /proc 执行体；来源或配方变化后不能沿用旧产物的通过结论。全部验证继续只使用合成凭据、专用 HOME 和无外网回环。

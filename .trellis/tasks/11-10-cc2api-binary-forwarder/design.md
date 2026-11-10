# 技术设计

## 交付与仓库边界

本任务作为一个跨仓端到端交付推进：cc-runtime-bridge 提供实际请求二进制和协议；cc2api 实现消费者和账号设置；vibecoding-bench 提供 sender 部署与隔离验收。最终以 cc2api 消费实际二进制验收，保留三个仓库各自既有工作区变更。

- 当前仓库：`src/shared/{contracts,protocol,input,native-input}.ts`、`src/runtime/293/worker.ts`、构建/精简身份、测试和运行时文档。
- cc2api：account model/store/迁移、管理 API、账号前端、Gateway 分流、新原生进程池与 sender 接口。
- bench：`orchestrator/{account_isolation,account_runtime,resource_budget}.py`、`images/v3/Dockerfile`、构建输入/发布清单及 V3 验证器。

## 账号选择合同

PostgreSQL 实例验收暴露既有 nullable 时间参数问题：SQLx 0.7 Any 将 NULL 转成 Option<i32>，直接 ::TIMESTAMPTZ 拒绝 integer 类型。账号store时间占位符先转TEXT再转TIMESTAMPTZ。实际单连接复验进一步确认，SQLx的预编译缓存仅以SQL为键，NULL(i32)与实际文本交替仍会触发bind类型错误；账号创建/全量更新按六个可空参数的存在状态追加固定布尔缓存键，停用的可空时间参数使用同一策略。保持原始NULL/空字符串语义，SQLite SQL保持原样。由真实单连接PostgreSQL覆盖NULL→实际值→NULL及账号独立选择。

新增 `request_backend` 字符串字段，值为 `legacy` 和 `native293`；新建、省略及历史记录使用 `legacy`。SQLite/PostgreSQL 双栈迁移、API DTO、store 映射与 Accounts 界面同源同步，未知值明确 400。

后端/身份/凭据相关配置切换进入现有 RuntimeConfigPermit/RuntimeLease 排空门禁。活动和排队作业按原归属处理；忙时更新失败，不能把旧已解析请求送进新后端。UI 直接展示“原有转发”和“原生运行时 2.1.293”，显示账号实际生效值和原生准备错误。

## 请求构造与返回

1. HTTP 鉴权、准入政策、逻辑正文解码、真实会话与账号选择沿现有 Gateway 规则。保留解码后的原始业务快照及 HeaderMap 同名值（私有协议将 HTTP 头值按 Latin-1 字节串表达），避免 Rust HashMap 丢弃重复头。
2. 选中 `native293` 且为 Messages 时，在 Rust 协议改写/CCH 封口之前进入新分支。Rust 负责账号规则与调度；调用方正文、协议头和上下文交给二进制统一 parseInput/prepareInput。
3. 二进制沿普通 API 与完整原生分支运行 generateNativeRequest/runNativeJob；同次 SDK 生成身份与发送上下文，由 Ree 唯一发送并生成最终 CCH。
4. 返回 status、有序响应头、可逆 base64 片段及终态。Gateway 沿用用量观察、错误映射与流生命周期许可，传输编码头与逻辑字节表示保持一致。
5. 原生方式仍执行账号 Fast/1M 功能授权：调用方申请超出账号 allow_fast_mode/allow_1m_models 的能力时，在准备和模型发送前明确 400。只做准入拒绝，不改写原始正文或协议头；配置为允许时交给固定 293 构造。普通改写选项仍仅作用 legacy。
6. 原生方式每请求最多一次模型发送。旧 401/signature 重放及切回旧后端逻辑留在 legacy 分支；原生 401 可驱动现有受控凭据恢复供后续请求使用。
7. count_tokens、bootstrap、额度、预热及既有其它端点继续走原路径。原生内部遥测默认 off，避免重复代发。旧 Rust 正文、beta、CCH、TLS 画像设置只作用 legacy。

## 二进制输入与私有协议

保留现有 `schema_version=2` PreparedInput 作业，新增可协商的原始输入能力：

- worker_ready 增加 `raw_input_protocol:1` 能力，仍携带 worker_id、version、pid；旧缺失字段不具备新接入能力。
- 新指令为 `{type:'request_input',schema_version:2,worker_id,request_id,input}`。input 使用现有 schema 1 信封：`schema_version,request_id,body,headers,context`；输入 request_id 必须与指令一致。
- 二进制内执行 parseInput 和 prepareInput 后运行同一作业状态机。格式/上下文错误在本次作业内返回受控 error 和 idle，模型零发送；损坏私有帧、错 worker、重复或错请求按协议故障退役。
- 取消和关闭复用 request_cancel/worker_shutdown；输出复用 request_event 与 worker_idle。启动、构造快照、响应头、响应片段、终态的顺序与唯一性继续校验。
- sender 从实际 cc_prepared 提取 NativeRequestObservation（schema_version=1、DiagnosticParameters、session_id、previous_message_id、body_sha256），通过受限内部响应头 x-v3-native-observation 回传网关。正文/凭据不进入该摘要。上游同名私有控制头先剔除，网关消费后删除内部头。
- 网关诊断尝试使用固定已核验 2.1.293，并标记来源 native293_cc_prepared；采集阶段明确为组装快照。成功原生请求缺观察摘要时标记 native293_unobserved 与 native_observation 缺口，禁止显示为正常本地返回。格式校验失败保持零次模型尝试。
- 原始输入准备成功时先输出一次 `request_event(payload={type:'header_policy',attempt:1,decisions})`，其中 decisions 使用现有 HeaderDecision 数组，供 Rust 记录实际白名单处理来源。
- 新入口提供原始输入方式，调用方不需实现 TS 的 PreparedInput。请求不能指定 binary/HOME/凭据/目标代理。
- 日志诊断记录 header_policy 决定和原生准备值时注明来源；最终 TLS 仍以独立实收为验收依据。
- 原生入站严格沿固定 293 能力，其他版本明确失败。普通 API 沿现有可表达字段与版本能力检查。

实现时先核对现有解码器的额外字段和严格验证，再增加类型与测试；能力协商和错误收口必须同时覆盖原版 preload 与新精简入口。

## Rust 调用与账号进程池

新模块集中管理固定画像、进程及流协议。首版接入 bench V3，在原账号 sender 角色执行；缺少 V3 原生能力的部署选择 native293 时明确准备失败，legacy 继续保持原路径。

进程实现按 Linux x64 编译条件隔离。共享私有 DTO 跨平台可编译；其它平台原生能力明确 503，原有转发的构建入口保持兼容。

池按账号、环境/代次、凭据及身份/代理配置摘要隔离。Rust 只从当前权威账号快照取得已解析 bearer；私有环境写入 CLAUDE_CODE_OAUTH_TOKEN，保持现有授权来源。refresh token 不进入工作进程及其 HOME。

SOCKS5/SOCKS5h 兼容通过 sender 本地 CONNECT 隧道适配：限定 api.anthropic.com:443，使用每个物理进程独有的随机 Basic 服务凭据，转到受控 SOCKS 代理并保持原生 TLS 原始字节。该适配不构造业务请求、不解密 TLS、不重试；生命周期绑定工作进程。socks5 按原规则本地解析目标，socks5h 由 SOCKS 代理解析。生产进程与任意 CLI 共享网络时，随机鉴权防止其他角色借用隧道。

每个物理进程拥有独立私有 HOME/config/cwd，以受控账号设备和 OAuth 账号身份初始化。官方配置字段先读取固定原生定义，并以 TLS metadata 实收验证；不把任意 canonical_env 字段伪装成原生环境。进程环境沿已有白名单，使用固定二进制 FD 启动，握手核对 PID、版本、能力和实际 memfd 执行体哈希。

按需启动工作进程，最大同时活动进程数覆盖账号现有内部槽单位。标准 concurrency=3 对应 3 个普通请求或 6 个 Haiku。外层已有准入为唯一业务排队/RPM 来源，池不新增自动业务重试。工作进程初始化不产生额外模型尝试；模型发送发生在进程就绪和原始输入构造成功后。既有调度记点仍绑定实际内部POST，包含该次原生启动时间；模型构造证据以cc_prepared观察为准。

池状态包括 starting/idle/busy/draining/failed。idle 仅在唯一终态及匹配 worker_idle 后发布。降并发时先回收多余 idle，busy 自然收口；取消或协议故障终止对应进程，下一请求按需重建。配置或 bearer 变化创建新代次，旧代次只收口当前请求。空闲复用按当前授权和环境门禁校验，所有权暂停仍阻止新上游活动。

## V3 内部接口、凭据与资源

扩展 sender 的内部能力和 Messages 入口，继续使用 TransportBinding 的 account_id/environment_id/generation/release_id 与服务鉴权。新增原生 Messages 元信息明确：

- 归属、request_id、deadline 与现有绑定一致；
- 原始信封、当前 bearer、设备/账号身份、账号并发额度由受信任网关冻结；
- origin、代理、二进制路径/哈希与资源配置来自 sender 启动侧；
- 错账号、代次、过期及不支持路径在创建作业前失败。

当前原生 DTO 明确为 NativeSubmission：request（现有 PreparedRequest）、input（schema 1 原始信封）、bearer、device_id、account_uuid、organization_uuid、email、concurrency。SenderConfig.native 可选，包含 binary_path、work_root、memory_mib、max_workers。新能力端点为 /internal/native/status，实际 Messages 为 /internal/native/messages，沿原 bearer 服务鉴权。缺配置、能力或预算时明确准备失败。

显式 V3_NATIVE_SENDER_MEMORY 按 256 MiB 共享映像/sender 基础加每个物理进程 192 MiB 的预算预检；最终以实际满并发峰值验收。标准并发 3 对应 6 个进程，预检最低为1408 MiB，实际验收配置为1536 MiB。物理进程数量由账号标准并发和有限 RAM 预算决定；原生 sender 的 PID 限额按基础 128 加每个物理进程 32 预留，legacy 保持 128。启动握手沿本次剩余期限有界等待。历史 legacy 布局仍为 128 MiB。账号后端和并发从网关 runtime config 获取，sender 布局改变在既有作业和 API 活动都为空时重建环境。配置事务会先停止角色；布局检查复用 _running_sender_active，对已停止且归属已核验的 sender 按零活动处理，对运行中 sender 读取真实活动，查询故障继续拒绝重建。构建侧按固定版本 URL 或显式本地候选获取同一个校验值，冻结到镜像源快照及联合清单。

具体 Rust DTO 只在读取现有 SenderConfig、Account、PreparedRequest 与新类型定义后实现；凭据放在私有结构中，Debug/错误/普通日志均使用受控信息。

预算还须同步现有 CLI 进程指标、physical_features 与静态/串行评审。冻结的 fingerprint 增加 native_sender_memory 资源字段，布局重建时保存，回退 legacy 时移除；原有身份字段保持稳定。所有 resource_budget 消费方从同一冻结预算计算 sender、CLI 与评审份额，避免评审按旧 128 MiB sender 预算重复分配账号 RAM。

bench 保留 network/CLI/sender 三角色。为原生池提供 UID 1001 独占、与 CLI 分离的可写目录，镜像内放置经登记的实际二进制。新增显式有限 sender 内存预算配置，原 legacy 128 MiB 布局保持。原生预算在账号总有限 RAM 下校验 network、sender 与 CLI 最低预算；缺配置或容量不足拒绝原生准备。预算与模式改变只在空闲重建后生效。

候选验收以普通和 Haiku 满并发测量实际 cgroup/RSS 峰值；发布文档给出经过验证的配置。实际生产资源参数由用户部署时显式设置，开发阶段不自动改远程环境。

## 失败与回退

| 条件 | 行为 |
| --- | --- |
| 未知 request_backend | 400，原账号配置保持 |
| 忙或维护门禁中切换 | 受控拒绝，原作业继续收口 |
| 缺二进制、身份/能力不符、预算不足 | 准备失败，模型零发送 |
| 入站固定版本/正文能力不支持 | 422，模型零发送 |
| 上游 HTTP/SSE 错误 | 原错误/状态及用量观察，单次提交 |
| 提交后断线、取消、worker 异常 | 明确失败/取消，退役并释放许可 |
| 凭据/代理/身份变更 | 冻结代次，旧流收口，新请求使用新池 |
| 原生方式故障 | 保持该账号选择，管理员可在空闲时显式切回 legacy |

回退按账号切换旧方式及同批镜像/源码恢复；数据库新增字段的旧默认保持。二进制新哈希只有完成双次构建、独立部署及原生/消费者回归后交付。

## 构建、版本与发布

沿固定 293 BCJ2/LZMA2 + C loader 配方重建最新 worker，保留原生发送/CCH及既有执行守卫。分发文件、解压执行体和官方来源分别登记 SHA256，现有旧身份保留。使用当前精简体积上限作为首次构建检查；确有必要的体积预算变化带实际数字回到增量规划，不通过删业务或改版本字符串达标。

V3 镜像的 Cargo registry/git/target 使用项目独立的 BuildKit 锁定缓存。实际编译继续 --locked，最终二进制在同一 RUN 复制到不可变 /out 层，最终镜像从 /out 取文件；缓存不作为交付文件或来源证明。该调整用于源码迭代后的可靠重复验证，联合清单仍冻结实际源内容和最终镜像身份。

发布目标为下一 beta（当前为 v0.1.0-beta.2），附件包括 Linux x64 二进制与 SHA256 清单；说明固定协议、独立部署依赖、按账号启用、资源与回退。最终发布绑定通过验证的源码提交。三仓 Git 按精确计划确认：cc-runtime-bridge 二进制来源/协议、cc2api 消费者、bench gitlink/部署更新依次保持可追溯。业务源码推送后，任务 owner 执行已批准的beta发布及附件下载验收；这些发布动作独立于Push的本地生成步骤。AC7通过后才由进度owner写完成态与Close。


## 用户确认的内存优化增量

用户在看到2432 MiB预算后要求核对内存，并选择“先优化再发布”。无网络启动实验使用相同分发体和实际执行体哈希，六个就绪进程的cgroup当前占用由1226.1 MiB降到692.2 MiB；共享组实际inode一致且F_GET_SEALS=15。该实验验证初始化；完整请求、取消、归属及最终预算由下述真实V3验收覆盖。

- sender池缓存首个工作进程实际/proc/pid/exe的只读File。完整分发文件继续逐次核验；实际执行体长度、SHA256、PID、版本与能力保持核验，并要求WRITE/GROW/SHRINK/SEAL四项封存。
- 后续进程从同一已封存执行映像FD执行。每个进程重新exec并使用独立HOME/config/cwd、当前bearer和唯一worker_id；堆、SDK、原生根与取消状态保持进程和作业隔离。
- 首个映像初始化由短期异步互斥串行化，后续工作进程并行启动。缓存只包含固定代码映像，生命周期属于本账号sender；配置或凭据代次继续控制各进程的归属和复用。
- 暖池最多保留一个长期空闲进程；其它进程空闲60秒后由单个弱引用回收任务退役。回收不占用活动进程，峰值容量保持2*concurrency。映像FD随池销毁释放。
- 较低预算已同步Rust、Python及部署验证器，真实V3的3普通/6Haiku与空闲回收完成后再冻结文档数值。
- 必须复验实际inode共享、只读封存、独立身份/凭据代次、取消及故障退役、空闲回收后重新达到3普通/6Haiku。新的预算依据完整请求cgroup峰值和余量确定。

当前较低预算：共享池基础份额256 MiB（执行映像和sender），每物理进程192 MiB，公式256+192*2*N；N=3预检最低1408 MiB，实际V3验收使用1536 MiB限额。HTTP/SOCKS实际消费者各17次提交和峰值6已通过，该限额下的真实cgroup完整请求和空闲回收已完成，数值见下文。历史2432 MiB数据保留其独立映像批次含义。

共享池实际V3验收完成：29组场景通过，1536 MiB限额下HTTP峰值676216832 B、SOCKS峰值677347328 B，oom/oom_kill均0；额外进程空闲60秒后保留1个，sender当前占用198385664 B。配置、共享inode/封存、独立凭据、按账号回退与管理端公网拒绝计数均通过。

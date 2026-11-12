# 原生请求分阶段诊断与预热可靠性设计

## 交付结构
用户明确要求合入当前任务一起改造。本任务采用单一交付包，联合验证请求诊断、真实热池身份及页面准备状态。主执行仓为`/root/project/vibecoding-bench/cc2api`及其父仓；`cc-runtime-bridge`保存任务、共同规范与固定源协议依据。

## 现有合同
- Rust `NativeSubmission`位于`cc2api/src/service/native_contract.rs`，受信任网关冻结input与身份；业务调用方不能设置诊断模式。
- `NativePool::pool_identity`当前包含整个SenderConfig，忽略adaptive开关；`checkout`遇到不同key退役旧idle。SenderConfig中的quota_identity用于额度观察。
- `Worker::execute`依次消费header_policy和cc_prepared；前者为真实{name,action,reason}数组，后者为原生最终传输前有序头与JSON字符串。
- `native_capture.rs`在debug且存在账号采集目录时保存schema1私有快照；原有顶层cc_prepared字段、0700/0600权限、每账号50份/100MiB及7天只读读取合同保持。
- 调度器Cc2ApiClient._request默认要求JSON对象；唯一批量准备GET实际返回数组。环境页由AccountRuntime投影真实绑定快照。

## 头部、正文与阶段证据
### 数据来源
1. 受信网关在会话映射前按本次模式冻结HTTP入口的原始逻辑正文与有序请求头。原始长度和SHA256先按实际观测字节计算。原文先脱敏后按UTF-8字符边界限长。映射副本继续只作为发送输入。
2. NativeSubmission新增可选`ingress_capture`，仅由网关填入，包含脱敏头、正文预览、真实原始长度/哈希、截断状态及来源。字段省略兼容旧调用；新网关与sender由同一联合镜像版本交付。
3. sender保留同次真实header_policy事件，不从当前白名单重算历史决策。字段动作固定keep/drop/runtime/context，保留顺序及重复项；已知秘密统一脱敏。
4. cc_prepared按现有事件保存。对入口JSON与该组装JSON做有界观察差异，生成JSON Pointer路径的added/removed/changed项，来源明确为observed_diff。删除的根settings/claude_settings/env和metadata归属改写提供受控原因；通用变化标记为组装前后观察差异。
5. 平台当前没有独立最终TLS采集时，wire_final固定标为unavailable并解释采集位置。cc_prepared保留中间值语义，CCH占位不标为最终校验值。

### 新增私有快照字段
顶层schema_version=1、stage=cc_prepared和既有headers/body字段保持。追加可选对象：
- `ingress`：source、representation、status、headers、body、original_body_bytes、original_body_sha256、body_truncated、headers_truncated。source为gateway_http_ingress，representation为http_logical_bytes；旧记录缺失为未采集。
- `header_policy`：source=native_header_policy、status、decisions[{name,action,reason}]、observed_count、stored_count；数量或字节超限标明truncated。
- `body_changes`：source=observed_diff、status、items[{path,action,reason}]；每项action限定added/removed/changed。字段值从脱敏阶段预览查看，不重复保存整份差异值。
- `stages`：入口、头部策略、cc_prepared和wire_final的实际source/representation/status/note。历史字段缺失逐项显示未采集。

### 容量、模式与失败
- info保持摘要，不传输或保存新增正文；debug才建立脱敏入口预览并读取完整阶段快照。动作统计可沿既有诊断summary_json增加有界可选摘要，头值保持私有。
- 所有正文预览共享2MiB预算，优先保持现有cc_prepared预览；入口预览最多1MiB并使用剩余预算。头部总预算保持有界，策略决策最多1024项/128KiB，差异最多128项，遍历最多4096节点且限制深度。
- 保持调度器6MiB读取上限，最终序列化文件也核对该上限。达到任一预算均标明截断或丢弃，禁止静默截断与哈希重算。
- 继续复用250ms采集期限、有界写入并发和原子发布；诊断失败不改变业务提交次数或重放模型。
- 原生组装前失败且缺少对应阶段时保持缺失状态；不虚构未发生的上游尝试。旧快照与旧sender缺入口字段时明示未采集。

## 热进程身份修复
- 在唯一pool_identity入口将quota_identity规范为固定空值，沿用现有adaptive标志归一化。其余SenderConfig及bearer/device/account/org/email/slots继续参与原有隔离。
- quota_identity仍在transport首次业务中按权威额度逻辑补写，额度记录行为保持。诊断说明只称其为额度观察字段，不把它当账号凭据。
- prepare、readiness、prepare-switch和业务checkout复用同一计算函数。激活后首条业务补写额度身份时复用原PID，真实身份或代次变化仍隔离旧进程。
- 保留warmup/generation/native_transition锁序、取消、实际进程退出后归还许可及维护门禁。

## 准备状态接口
- Cc2ApiClient为精确GET `/admin/native-preparations`显式接受有界数组，其他路由维持原JSON对象断言。复用原HTTP鉴权及错误处理。
- 批量读取返回本次状态映射及受控读取错误，二者按本次环境列表请求传递；不使用跨请求共享错误标志。
- 环境摘要分别处理read_failed、snapshot_missing、binding_unverified、check_expired以及实际ready/busy/preparing等状态。错误不再伪装成代次未核对。
- 真正核对account/environment/generation/kernel_generation及45秒新鲜度后展示PID、idle/live。页面读取不唤醒环境、不提交模型。

## 并发备用策略
- 保持现有显式`V3_NATIVE_PREWARM_ACCOUNT_ID`试点语义、至少一个常驻暖进程和按原逻辑补第二worker。检查manage/Compose/AccountRuntime配置投影、角色重建及开启/关闭转换完整生效。
- 原物理上限为账号并发的既有加权容量，内存/CPU限额保持；关闭开关时不声称备用已准备。只读状态追加有界的备用启用、实际准备中/空闲容量说明，前端按真实观测展示。
- 激活只确认本次实际已就绪容量。超出热容量的同时突发并发允许按需扩容，诊断显示其真实checkout/startup耗时；本轮不承诺全部并发零等待。
- 后续上线单列出当前生产试点开关为空的事实、期望账号12及启用核对步骤。该生产配置动作按届时明确上线授权执行。

## 页面
- RequestDiagnostics沿现有风格增加头部处理、正文变化、分阶段采集三块；删除项突出显示，其他动作独立标签。保留有序多值头展示。
- 入口和组装后脱敏正文可按阶段查看；差异路径可定位对应内容。超限、历史缺失、采集关闭、超时、文件轮转及最终未采集分别提示。
- 环境卡片显示新鲜准备状态与受控错误原因；备用关闭或容量不足明确展示。主环境ready与原生准备状态保持独立。
- 文本按安全文本渲染，沿用AbortController/归属版本，换账号、换请求及关闭弹窗后旧响应不覆盖新内容；390像素保持可读。

## 兼容、交付与恢复
- 复用固定2.1.293已有事件，beta.3/beta.4身份与实际执行体核验保持。平台侧采集复用既有事件；追加的首响应预算与TTL联动需要新桥接内核修订。
- 旧快照新增可选字段，旧诊断JSON缺字段为未知。沿既有summary_json及私有文件，无新增业务表。
- Rust网关与sender共享新私有合同，联合构建和升级，避免新网关单独调用旧sender。
- 软件发版及其他生产变更独立于本次代码实现授权。本轮用户追加授权线上11-5 sender在线CPU提高到1核、network提高到0.5核，并核查网络代理限流。生产验证优先用现有用户请求诊断及零模型状态读取。
- 交付回退沿前一完整平台发行与原有快照兼容机制，保留凭据和业务数据；诊断错误不能破坏业务。

## 追加的在线CPU调整
- 本次仅对固定US环境11-5、代次14的sender按不可变容器ID执行Docker在线额度更新，sender目标1核、network目标0.5核。更新前核对部署归属标签、空闲更新门禁及已完成的内核操作。
- 保存原Docker额度、启动时间、重启数及全部同环境角色状态。更新后核对Docker NanoCpus和cgroup cpu.max，任何失败核对实际状态并恢复原配额；出现未知结果保留审计状态。
- 此动作持久于当前容器配置并跨容器restart保留。用户已选择页面手动即时调整并保存配置供重建时恢复，后续按此增量决定实施；自动扩缩保持范围外。

## 追加：响应流故障观测
- 网关在构造流前冻结根request_id，并记录native提交ID（等于诊断attempt_id）；sender沿同一ID关联worker/PID及绑定代次。每层记录自身观察到的结束原因，不把网关到sender的断流直接归因为官方中断。
- 网关保留原超时及keepalive语义；增加已读字节、片段数、持续时间、最后真实收包间隔、正常EOF和下游Drop日志。使用有界Error::source类型遍历提取reqwest/hyper/io的布尔分类及OS错误码，禁止输出异常Display/Debug原文和URL。
- sender在原始错误归并前记录运行时error事件的受控code与错误文本哈希、响应头状态、阶段进度及最后事件间隔；分别记录等待事件超时、IPC读取/EOF/协议失配、下游取消。事件原文与业务正文不进入普通日志。
- SOCKS适配桥按worker/tunnel UUID记录握手失败、连接预算超时、密文转发错误或隧道EOF及两个方向的总字节数。双向复制收口不表示已确定首个关闭方。通过时间和worker关联业务请求，连接复用不伪造一对一归属。
- 复用固定内核既有error事件，本次平台观测增量与原有内核分发合同兼容。日志补齐后的实际生产归因依赖后续软件上线及新请求样本。

## 追加：SDK首响应预算与逐请求缓存TTL
- 原生a7/s7在fetchOverride返回前保留首响应预算；当前fetchOverride等released才返回，导致已收响应仍被约180秒加上传余量的计时器取消。api.Ree的发送信号改为本次桥接调用方与本地发送清理控制器的联合signal，避免SDK内部构造预算越权取消已交由桥接独占读取的响应。外部取消、前置首响应预算与收口宽限保持。
- 新增私有NativeSubmission.cache_ttl_rewrite枚举off/5m/1h，由网关冻结当前设置；工作进程request_input的同级受信字段承载该模式，公共body/context不能设置该字段。策略在原生构造及原有缓存选点后、cc_prepared与Ree前应用。仅处理根/system块/tools项/messages顶层内容块内既有ephemeral缓存对象。
- 新内核worker_ready追加cache_ttl_rewrite_protocol=1能力声明；sender对强制TTL模式检查能力，旧内核明确返回能力不足且模型零提交。off兼容旧内核。每条请求传递策略，修改设置保持暖进程复用。
- 根运行时源码纳入当前增量范围，固定官方来源不变；生成新候选并做真实行为验证。上线顺序为新内核候选激活后再更新平台，或按后续正式软件上线SOP联合交付。

## 动态CPU策略合同
- 管理接口GET/POST `/api/environments/{id}/cpu-resources`，仅布局2角色。GET返回当前NanoCpus换算值、宿主CPU数量、持久策略及基于代次/容器ID/实际额度/策略revision的摘要。POST携带expected_generation、expected_revision及cli/sender/network三项cpus。
- 各角色沿当前NanoCpus预算模式，最少0.01核，最多宿主Docker可用CPU数；三个角色合计不设3核上限。CPU额度属于共享调度上限。
- 写操作登记部署维护活动并在环境锁内重读权威行，拒绝旧代次或旧revision。内核切换/环境维护进行中拒绝；仅在线更新CPU，核对内存/PID额度及容器身份、启动时间、重启数保持。异常按原不可变容器ID恢复原额度，并保留实际恢复状态。
- 私有0600的runtime/cpu-resources.json保存schema_version=1、environment_id、account_id、revision UUID及各角色正数nano_cpus；原子写入，拒绝链接/损坏/错误归属。角色创建时在默认及评审布局预算之后应用该策略，重建与restart保持配置。
- 页面独立CPU编辑窗口按需读取，表单期间环境轮询保持输入。关闭/离页使旧回执失效；提交使用冻结revision，成功后重新读取资源。

- 更新器在排空后、重建意图发布前，从已归属的旧三角色冻结实际CPU额度并持久写入操作记录。重建及软件失败回滚后，按新角色不可变ID复核归属并恢复该额度，兼容目标旧平台尚不读取新策略文件的情况。只更新CPU，其余新镜像声明的资源按原验收规则核对。
- 旧schema1评审布局的CPU核验优先采用明确保存的CPU策略，历史内存和PID预算继续逐项核验；串行评审借用当前CLI额度。已保存策略的三角色必须与实际额度一致，合计不受历史V3_ACCOUNT_CPUS默认值限制。评审资源交接期间拒绝在线调额，避免改变冻结的恢复合同。

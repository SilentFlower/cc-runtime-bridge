# 原生账号持续预热与首轮热进程复用设计

## 目标与边界

- 交付一个贯通 sender、网关协调器、bench 环境接口和现有页面的能力。统一验收依赖整条链路，本任务按单一任务维护。
- 对象为启用的 native293 账号及其已运行环境；预热只初始化本地运行时。固定二进制已经提供 worker_ready，本轮优先修改消费者。
- 可保证的行为是：正常就绪环境在空闲后复用已核验进程；突发进程退出、重建或身份变化进入准备与恢复。原生准备时间继续计入实际请求总耗时，不能通过移动计时起点制造改善。

## 现有链路与定位依据

- `cc2api/src/service/native_contract.rs` 定义 NativePreparation、NativePreparationStatus、NativeSubmission；秘密类型无 Debug。准备与业务包含同一 bearer、device_id、account_uuid、organization_uuid、email、concurrency。
- `native_runtime.rs:1190` 的 checkout 根据 SenderConfig 与账号身份求池 key，adaptive 标志归一化；空闲进程经过 try_wait 和管道无迟到帧检查后取出。`:1426` 的 submit_validated 持 warmup 读锁等待准备，再 checkout。
- `native_runtime.rs:982` 的准备持 warmup 写锁，实际握手后放回同一 idle 集合；全忙返回 busy。当前全忙分支在 checkout 的 key 比较之前，必须增加身份/代次判断，防止把旧身份的忙进程算作当前就绪。
- `native_prewarm.rs:51/168/185` 负责启动补偿、缓存状态、读取已运行绑定及权威凭据。当前状态接口为准备结果缓存，不能直接作为实时接单依据。
- `orchestrator/account_runtime.py:804` 按环境/代次去重发送准备通知；`orchestrator/main.py:12705` 返回环境列表；`webui/environments.js` 是实际环境管理页面，Vue Environments.vue 负责 iframe 接入。
- `NativeRequestObservation` 在 `cc2api/src/model/request_diagnostics.rs:69` 定义，当前只有正文参数、session 和采集摘要。新增进程和阶段证据应走同一受信观察与持久诊断链路。
- 首轮 6929 ms 与后续 180/185/55 ms 是 submit 到 cc_prepared 快照的观测。快照属于中间组装值。原始安全汇总见 research/findings.md。

## 池身份、就绪与取用

1. 提取唯一内部身份计算入口，准备、巡检、业务复用同一结果。保留环境/绑定、内核、凭据、代理和并发等既有隔离要求；摘要只保存在内部。
2. 就绪必须同时满足当前身份/绑定/内核代次匹配、固定映像核验通过、真实 worker_ready 完成、进程仍存活、空闲管道状态可复用。
3. 在池锁内完成候选归属与所有权转移；进程 I/O 和终止在锁外执行。就绪快照是观测结果，业务最终在 checkout 再次校验并占用。
4. 空闲至少保留一个进程。已有任务全忙时报告 busy；物理计数包含启动、在途与退役，沿原 max_workers 上限执行。
5. 无可复用进程时，同身份的恢复/启动登记合并；业务在原截止前等待本地准备。后台准备只补一个缺口。扩并发继续沿原按需策略，warmup 锁不能阻塞在途响应和归还。
6. 突发失效后，恢复必须完成握手与映像校验再投递业务。启动失败、超时和取消沿现有结构化错误返回；已发送模型请求沿原规则收口，禁止重放。

## 实时状态合同（新增）

- sender 新增受 binding.secret 鉴权的 `POST /internal/native/readiness`。入参复用 NativePreparation 的身份、绑定、检查 UUID 和截止字段；此入口只观察与校验，不启动工作进程、不发模型作业。
- 新增集中定义的 NativeReadinessStatus：`state`（ready/busy/preparing/unprepared/failed）、`account_id:i64`、`environment_id:string`、`generation:u64`、`kernel_generation:string|null`、`release:NativeReleaseRef|null`、`checked_at_ms:u64`、`idle_workers:usize`、`live_workers:usize`、`pid:u32|null`、`reason:string|null`。reason 为固定错误码白名单；pid 表示本次观察到的可复用空闲进程。
- 身份不匹配或管道异常先隔离旧结果，再返回 unprepared/failed 和固定原因。维护、休眠和查询失败由网关分别投影 maintenance/sleeping/unknown；查询失败不能沿用旧 ready。
- 旧 `GET /internal/native/status` 保持能力查询。已有 NativePreparationStatus 保持准备回执语义。新类型集中在 native_contract.rs，并同步不支持平台的实现。
- 网关管理员 native-preparation GET 提供新鲜检查结果；保留上次准备回执作为独立历史信息。未知、缺失、旧 sender 不支持新接口时显示 unknown/unsupported，并给出固定原因。
- 新增 `GET /admin/native-preparations` 批量返回最近巡检快照，超过 45 秒的 ready 降为 unknown。环境页一次批量读取并再次核对绑定/时间，原生环境每 20 秒串行刷新。
- bench 为环境列表增加 `native_preparation` 安全摘要，仅含绑定、状态、检查时间、数量、PID 和固定原因。合并必须核对 bench account_id 与 cc2api_account_id 映射、环境 ID 和代次；查询采用有界批量/缓存新鲜度机制，避免串行慢请求阻塞整个环境列表。最近观察超出有效窗口显示过期待检查。
- 状态查询采用 prepare_existing 的 wake=false 路径；页面刷新不触发模型调用或创建休眠环境。控制面鉴权与桥接路径白名单按既有机制复用。

## 持续巡检与恢复

- 扩展现有 NativePrewarmCoordinator；默认每 20 秒扫描已启用 native293 账号，初次检查立即执行。沿用现有并行限制和按账号合并队列。
- 检查和准备共用有界队列；每账号同时至多一个维护任务。健康进程只检查，身份失效或空闲可用进程缺失时进入原零模型 prepare。
- 忙状态优先等待原任务归还；空闲恢复在资源允许且无正在启动任务时只补一个。避免轮询造成重复备用进程。
- 准备失败采用有界退避，已有新身份/代次事件可以触发新检查。停止协调器取消在途准备，并回收所有自身控制登记。
- 权威凭据仍由 AccountService 的既有所有者解析；刷新遵守事务与排他门禁。旧 token/环境/内核结果在发布前重新核对。
- 系统更新 admission、账号维护、停用/休眠均先行判断。周期扫描只查询已运行绑定；不启动角色、不抢维护租约、不打断在途请求。
- 内核切换与回滚继续由 native_transition 和既有维护排空所有，巡检遇到切换保持让位。完成后检查当前目标并重新发布准备状态。

## 业务诊断合同（新增）

- 新增 NativeRuntimeObservation，作为 NativeRequestObservation 的可选 `runtime` 字段，兼容历史缺字段。通过现有 sender 观察头传递，网关消费后移除；受信类型集中解码并持久化至现有诊断 JSON。
- 字段：`worker_id:string`、`worker_pid:u32`、`kernel_generation:string|null`、`warm_hit:bool`、`preparation_wait_ms:u64`、`checkout_ms:u64`、`worker_start_ms:u64|null`、`prepared_ms:u64`。worker_start_ms 记录当前请求实际触发的启动，暖复用时为 null；页面显示为未发生启动。历史 runtime 缺失显示未观测。
- 等待、取进程、启动握手、执行至 cc_prepared 分段使用所属进程内单调时钟；prepared_ms 从 sender 池接收已验证业务信封开始计到真实 cc_prepared，包含池内等待。网关原提交计时继续包含传输与信封接收，不能扣除恢复时间。分段存在包含关系时页面明确注明，不相加为虚构总耗时。
- warm_hit 只在当前业务复用接收业务之前已完成握手的进程时为 true；当前请求触发恢复或等待本次才完成的握手时为 false。Worker 内保存实际握手完成的单调时刻，与业务接收时刻比较。真实 PID 与 worker_id、请求 ID 关联，禁止用上次准备回执补写当前请求。
- 准备失败发生在 cc_prepared 之前时，走既有本地诊断结果记录阶段与固定原因，保留可取得的阶段证据。不得把未观察到的时间写成零。
- 公开日志不含 bearer、身份摘要、秘密路径、原文或任意异常；正文、metadata、billing、会话与取消规则沿原合同。

## 页面与兼容

- 环境卡片在现有风格内增加原生准备状态、空闲/实际进程数、最近检查时间及固定原因。基础环境 state 保持既有容器生命周期含义；新增准备中指示代表模型接单前的本地准备状态。
- 现有内核版本与“上次预热回执 PID”继续表示历史操作回执；实时状态独立展示，避免相互覆盖。
- 诊断详情在现有阶段耗时区增加复用、PID 和计时。旧记录显示未观测，0 与 null 逐项区分。所有服务端文本安全转义，轮询结果核对当前行与代次，销毁或换页撤销旧结果。
- legacy 走原路径；停用与睡眠不唤醒；原账号资源限额、二进制版本、固定映像核验、会话池和模型参数保持既有合同。

## 验证、交付与恢复

- 离线合成凭据、回环上游计数和固定真实二进制验证为主。准备/巡检/状态读取零模型，首个业务恰好一次；保存 PID/worker_id、代次和单调计时。
- 长时间空闲采用控制空闲年龄覆盖 1 分钟、30 分钟和 4 小时，并真实等待 61 秒验证保留一个进程。性能对照采用约 790 KB/57 工具相同正文与独立 0.25 核配额组，三组配对报告冷启动、准备后首轮和稳定热请求分布。
- 新鲜状态与请求实际 checkout 之间的故障窗口通过故障注入覆盖；期望进入准备并记录真实冷恢复，避免虚报热命中。
- 代码交付经精确范围 Check-All、Spec、Git 与联合 CI。本轮不自动生产部署；后续生产验证通过零模型接口及真实进程证据完成。
- 失败恢复优先取消本任务准备、保留既有排空/回滚机制；交付回退采用前一联合控制/账号镜像，不单独运行不兼容新旧私有消费者。业务数据与凭据不需要迁移。

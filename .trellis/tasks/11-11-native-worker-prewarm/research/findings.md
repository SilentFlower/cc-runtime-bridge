# 预热路径研究

## 已验证事实

- `research/cold-start-evidence.json`：首条约 14 秒发生在原生提交与组装快照之间，第二、三条分别约 0.50/0.34 秒。
- cc2api `src/service/runtime_transport.rs:307` 的 `PreparedTransport.native_ready` 请求 `/internal/native/status`；当前能力响应只覆盖配置、分发体、协议与环境代次。
- cc2api `src/service/native_runtime.rs:366` 的 `Worker.start` 完成私有目录、身份、当前 bearer、受控代理、固定文件启动和真实握手；此函数可供零模型准备复用。
- 同文件 `NativePool.checkout` 处理账号配置/身份/凭据/并发摘要、旧空闲进程退役、封存映像共享和按需启动；`schedule_idle_reap` 已保留一个暖进程。
- `NativePool.submit_validated` 取得进程后才调用 `worker.execute`；预热应在取得并核验进程后归还，业务执行保持独立。
- 原生二进制的 `worker_ready` 已晚于绑定和本地构造依赖初始化。现有固定二进制支持零模型启动握手，本轮可复用该能力。
- 网关 `AccountService.resolve_upstream_token` 已所有权化解析凭据；`update_account/update_account_options` 和 OAuth 成功保存是配置及凭据事件的现有入口。
- 调度器 `AccountRuntime.ensure` 创建/唤醒角色，`transport` 会调用 ensure；普通 transport 不能作为后台扫描的只读入口，否则会唤醒休眠环境。

## 方案约束

- 凭据仅由网关解析并通过服务私有通道交给 sender。调度器只发布账号/环境/代次通知。
- 使用独立预热信封与准备状态；预热全过程不投递 request_start/request_input，不创建业务诊断和额度证据。
- 生命周期通知只入有界去重队列，原维护锁内不等待跨服务预热完成，避免 ensure 与网关回调重入死锁。
- 后台启动补偿只解析已运行环境，休眠/停用/维护中的环境保持原状态。
- 维护、停用及代次替换可取消旧准备；旧结果发布前复核归属，准备占用与业务用量分开。

## 涉及仓库

- cc2api：原生准备合同、sender/传输、池、网关协调、账号变更通知、启动装配和回归。
- bench：环境准备后的通知、只读绑定解析和 Python 回归。
- 本仓：离线真实二进制消费者夹具、任务材料与必要规范记录。

## vm2api 对照与速度增量

- 本机 vm2api 源码提交为 `e0fbed172c40721bd68d7d9d5d8a53a4205b1e0c`，实际对照 cli-node SHA256 为 `8484c4c58f4b7782a190f7cab7c8aa5d1f706ae26b2d2a5cafe81af070f0611b`。源码画像声明与实际二进制分别登记，不据此认定它等同官方 303。
- 本仓使用生产已登记的 beta.2 分发体 SHA256 `a6998db0128cb3d0a9862f3b72e9e359e434840c9be4d57b69d56092847fd800`。
- 复用现有 `scripts/benchmark-runtime.ts`：每组交错 5 轮、每进程 6 次回环请求，只使用合成身份与密钥。另生成同框架大正文研究夹具，13 条消息、57 工具、两边出站约 790 KB，记录投递至模拟上游收全请求时间。
- 0.25 核容器最初因回环配置缺少 NET_ADMIN 失败，原日志保留。重跑仅在 network=none 的独立测试容器添加该能力，两个实现使用相同限制；实际账号容器权限保持原配置。
- 小请求宿主条件下，我们/标杆暖完成约 18.33/11.47 ms；0.25 核下约 98.63/71.11 ms。两组旧 1.10 相对诊断为 false，保留原退出 1；实际样本各 60 次回环发送完整收口。
- 大正文宿主条件下，我们/标杆暖完整收口约 45.03/97.79 ms；投递至上游完整接收约 36.42/92.88 ms。旧诊断为 true，实际出站工具数均为 57，字节数分别约 790277/790335。
- cc2api `src/service/runtime_transport.rs` 的 native_status 和 native_forward 均调用 NativeSenderConfig.verify，当前每次对约 27 MB 分发体做完整摘要。网关每次 prepare 也新建管理 HTTP Client。这些外围开销须在实际阶段计量后优化；运行时微基准不包含完整控制面、采集持久化或真实模型推理。

## 会话、身份与遥测对照

- vm2api `src/lib/identity/crs-headers.mjs` 统一槽位 UA/Stainless/session 等字段，协议头采用条件白名单；最终 cli-node 仍会再次组装实际 HTTP。
- `src/lib/identity/vm-identity.mjs` 及 `identity-rewrite.mjs` 将设备、凭据账号和已解析上游 session 写入 metadata.user_id。默认 rebuild 按身份与绑定 epoch 派生并粘住同 VM 的出站会话，另有 passthrough 分支。
- `crs-persona.mjs` 控制面会由 session 派生 billing prompt ID，并使用固定首轮索引；这些属于该实现的选择，不能直接替代本项目真实 prompt/轮次/父子上下文合同。
- 本项目若接入原 session 池，应在原生封口前按账号解析映射，统一正文 session、HTTP session 头和同次上下文，最终 CCH 继续原生生成。本地 sticky、队列、缓存、取消和业务历史继续按真实下游会话隔离。
- 原有 4 槽/60 分钟 owner_only 策略收敛活跃映射；累计 ID 仍随过期与新成员变化。多历史并行、thread 前驱、父子/compaction、缓存与迟到响应需专门验证。
- vm2api `src/lib/protocol/seed-policy.mjs` 仅显式 telemetry_disabled=false 开启，其余默认关闭；槽内原生遥测单独配置。本项目原生二进制也已有显式 on/off 能力，sender 当前固定 off。
- 旧 Rust messages 分支的 activate_session 会激活原有自动遥测后台会话。native 分支提前接管后跳过该调用；当前账号 auto_telemetry=false，二进制 off。用户本轮已决定接入现有会话映射池；遥测策略继续沿原行为。

## 大正文 0.25 核最终对照

- 5 轮、每进程 6 次，共 60 次回环发送，两边均保留 57 个工具，出站约 790 KB。
- 我们/标杆启动至首轮完整完成中位约 12,879/12,884 ms；暖完整收口约 284.60/590.02 ms；暖投递至模拟上游完整接收约 195.98/585.85 ms。
- 本仓 cc_prepared 帧接收中位约 283.78 ms。快照输出与唯一发送可并行，事件接收时间可以晚于模拟上游收全时间；它属于阶段日志口径。
- 小请求两组旧相对诊断 false，大正文两组 true，所有结果按原脚本保留。本轮总计 240 次合成回环模型调用，真实上游调用为 0。
- 结论：冷启动在 0.25 核下是双方共同的秒级开销；这组大正文下本仓运行时较快。后续优化重点是加载前移与已定位的外围热路径，性能比较不替代正确性验证。


## 会话池接入追加研究

- `cc2api/src/service/gateway.rs:2309` 原生分支早于 `:2372` 的既有 build_upstream_session_rewrite，解释了现有开关未覆盖原生 messages。
- `cc2api/src/service/account.rs:1097` 统一读取 enabled/size/TTL/refresh_policy；`src/store/cache.rs:116` 定义真实 ID、可空上游 ID、动作和活跃数量。Memory/Redis 已有稳定显式映射及失败合同，沿用已有实现。
- bench `.trellis/spec/cc2api/backend/service-architecture.md:198` 的账号级会话池场景明确：先完成 admission，池解析早于 CCH 和出站 session 头；本地 sticky/RPM/cache 仍使用真实 session。event_logging 只读。
- 本仓 `src/shared/native-input.ts` 的 mergeNativeContext 与 `src/control/header-policy.ts` 都会拒绝 session 冲突。直接单改 context.sessionId 会与原 metadata 冲突，必须在保留原始验证的基础上窄改所有 session 表达。
- Prompt ID 来自本轮 billing/显式上下文，代理 ID 与父子关联有独立字段；池映射不合并这些业务身份。最终 CCH 仍由固定二进制针对实际发送正文生成。
- 会话池与运行时进程池是独立机制。预热只准备进程，不应解析或刷新会话映射。

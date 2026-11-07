# 本地池启动诊断与故障隔离设计

## 边界与取舍

入口 `scripts/local-pool.ts` 经过 LocalPoolEngine、Node TLS 接收端、仅回环隔离驱动和固定目标代理，成功就绪后才接收模型作业。本轮补启动诊断及离线验证，不新增 HTTP、数据库或页面字段，不重构取消机制，不修改实际服务和用户配置。

历史失败没有原始内部证据，故先建立可验证的观测能力，不把增加诊断等同于历史根因已修复。诊断复用 CLI 已有的 BridgeError 安全说明输出。

## 诊断合同

新增 `scripts/testing/local-pool-startup.ts` 集中定义 LocalPoolStartupDiagnostics、受控启动错误和解码，依赖既有 BridgeError/isObject，不建立通用日志框架。

- 对象仅含 stage、failureCode，严格重建，不展开输入附加字段。
- stage 固定为 unknown、workspace、certificate、forwarder_build、node、proxy_environment、forwarder_start、tls_listen、tls_probe、forwarder_verify、driver_start、driver_isolation、proxy_start、proxy_probe、driver_setup、runtime_verify。
- 显式检查代码为 UNKNOWN、CERTIFICATE_GENERATION_FAILED、BUILD_FAILED、NODE_NOT_FOUND、PROXY_CONFIG_UNSUPPORTED、INIT_FRAME_INVALID、RAW_HEADERS_MISMATCH、ISOLATION_CHECK_FAILED、TARGET_REJECTION_FAILED、RUNTIME_VERIFY_FAILED、CHANNEL_TIMEOUT、CHANNEL_CLOSED、CHANNEL_TRUNCATED、CHANNEL_INVALID。
- 系统或 TLS 原因只读取直接 code 并允许 ENOENT、EACCES、EPERM、EADDRINUSE、ECONNREFUSED、ECONNRESET、EPIPE、CERT_NOT_YET_VALID、CERT_HAS_EXPIRED、DEPTH_ZERO_SELF_SIGNED_CERT、UNABLE_TO_VERIFY_LEAF_SIGNATURE、ERR_TLS_CERT_ALTNAME_INVALID。不递归复制 cause，不按任意 message 猜测原因。
- 未识别阶段与代码分别降为 unknown/UNKNOWN；不保留原始异常、stderr、URL、请求信息或证书材料。
- 启动错误保持 BridgeError.code=local_pool_startup、status=503 和“未发起池推理”语义，中文说明附受控阶段及代码；内部仅保留上述安全对象，不附原始 cause。

## 采集与私有协议

1. LocalPoolEngine 在创建资源、证书、构建、Node/代理检查、启动两类进程及就绪自检前更新实际阶段；明确检查失败给固定代码，其余异常仅提取白名单代码。
2. TLS 接收端标记初始化、证书、监听、TLS/原始头探针；隔离驱动及代理标记隔离、目标拒绝、合成目录、运行时验证。完成就绪后清除启动标记，运行期错误不得伪装成零模型的初始化失败。
3. ForwarderFrame 与 LocalDriverFrame 的 fatal 新增可选 startup 字段。两个集中解码器重建安全诊断，旧帧兼容；缺少有效子阶段时保留宿主已知等待阶段及未知原因，不从 message 推断。
4. PrivateProcess 为原有超时、EOF、截断和解码异常附固定通道代码；原始解析异常不带入启动说明。单读取器、超时值、关闭宽限和进程树边界保持。

## 失败清理与恢复

资源创建也纳入阶段捕获。保存初始安全失败后分别尝试关闭已创建的驱动和接收端，再删除本轮目录；一个清理步骤失败不能阻止其他步骤，也不能覆盖初始证据。验证报告记录实际剩余资源及缺口，不能把清理成功写成推测。

不自动重新初始化或重放。测试在故障后用新目录、新账本独立启动，证明资源和状态不污染下一实例。TLS、模型超时、代理和隔离规则保持。

## 双实际 CLI 故障场景

复用已有 PTY、回环假池与 TLS 实收方法；两个实际客户端共享合成 HOME/config/cwd，使用独立会话，各创建 3 个实际 Explore 子代理，用独立标记核验父子归属。

假池以明确闸门控制发送阶段，覆盖活动取消、排队取消、活动客户端异常退出、排队客户端异常退出，并交替故障客户端；至少一次故障处于子代理调用中。另一会话需完成自己的响应且继续下一轮。

对照入站、TLS 实收、假池、终态及账本：排队取消零发送，已发取消最多一次且无自动重放；辅助调用按实际请求另行关联，不能误算成重复业务发送。sessionId、响应、子代理和有证据的父代理不能跨会话，缺证据保持未知。仅清理场景拥有的进程。

## 验证、兼容与回退

- 单元覆盖白名单、未知降级、扩展字段、合成秘密、旧 fatal 和通道代码。
- 本地故障注入覆盖证书、TLS/原始头、自检拒绝、就绪超时及提前退出，实测零模型、资源清理和下一独立初始化；注入只在测试工装，不加生产环境开关。
- 串行和每批 4 个实例并发启停，共享 dist 只构建一次，资源及账本独立；所有模型场景仅 lo、合成配置、固定原版，不请求用户 8787 模型接口。
- 外部状态码、业务事件、ready 和历史记录不迁移；新增 fatal 字段可选。风险是白名单漏判、运行期误标、清理覆盖首错，分别用未知降级、就绪边界和真实失败注入验证。
- 研究观察器可能影响时序，仅作附加证据，不成为运行依赖。回退仅撤销本任务改动，保留已有分类、归因、头合并修复及其他工作区变更。

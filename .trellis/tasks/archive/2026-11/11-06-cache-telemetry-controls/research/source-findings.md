# 缓存与遥测接入证据

## 固定身份

- 当前产品基线：64e74d11dead9034687f1268643ad235bc066219。
- cc2api：/root/project/vibecoding-bench/cc2api，47e75ef4a1e982e2693edab81d5387eedb6adf40；本轮只读。
- vm2api：/root/project/vm2api，e0fbed172c40721bd68d7d9d5d8a53a4205b1e0c；本轮只读。
- 官方 293：/root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe，本轮重新核对 SHA256=8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978。
- 原生源码读取 /tmp/ccrb-build-gWG8B9/modules/，模块摘要与其 modules.json 一致。chunk-cxjvwxsa.js 摘要 c4bb209c7bb258b472a6d9a060718a2494ecb1decfc76ee43749de0c605c5db8；chunk-3s94kw4m.js 摘要 26a909ce69cb6889f8564e92580c5f1f5f100a56a1aaa5311aef5f1e803618ec。提取源码不进入交付。

## cc2api 的实际策略

- rewriter.rs:3860 的 API 分支在 auto/rolling/stateful/sub2api 下均调用 sub2api 选点；ClaudeCode 的 sub2api 分支位于 :3903。
- :4034 清除全部顶层 message content block 上的 cache_control，保留 tools/system。
- :4695 先选最后一条消息的最后一个可缓存块；消息数至少四条时再选倒数第二条 user 消息的最后一个可缓存块。尾部优先，预算为本地上限四减去 system/tools 已占数量。
- :4784 会将两个候选的 string content 规范化为 text block 数组；本项目应在实际选择成功后才转换，避免无断点预算时仍改变形状。
- :5945、:5971、:6002 表明可选块为 assistant text、user text/tool_result，排除 thinking/redacted_thinking；默认新标记为 ephemeral、1h。TTL 改写是独立设置。
- :5793 不把根自动缓存计入其预算。该处理不直接移植：本轮遇到根自动缓存时整体跳过优化，避免与已有自动机制叠加。
- :10267、:10330 有 API 和 ClaudeCode 场景单测。当前轮只读取测试，没有重复运行 Rust 测试或修改参考仓库。

## 现有桥接边界

- src/control/server.ts:readConfig 是本机启动配置入口；EngineConfig 来自 src/control/engine.ts，不由请求控制。
- src/runtime/293/job.ts:runNativeJob 在唯一发送回调内替换原生正文、合并头、调整 stream，随后生成 cc_prepared 并调用 Ree。缓存策略应放在所有业务保留校验完成之后、快照和 Ree 之前，不能修改构造种子。
- src/control/trace.ts:event 目前对原生中间值写死“仅改写账号身份及 CCH 占位”；启用缓存策略时必须根据实际结果更新此说明。
- RuntimePayload、协议校验和日志查询分别由 src/shared/contracts.ts、src/shared/protocol.ts、src/shared/log-api.ts 持有；新增诊断需要同一类型和边界校验。
- scripts/build-runtime.ts 的 BRIDGE_SOURCES 固定构建输入；新增进入 worker 的模块必须纳入摘要清单。精简产物的接纳登记在 src/runtime/compact-profile.ts，不能拿外部 manifest 自动授信。

## 固定 293 遥测

- chunk-3s94kw4m.js 的 dIt/B$/Ct 直接读取环境：NONESSENTIAL 或 DISABLE_TELEMETRY 的非空值均抑制遥测，不能以字符串 0 表示开启；DO_NOT_TRACK 另有布尔解析。
- chunk-pesdmje3.js 的 gy 还检查原生提供方/策略条件，开启桥接配置不能绕过这些条件。
- chunk-dfeky22r.js 是公开语义别名门面：initialize1PEventLogging=SLe、is1PEventLoggingEnabled=a4、logEventTo1P=GCt、logEventTo1PAwaitable=Jk、settle1PEventLoggingBeforeExit=MDs、shutdown1PEventLogging=bLe，定义都在已绑定的 chunk-cxjvwxsa.js。
- SLe(storageV5?) 返回 void，读取原生批处理配置并创建官方 logger/exporter；无参数调用已有官方重初始化用例。初始化会清空并重放 preInitQueue，因此本地 bootstrap 期间必须保持关闭，不能初始化后才屏蔽种子事件。
- GCt/Jk 根据 a4 检查资格并由 gE/myr 生成真实原生 metadata；不应由桥接拼造 tengu_init/api_success 或进程指标。
- MDs()、bLe() 为异步退出入口。退出清理必须适配当前引擎 1500 ms 的进程关闭宽限，不让遥测延迟模型响应或阻塞退出。
- 当前 initializeCli 只执行本地 CLI 构造初始化，未调用 SLe；worker 在本地 bootstrap 后发 worker_ready。精简闭包目前未显式登记这些导出，新增绑定后需要重新构建并验收。
- 原生 exporter 默认地址为 https://api.anthropic.com/api/event_logging/v2/batch。验证复用本机 CONNECT/TLS 接收器，采用独立命名空间、配置和合成身份，不加入生产端点覆盖功能。

## 立项阶段的证据边界

立项时只完成源码、签名及官方文件身份核对，尚未完成固定 293 的完整桥接遥测开启实验。既有 vm2api 的 85 项测试及其原生进程开关实验只能证明 vm2api 本地产物行为，不能代替本项目的新增验收。

## 实施中的新增证据

- chunk-nayw0pf7.js 的 G_o(sink) 只在当前 host 首次绑定，并异步回放旧队列。桥接在初始化前绑定接收器，按业务 ALS 作用域放行，结束时撤销许可，避免把 bootstrap 或迟到回调当成新作业事件。
- chunk-t17r8fg2.js 的 P8 同时连接第一方和第三方通道；本轮只接第一方 Jk，使用同一 context 的 gyr/Yus 做原生采样和 metadata 脱敏，不初始化第三方 sink。
- chunk-19kr5wet.js 的 Jb() 是官方 configureGlobalAgents；它设置第一方 HTTP 客户端的代理、CA 和 dispatcher。模型 Ree 的 FetchSession 已走代理不能证明这个独立 HTTP 栈也已配置。
- 未调用 Jb 的首次原版开启实验未收到上传，结果保留于 artifacts/cache-telemetry-controls-20261106/telemetry-original-proof/；加入官方 Jb 后的回环证明位于 telemetry-original-network-proof/。新夹具同时记录并拒绝明文 HTTP forward，成功样本只有 CONNECT/TLS。
- 后一证明覆盖 preserve/off、sub2api/off、preserve/on、sub2api/on，以及遥测 500/慢响应。关闭组每组两次模型、零上传；开启组每组两次模型、一次实际批量上传。慢响应时退出约 1024 ms，暖请求约 30 ms。事件自然包含 tengu_api_query/tengu_api_cache_breakpoints 等，无桥接制造的 tengu_init/api_success。
- 第一方实收入口 cli、设备为专用合成 e×64，所有 session 归属于业务作业；没有 bootstrap 会话。身份、进程指标和事件编码都由固定 293 生成，真实上游请求为零。
- P8 的同步重入保护用于防止元数据依赖再次记录事件；其隐私处理先等待 Nco/w9t 模型目录就绪，再登记 gDn(tt()) 并调用 Yus。本轮按同样顺序接入，模型目录等待放在后台，并加入重入与目录尚未就绪的单元边界验证。

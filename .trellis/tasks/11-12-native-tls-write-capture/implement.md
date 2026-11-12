# 实施计划

## 顺序
- [x] 创建规划任务，记录当前组装与最终采集边界。
- [x] 在真实beta.5隔离进程核对ELF符号、动态依赖和可能的诊断参数；两轮各9条合成业务，模型真实调用0。
- [x] 首次Brief评审通过后start当前任务并按trellis-route进入实现。
- [x] 完成第一技术门槛：固定SHA挂点、实际接受长度、归属、TLS开关对照与失效收口。若失败，记录技术阻塞并停止后续产品接入。
- [x] 读取根运行时/日志、cc2api后端/前端及bench私有采集规范和相关类型定义，冻结三仓基线。
- [x] 实现仅绑定目标进程的有界观测与私有事件合同，验证部分写入、复用、取消、并发及探针退出。
- [x] 贯通sender、原子快照合并、Python读取和Vue阶段展示；保留组装策略与历史兼容。
- [x] 完成真实回环、完整性/脱敏、资源开销及浏览器验收。
- [x] 执行Pre-Check/Check-All及三项边界修复重检；按完成链进入Spec同步及精确Git计划。

## 主要影响面
- 根仓native/tls-observer/{capture.bpf.c,observer.py,http_capture.py,build.py}及合成协议测试；scripts/testing/cc2api-native.ts提供签名候选与异步并发验收。现有beta.5二进制作为精确准入对象。
- cc2api/src/service/native_runtime.rs、native_capture.rs和私有合同；web/src/api.ts、NativeStageDetails.vue、RequestDiagnostics.vue。
- bench/orchestrator/native_capture.py及相应合同测试。新宿主生产观测进程、权限和部署另行授权。

## 验证依据
- 固定二进制来源、实际memfd执行体SHA、已验收原生唯一提交和原有预热复用。
- 独立TLS接收器核HTTP头/实体/实际CCH；采集关闭/开启各比较真实ClientHello与连接行为。
- 丢事件时hash/字节范围为未知；部分写入按实际接受量；迟到回执及PID/连接复用不串请求。
- 实际Rust写入→Python读取→Vue展示；旧schema1快照、info/debug、权限和6MiB/2MiB预算。
- 当前工具命令继续使用bun typecheck/unit/native、Cargo fmt及适用测试、Python合同回归和实际390像素浏览器。按实际变更收敛必要验证集合。

## 回退点
- 第一技术门槛未通过时保留当前wire_final unavailable与组装诊断，不替换TLS实现。
- 采集关闭/工具失效沿原生业务路径，受控显示原因；原流与单次提交保持。
- 软件发布及生产启用沿后续独立上线授权与SOP。

## 异步落实
- NativeTlsSlot在worker身份核验后后台预备，业务take同步立即返回；每worker一个在途启动，迟到结果及退役取消有独立代次。
- CAPTURE_PREPARING表示本次到达时的准备缺口。CAPTURE_PENDING表示已排队的后台证据；queued仅表示写入已排队。原生cc_prepared组装快照保持。
- 初始record_queued使用两个有界保存许可，模型路径不等待磁盘。最终副本后台收口并原子保存，同作业更完整的证据保持优先。
- 新增capture_id区分采集代次和业务request_id；私有帧schema_version=1，实际客户端请求头绑定和PID命名空间验证保持。

## 已获得证据
- 实际TLS接受30,418字节，与独立原始HTTP实收整体SHA及实体SHA一致；开关ClientHello的完整协议投影一致。
- 强制4KiB测试ring丢弃两事件，业务单次提交完成；EVENT_LOSS、实体范围与哈希null。
- 已就绪的六个不同PID并发实际模型HTTP，Rust快照→生产Python读取→Vue桌面/390预览通过首轮；后续最终源码复核仍在执行。全部合成凭据、隔离回环，真实模型0。
- Rust全量4线程回归871项通过、8项条件跳过；根单元180项、类型检查、Python读取5项、采集HTTP解析3项及前端构建通过。新源码后定向验证以最终日志为准。

## Check-All修复与最终验证
- FBK-001：两类最终变化显示分析状态，只有complete空列表显示一致。1440/390像素各覆盖完整空、截断空和截断非空，共6组通过。
- FBK-002：正文复制和两类摘要均限定首条Content-Length，覆盖独立事件、合并事件及正文边界交叠，下一条info请求原文保持隔离。
- FBK-003：序号缺口冻结解析；帮助进程及Rust持久层对不连续预览清空原文。首中尾缺口、跨事件凭据和5类失败原因的真实私有落盘回归通过。
- 修复后Rust全量872项通过、8项条件跳过，采集解析5项及Python读取5项通过；Cargo格式、Python语法、Vue类型及构建、差异空白检查通过。
- 实际beta.5六PID并发回环重跑通过：6次合成提交、峰值并发6，每份最终实体SHA与独立TLS接收器一致，并经生产Python读取器验证。全量测试与该工装同时运行的首轮出现5份快照，等待第6份超时；单独运行完整通过。有界保存许可为2，过载允许dropped并记录固定原因。
- 最新4KiB测试ring故障注入丢2事件，业务单次提交完成，EVENT_LOSS、空头/正文、空哈希及未知范围均通过。原页面异步重读、关闭停止及旧响应隔离再次通过。
- 最终日志：/tmp/native-tls-rust-repair.log、/tmp/native-tls-loopback-repair-solo.log、/tmp/native-tls-fault-repair.log、/tmp/native-tls-python-repair.log、/tmp/native-tls-browser-repair.log、/tmp/native-tls-parent-repair.log、/tmp/native-tls-web-repair.log。全部合成凭据及隔离回环，真实模型0。

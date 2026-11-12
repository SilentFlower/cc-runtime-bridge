# 10-30原生环境恢复证据

## 授权与目标

- 用户确认本任务Brief，选择沿用11-5无限内存模式，标准并发保持4。
- bench账号10、gateway账号10、环境4201ce3f913841d4b2a5a96bc996bb40。
- 操作基于现场现有批次ci-43143996590-1，目标重建继续使用原镜像身份。其他容器保护摘要精确匹配。
- 私有服务器证据目录：`/opt/vibebench-v3-us/operations/native293-10-30-20261112/`。本地私有脚本及日志位于bench的`.deploy/native293-10-30-20261112/`。

## 实际变更与结果

- 在既有排他维护门禁内核验目标空闲，内部quiesce确认环境收口；CAS将目标fingerprint.mem从1536m改为unlimited。
- 内部transport复用AccountRuntime.ensure完成旧布局清理及三角色重建，环境代次28→29，状态ready。fingerprint.native_sender_memory由原流程生成unlimited，额外swap字段保持2048m。
- 原生配置memory_mib=0、max_workers=8，标准并发4保持。
- 2026-11-12T03:56:06Z，零模型准备ready，版本2.1.293、raw_input_protocol=1、PID=9、idle_workers=1、live_workers=1。
- 独立读取`/proc/9/exe`，执行体SHA256为22f26d7803f80630968caf21b6170cf9bb94d87bea6f5eef678464f3bb0d3ecd，memfd四项封存标记=15。
- 三角色Docker Memory=0、MemorySwap=-1，实际cgroup memory.max与memory.swap.max均为max。CPU策略与旧角色逐项一致。
- 账号身份、目标HOME设备配置、项目目标/会话及其他账号资源摘要匹配；其他容器ID、镜像、运行状态、启动时间、重启次数及资源摘要匹配。
- bench/gateway两库quick_check均为ok。运维主动模型调用数为0。该次核验结束时，恢复后的自然业务尝试列表为空。
- 页面截图及后续只读环境API均显示代次29、原生ready、PID9。在线内核管理仍按11-5单环境灰度返回，详见switch-analysis.md。

## 首轮运维停止与修正

首轮脚本把快照holders解释为额外共享占用，在取得自身排他租约后触发断言。持久阶段为needs_verification。重新核对RuntimeGate.snapshot定义，holders包含当前排他lease；按精确owner/generation释放首轮租约后重试，改为核对所有持有者均属于本操作并等待已接受活动排空。首轮记录保存在attempt-1.json，成功回执为receipt.json。

## 定向验证

- 运维repair.py、verify.py均通过Python语法检查；repair.py成功退出0，verify.py成功退出0，实际结果保存于私有日志。
- bench：`.venv/bin/python -m unittest discover -s orchestrator -p test_native_sender.py -v`，5项通过，覆盖legacy缺省、有限预算、容量和无限语义。
- bench/orchestrator：`../.venv/bin/python -m unittest -v test_account_runtime.AccountRuntimeTests.test_native_layout_rebuild_after_quiesce_keeps_busy_sender_protected test_account_runtime.AccountRuntimeTests.test_native_unlimited_layout_and_capture_are_frozen_per_account test_account_runtime.AccountRuntimeTests.test_saved_role_cpu_policy_is_used_when_recreating_containers test_account_runtime.AccountRuntimeTests.test_native_startup_prewarm_configures_sender_before_notification`，4项通过，覆盖忙sender保护、停止后重建、无限资源、CPU策略及准备通知。
- legacy/native293切换事务属于后续研究建议；在线内核管理范围按用户后续明确指令纳入本轮实现。

## 全部原生环境在线管理：本地验证

- `release_key()`使用部署发行公钥，两个不同环境ID的原生状态均可读；非原生、缺失及非法公钥继续关闭管理。
- 两账号实际角色创建路径的Docker替身检查确认sender均获只读/runtime-releases与发行公钥，其他角色保持原挂载边界。
- bench/orchestrator：`../.venv/bin/python -m unittest -v test_native_kernel_upgrade test_account_runtime`，104项通过；覆盖原有签名/摘要失败、排空、原版恢复、回滚、重放和生命周期。
- bench：`PYTHONPATH=orchestrator .venv/bin/python -m unittest discover -s deploy/v3 -p test_manage.py -v`，34项通过；覆盖发行公钥独立配置与旧环境选择字段兼容。
- 部署工具首轮5项旧离线资料夹具失败：其AST从main.py提取已迁出的_SCHEMA。读取实际database_schema.py定义后修正夹具来源，完整34项重跑通过。
- `.venv/bin/python deploy/v3/verify_environment_ui.py --output .deploy/native293-10-30-20261112/ui-all-native`，17组场景通过，包含两个原生账号入口和第二账号窗口归属；真实网关静态产物、桌面/手机、主题、取消、冲突、重复提交和XSS均通过，真实模型调用0。
- 三份前端JS语法、Python变更文件语法与定向git diff --check通过。
- [上线后验证] 联合CI交付后，按平台更新SOP让现有原生sender取得发行目录，核对10-30与11-5的管理入口、实际只读挂载、原内核选择和资源策略。该阶段由本任务交付流程承接。

## 用户业务复测与第二个阻塞点

- 用户自然请求在2026-11-12T04:08Z仍返回503。网关日志已记录native_submission，模型尝试记录保持0，原生进程持续重新准备。基础ready验收仅覆盖启动条件。
- 现场cache_control_ttl_rewrite=1h，10-30实际分发SHA为423a6a848c84e09bcc73a8b7be481ed4ead44a6644cef94bbf47d2009d3f6b80，即内置beta.3。
- 使用同批原镜像创建临时network=none容器，合成账号、合成凭据及缺少消息的输入，对真实account-sender提交1h策略。返回503、x-v3-transport-error=before-send，正文为“当前内核缺少缓存TTL策略能力，请先激活配套候选内核”。测试容器按精确ID清理，实际模型调用0；回执为服务器私有目录ttl-capability-proof.json，本地日志ttl-offline-proof-fixed.log。
- 原生sender在业务指令写入前检查worker_ready.cache_ttl_rewrite_protocol=1。beta.5支持该能力；正式分发与执行体SHA见design.md。
- 当前业务恢复仍在进行，下一步为联合交付开放管理入口，让10-30实际运行beta.5，观察用户自然请求并单独记录实际发送和返回结果。

## 默认beta.5：正式附件与干净消费者验证

- GitHub发行查询确认当前最新已发布标签为v0.1.0-beta.5，发布时间2026-11-12T03:04:40Z。下载实际Release的清单、签名及linux-x64附件，使用现有发行公钥完成Ed25519验签。
- 通过实际native_sender.stage_asset暂存附件，大小27388048 B、分发SHA64c61cae565e9097de18cf61a35f46e7595f633cb14f7d6b8c6609fcd294ce89，固定官方来源2.1.293。Rust内置执行体SHA同步为af4cea9e21aa959c5e39c389173ba30ebb19b354b67acfe99164946450e9776d，大小112839864 B。
- Python下载默认、Dockerfile分发摘要和Rust消费者身份同时更新。已有显式在线内核选择保持独立。新镜像内置即为beta.5时，10-30在维护更新角色后核验真实身份；在线prepare明确拒绝相同内置分发，无需重复激活。
- 从cc2api固定HEAD d0ebf00261b9c23889066c01213c4afd49c5324e导出干净验证副本，仅应用本轮三个身份与长度片段。其他会话的TLS观察开发继续留在原工作区。
- 该副本cargo fmt --check通过；完整cargo test --locked共866项通过、8项依条件忽略，退出0。真实二进制与网关两个ignored场景另由隔离网络夹具显式执行。
- Python test_native_sender、test_native_kernel_upgrade、test_account_runtime共109项通过，退出0。
- 使用主仓固定HEAD的消费者脚本及依赖快照，实际beta.5附件完成HTTP CONNECT隔离TLS回环：native_real_binary与native_real_gateway均通过，合成发送28次、并行峰值6，运维实际模型调用0。覆盖原生启动、共享映像、凭据隔离、取消、轮换、网关准备及请求路径。
- 私有证据：beta5-default-proof.json、cc2api-clean-full-tests.log、default-beta5-python-tests.log、beta5-consumer-http.log。线上管理入口与业务恢复继续由联合交付和实际运行核验承接。

## 用户要求直接切换：10-30已激活beta.5

- 用户明确要求直接切换并收缩额外验证。复用线上现有AccountRuntime及native_kernel_upgrade，按账号维护门禁完成接入与激活。
- 仅本次运维子进程将原pilot选择指向10-30，使用部署原有发行公钥和已准备的正式beta.5附件。运行中的控制服务配置保持原值；页面全环境开放及镜像默认更新继续等待后续交付。
- 排他租约确认空闲，原quiesce停止目标角色；同批原镜像重新创建目标三角色，环境代次29→30，sender取得只读版本目录与发行公钥。原生配置仍为memory_mib=0、max_workers=8。
- 通过原prepare/activate实现激活beta.5，操作3538ada7-8331-4c2b-b0ca-cdddd2cabb60，状态active，真实PID9，执行体SHAaf4cea9e21aa959c5e39c389173ba30ebb19b354b67acfe99164946450e9776d。已持久保存显式beta.5选择。
- 身份摘要及其他容器身份/资源保持，目标维护租约已释放，运维主动模型调用0。实际业务返回由后续自然请求观察。
- 服务器回执direct-beta5-switch.json阶段completed，本地同名日志记录成功结果。先前准备的额外TTL验收夹具停留在本地构建阶段，按本次用户要求收缩后续验证。

## 自然业务恢复与截图中的两个进程

- 2026-11-12T04:37:33Z只读诊断显示：切换后的5次自然业务请求均200/success，attempt_count均1，profile_selection均native293_cc_prepared。
- 04:36:34.576Z首个请求开始，实际复用PID9，warm_hit=true、checkout_ms=0；请求于04:36:36.414Z结束。
- 第二个请求于04:36:35.242Z开始，与首个请求重叠；实际创建PID20，worker_start_ms=5708、warm_hit=false。截图的北京时间12:36:37晚于首个请求结束时间，页面空闲PID9与总数2对应这一扩容阶段。
- 后续三次请求均复用PID20，warm_hit=true、checkout_ms=0。当前checkout仅在取进程时选择已有空闲worker，开始扩容后继续等待所创建的worker；普通业务占用与按需扩容独立于adaptive_prewarm开关。
- 私有只读证据idle-reuse-requests.log，主动模型调用0。

# 本轮定向验证与交付证据

## 执行

- bun run typecheck：退出 0；日志 artifacts/thin-runtime-typecheck.log。
- bun test tests/unit：121 通过、0 失败；日志 artifacts/thin-runtime-unit-tests.log。
- 固定原版 CCRB_TEST_ORIGINAL_BINARY 下运行 control/local-pool/pool-forwarder 三份集成入口：20 通过、0 失败，包含 15 个真实客户端与模拟池内部场景；日志 artifacts/thin-runtime-integration-tests.log。
- 固定原版 CCRB_TEST_CLAUDE_BINARY，env -i 后运行 bun scripts/test-native.ts：54 通过、0 失败，2329 断言；日志 artifacts/thin-runtime-native-tests.log。之后仅修改不改变逻辑的源码注释；隔离代理独立由集成矩阵覆盖。
- bun scripts/test-pool.ts --binary <固定原版> --output artifacts/thin-runtime-pool-matrix：退出 0，15 场景全部通过，15 次离线模拟池尝试；无 --live、无真实配置文件。

## 关键观测

- 合成 Sonnet 5 分类与低 thinking 预算/越界温度/强制工具组合原值到达模拟池，单次发送。
- 26 MiB 正文完整穿过主 worker 和隔离 Node 代理，Node TLS 实收 27263492 B；最终日志仅预览截断，原始 SHA256 为 62a350f13ef3d49efb6e83568300d584d7cfdea3ecd27ce78557cf5232e40f82，独立 CCH 核验通过。
- 长请求首响应约 52065.6 ms、完整响应约 66063.3 ms，没有触发旧 30/45/50 秒预算，零重试。机器回执 artifacts/thin-runtime-offline-proof.json。
- 20 个作业在默认无预算的服务中保持提交顺序执行，无 queue_full；取消、慢消费者、关闭及重建沿现有场景验证。
- 日志页桌面/390 像素、真实 --print/交互客户端、工具续轮、子代理、上游 401/429/500、重定向、SSE 错误/不完整和显式验收超时均通过。

## 本地运行

- 停止前确认旧实例 manual-native-20261106T091357Z 没有 running/queued 请求；核对 PID 1489002 的命令行与轮次后 SIGTERM，原记录保留。
- 新实例 manual-thin-20261106T111802Z，PID 1617350，http://127.0.0.1:8787；启动信息明确无本地请求总超时。
- Linux 页面/健康及 Windows Invoke-WebRequest 健康均 200；健康显示 nativeFinalCapture=true、telemetry=off、budget/remaining=null、reserved=0。
- 启动和本轮工具验证的真实池推理次数为 0；用户后续手工调用不计入这一断言。
- 受保护 requester.env SHA256 保持 cb0027b62ed054ea04bbe328c59dcd801518f7a6edb53b5a1bf0a4bf148291f0；8791 旧报告不改动。

## 解释范围

- 新的本地 TLS 解密故障已通过替换隔离代理实现验证；池发送之后的既有 ECONNRESET 没有被错误归为该根因。
- 本轮交付源码和当前原版 293 + preload 实例；旧轻量二进制未重建，不声称包含本次修复。
- 本文件记录定向验证，不冒充 Check-All 报告或真实池上线验证。

# 实施与验证

## 开工边界

- 用户已确认完整 Brief，任务为 in_progress；已通过 trellis-route(target=implement) 的 inline 执行。
- 不启动子代理。实现前按 trellis-before-dev 读取当前类型及函数定义。
- 基线包含上一轮 8 个相关修改文件，本任务一并承接；无关 .codex/hooks/__pycache__/session-start.cpython-312.pyc 保留。
- 不发送真实池请求，不复制真实安全分类提示词进测试；不更改受保护的 requester.env。

## 顺序

1. [x] 移除 input/parameters/job 中的模型参数政策，保留必要结构和普通 API 显式字段保留断言；更新对应单测。
2. [x] 给 generateNativeRequest 增加内部用途，原生分支仅取得传输上下文；用已复现的 Sonnet 5 合成场景验证最终正文保持和单次发送。
3. [x] 普通服务、NativeEngine、手工宿主和驱动的缺省总预算归零，条件化计时器；手工 Node 池转发同样归零，自动 acceptance 的显式预算保持。
4. [x] 移除 HTTP/TLS/私有协议的重复业务大小门槛、16 个作业拒绝条件及本层 HTTP 空闲截断，保留完整性和归属检查。
5. [x] 补充有意义的离线回归：原生参数透传、上游错误、26 MiB 正文、超过旧私有帧门槛的解码、20 个执行/等待请求、取消/关闭后继续、52 秒首响应及 66 秒完整请求。
6. [x] 更新 README/docs；使用现有客户端、工具续轮、子代理、TLS 采集和移动页面套件回归。
7. [x] 通过 inline Full Check-All，未处置 CHK/FBK/DOC 均为 0；同步既有运行时与日志 Spec，进入本轮精确 Git 计划展示。
8. [x] 在活动请求收口后仅替换核对 PID/轮次的 8787 实例，使用新运行目录；只做页面/健康/隔离检查，确认零自动真实推理，保留 8791。

## 验证命令和证据

- bun run typecheck；bun test tests/unit。
- CCRB_TEST_ORIGINAL_BINARY=<已核验原版293> bun test tests/integration/control.test.ts tests/integration/local-pool.test.ts tests/integration/pool-forwarder.test.ts。
- 原生完整回归在读取 scripts/test-native.ts 的参数与默认行为后选择只使用固定原版的离线运行，不能把旧轻量二进制当成源码修复已部署。
- 长等待用例的实际 test timeout 与外层包装预算同步调整，执行时继续提供进度；不以增加业务超时替代去除默认预算。
- 记录请求/响应原始 SHA256、池实收结构、转发次数、取消和真实 idle，不使用脱敏预览补造 CCH 或完整正文。
- 启动前后核对受保护配置 SHA256 和旧报告进程，检查 localhost 及 Windows loopback 页面/健康。

## 收尾

- Spec 只更新受影响合同，区分用户桥接与有限验收；不把回归条件写成新的业务门槛。
- Git 提交推送使用 trellis-push 的当前精确计划，上一轮 8 文件计划已被本任务扩大范围取代，不沿用旧确认。
- 本地实现、验证和实例替换已完成；当前任务保持 in_progress，业务推送成功后再由进度 helper 原子写入完成态及 Close。
- 服务重启本身不调用真实池；Git 确认不阻塞已经获准的本地验证和运行。

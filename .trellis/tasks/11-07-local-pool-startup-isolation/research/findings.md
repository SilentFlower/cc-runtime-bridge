# 启动诊断研究

## 实施前基线证据（b6312a1）

- 历史失败位于 `tests/local-pool/gateway.test.ts:254`，原日志 `artifacts/native-purpose-fix-20261107T040107717189Z/integration.log:32` 只有统一 503，耗时 843.84 ms；不能据此判断具体内部步骤。
- `scripts/testing/local-pool-engine.ts:48` 依次生成证书、构建并启动 TLS 接收端、核验原始头和空间、启动隔离驱动。`:75` 的 catch 丢弃原因；临时目录创建在该 catch 之外。
- `scripts/testing/pool-forwarder.ts:60` 的 TLS 启动探针预算固定 5000 ms；引擎两类就绪等待为 10000 ms。模型 timeoutMs 只到该文件 `:71` 实际转发时才启用，失败用例的 500 ms 不能解释启动失败。
- `scripts/testing/pool-forwarder.ts:134`、`scripts/testing/local-pool-driver.ts:83` 的 fatal 没有阶段。`scripts/testing/pool-common.ts:193`、`scripts/testing/local-pool-protocol.ts:26` 直接接纳带 message 的 fatal；新诊断须集中重建，不能展开任意扩展字段。
- `scripts/testing/pool-network.ts:36` 包含回环、环境、代理启动及目标拒绝实测；这些失败也会被上层遮蔽。
- `scripts/testing/pool-process.ts:31` 的超时、EOF 和解码异常未提供结构化代码；stderr 被排空丢弃，不能为了诊断而落盘。`:37` 关闭仅针对自己拥有的进程树，必须保持。
- 初始化不提交模型作业；实际 worker 延迟到业务调用才启动。并发研究在一次 build 后直接调用 LocalPoolEngine.open，避免多个 startLocalPool 构建共享 dist。

## 离线探测

共同条件：独立 unshare 网络空间且仅 lo，严格合成环境、固定原版 2.1.293、回环假池、新排他账本；不执行 engine.run，不请求用户服务，不读取真实池配置。

| 回执 | 串行 | 并发 | 启动失败 | 模型调用 | 结束时观察 |
| --- | ---: | ---: | ---: | ---: | --- |
| `artifacts/startup-research-20261107T051108338188Z/cold-report.json` | 24 | 8（两批各 4） | 0 | 0 | 本轮直接子进程与新增临时目录均为 0 |
| `artifacts/startup-observed-20261107T051534122475Z/cold-report.json` | 8 | 8（两批各 4） | 0 | 0 | 同上；16 次分别采到 TLS 握手成功 |

- 总计 48 次成功，账本均 reserved=0，历史 503 未复现。
- 第一组原计划给 24 次加载观察器，但进程启动后修改 PATH 没有改变本次 Bun.which 的解析结果，实际未加载。保留原报告并另写 evidence-qualification.json，不能把零事件解释为无 TLS 错误。
- 独立检查确认：直接执行 shim 可加载 TLS 补丁；新 Bun 进程启动前设置 PATH 才解析到 shim。第二组强制检查 Node 解析路径，并要求事件数、独立 TLS PID 数均等于尝试次数，16 条均 secure。
- 第二组未采到 TLS 错误、证书尚未生效或负时长证据；这不能追溯解释历史故障。
- 观察器只记录白名单代码、时间及证书生效时刻，不读取 stdin、参数或异常原文，不改变验证和私有协议，未注入实际服务。

## 实施前结论

- 已确认可修复的缺口是启动诊断丢失；历史 503 根因仍未知，原有 UND_ERR_SOCKET 也未定位。
- 用确定性本地故障注入检验安全诊断、清理及下一独立启动，不通过自动重试掩盖失败。
- 双实际 CLI 的取消和异常退出验证仍待实施阶段；此前正常并发通过不能替代故障隔离证据。

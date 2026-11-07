# 执行计划

## 实施顺序

- [ ] 按完整 Brief 取得首次实施批准后启动本子任务，进入 trellis-route 和 trellis-before-dev。
- [ ] 阅读并复用现有 PoolConfig、ForwarderFrame、LocalPoolLedger、PrivateProcess 和模拟池定义；实现前补全新增诊断类型的中文说明。
- [ ] 建立合成直连、CONNECT 加 HTTPS、收头前断开、流中断及下一请求恢复矩阵；记录真实模拟池接收次数。
- [ ] 加入按请求关联的可选安全诊断、集中解码与账本持久化，覆盖未知字段和旧记录兼容。
- [ ] 根据可重复证据修复本地传输缺陷；仍无证据时保持原始故障未定位，不制造已修复结论。
- [ ] 完成定向验证和 Check-All，证据交回父任务，说明本地修复、诊断改进与外部未定位项。

## 验证命令

- `bun run typecheck`。
- `bun test tests/unit/pool-forwarder.test.ts` 及新增的诊断合同测试。
- `bun test tests/integration/pool-forwarder.test.ts`，由现有包装器提供无外网空间。
- `CCRB_TEST_ORIGINAL_BINARY=<已核验原版> bun test tests/integration/local-pool.test.ts`。

## 检查重点

- before_send 不表示可以自动重试；bodySent 不证明模型执行；计数不是池端网络实收。
- 代理 CONNECT 与模型 POST 关联明确；同一 socket 或异步回调不污染下一条请求。
- 收到池响应头前的本地 502、实际池 HTTP 错误和流中断分别保留，凭据不进入诊断或回执。
- 仅在实际受影响时扩大回归；不运行 --live、不读取真实池配置、不复用用户正文作为测试输入。

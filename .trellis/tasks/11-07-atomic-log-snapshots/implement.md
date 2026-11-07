# 实施计划

- [x] 审批后读取最新 LogSnapshot/LogWriterConfig、数据库事务类型和 storage 夹具定义。
- [x] 补实际异步写/读并发回归及后续阶段 SQL 故障回滚用例，先确认旧实现会失败。
- [x] 实现正文准备、事务提交及详情读快照；保持写线程和响应热路径边界。
- [x] 执行 bun test tests/integration/storage.test.ts、相关 tests/integration/control.test.ts、bun run typecheck、bun run build。
- [ ] 按 trellis-route/check 及完成链复核、记录 spec 与精确提交范围；不修改当前服务数据。

## 回滚

仅回退本子任务的两处存储实现及相应测试/规范。现有结构与旧日志格式不变，不需数据迁移。

## 执行记录

- 用户已在三份完整 Brief 后回复“确认”，授权顺序实施三项及最多四次真实联合验收。
- 旧实现的两个新回归均失败：并发读到代次 1 请求/代次 0 阶段；后续阶段 SQL 失败后请求仍 success。修复后 bun test tests/integration/storage.test.ts 为 10 pass、0 fail，最终一轮退出 0。
- bun test tests/integration/control.test.ts：20 pass、0 fail，退出 0；覆盖日志故障及 SQLite 锁期间模型响应不阻塞/不重放。
- bun run typecheck、bun run build、git diff --check 均退出 0。Check-All full 三维通过，CHK=0、FBK=0、DOC=0。
- Spec written：.trellis/spec/backend/logging-guidelines.md 已补齐写入原子性、同一读快照及故障回滚合同，规范 diff 检查通过。
- 此子任务仍 in_progress，业务变更尚未提交；依父任务已确认的批次计划，继续下一子任务，三项完成后统一展示精确 Git 计划。

- 本批最终联合回归通过：211 项单元/集成、64 项原版及 42 项独立 TLS；四次真实 API 均成功，历史 17 条保留，21 条日志页面正常。证据目录：artifacts/api-integrity-20261107T143214420014Z。等待统一 Git 确认，尚未提交。

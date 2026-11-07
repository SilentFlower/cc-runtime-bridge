# 修复请求日志快照原子性

## 目标与范围

落实父任务 R2/A1：让请求行、上下文与五阶段索引以同一快照被发布和查询。负责 src/control/log-writer.ts、src/control/log-store.ts、tests/integration/storage.test.ts、必要的日志规范。

## 已确认事实

P1：log-writer.ts:53 先提交 requests、:63 再逐项提交 captures；log-store.ts:154/:158 分别读取。父任务 research/review-log-atomicity.json 记录实际复现 success + 旧 incomplete。

## 需求

- R2.1：新快照的请求行和全部阶段索引全成或全败；正文文件失写、SQL 错误可见，旧已提交快照仍可读。
- R2.2：一次详情查询取得同一读快照的请求、上下文、决策和阶段索引；正文 IO 继续异步，日志写入继续独立线程。
- R2.3：保留 WAL、唯一正文文件名、脱敏、清理、容量、summary/off 和旧记录合同，无数据库迁移与历史回填。

## 验收

- A2.1 对完整/运行中两代快照并发读取，不出现 success + 旧阶段或其它跨代组合。
- A2.2 在后续阶段 SQL 写入故障时，全组索引回滚；采集故障可见，旧正文可读。
- A2.3 原 storage 全套、相关控制集成测试、类型检查及构建通过。

## 交付顺序与范围边界

本任务先于其它两项执行以稳定证据，但无运行时参数功能依赖。其它 API 参数、轮次分配与旧连接问题不纳入。

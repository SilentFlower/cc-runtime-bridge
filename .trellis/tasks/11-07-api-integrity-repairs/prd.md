# 修复普通 API 参数语义、日志快照与续轮归因

## 目标

修复用户从本轮普通 API / TLS 日志审查中选中的三个问题，使显式关闭思考、持久日志快照和工具续轮标识都能按各自合同验证。

## 来源与已确认范围

- 用户先询问三项问题的原因、vm2api 的处理和适合本项目的方案，随后明确要求“那先修复我们这几个问题”。本任务仅覆盖审查报告 R1/R2/R3。
- 证据：artifacts/plain-api-tls-20261107T134346418310Z/review.md、review-record-comparison.json、review-log-atomicity.json、review-prompt-id-cause.json、vm2api-comparison.md。四条真实请求和原始误报证据保持原状。
- R1：src/runtime/293/job.ts:199 允许显式 disabled 被原生省略；当前自定义上游的四条响应都有 thinking。
- R2：src/control/log-writer.ts:53 先提交请求行，再写阶段；src/control/log-store.ts:154 分别查询，合成实际 LogStore 已复现跨快照。
- R3：src/runtime/293/cli.ts:98 只给末条消息加 Prompt ID；工具结果被官方轮次选择器跳过，前一用户轮次没有 ID。

## 子任务与职责

| 顺序 | 子任务 | 需求 | 交付与验收职责 |
| --- | --- | --- | --- |
| 1 | 11-07-atomic-log-snapshots | R2 | 请求行和阶段索引原子提交，详情同一读快照，故障回滚可验证 |
| 2 | 11-07-api-tool-prompt-id | R3 | 普通 API 工具续轮关联实际用户轮次，日志/上下文/最终头一致 |
| 3 | 11-07-api-disabled-thinking | R1 | 对明确的 thinking={type:disabled} 保留最终参数，并分开验证上游行为 |

## 共用需求

- R4：官方 2.1.293 二进制及其 SHA256 不变，仍由同一官方 SDK/原生传输唯一发送；身份、billing、metadata、父子标识和最终 CCH 来自同次上下文。
- R5：普通 API 与原生 CC 入站按各自路径处理；合法端到端头、显式业务消息和工具定义保留。日志脱敏独立，原始哈希保持真实观测语义。
- R6：不迁移数据库、不回填历史、不修改其它未提交工作；默认验收使用合成凭据和无外网回环。

## 跨子任务验收

- A1：日志并发读取及写入失败回滚均不出现请求行/阶段索引跨版本；采集错误可见，模型响应热路径保持非阻塞。
- A2：完整工具往返历史中的有效 Prompt ID 与最终头一致，六类上下文及已有原生 CC 参考不回归；缺失信息不猜测。
- A3：普通 API 明确 disabled 的最终实体包含该原值，省略仍沿原生默认；JSON/SSE/工具历史及原生 CC 保真均通过。
- A4：off / verify 双模式的独立回环实收与采样证据相符，每个作业只发送一次；verify 同时核对实体及整体 HTTP SHA256。
- A5：如后续进行真实验收，单独建立新预算账本，最多四次、每次 max_tokens=128、首错停止；目标仍为用户先前授权的本机池配置（deepseek-flash），配置只读。thinking 上游行为不合格必须单列，不能以 HTTP 200 或采集完整代替语义通过。真实执行前复核授权，不在规划期触发付费调用。

## 不纳入本轮

- temperature、强制 tool_choice 的通用兼容扩展；本机 CLAUDE.md/环境上下文隔离改造；旧池连接偶发异常；跨账号/并发调度。
- 修改 vm2api、升级运行时版本、手工计算 CCH、复用上一轮原生根、改写已保存历史。旧精简产物不因源码变更获得新合同。

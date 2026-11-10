# 断连自动取证：现有证据与设计依据

## 调查边界

- 基线为 `259aea0b7ba46986d04d7e9529c666cb57821dcb`。本轮仅检查源码、规范和已有取证文件，没有启动真实模型请求，也没有读取受保护的池配置。
- 取证针对手工本地池服务；不把原始 `UND_ERR_SOCKET` 视为已经定位。历史调查位于 `.trellis/tasks/11-07-transport-forwarding-repairs/research/findings.md`，其中“尚未持久化诊断”描述当时状态，后续提交已补齐新记录的诊断。

## 可复用的数据

| 来源 | 已核实定义 | 能证明的内容／限制 |
| --- | --- | --- |
| `src/shared/contracts.ts:127` | RequestState、CaptureRecord、RequestRow | 请求终态与各阶段采集状态是不同维度；捕获字段须逐项校验 |
| `src/control/log-schema.ts:27` | requests / captures 表 | 固定表结构已有运行日志，无须迁移 |
| `src/control/log-writer.ts:51` | save | captures.payload.text 固定为 null，正文存于独立文件；只读元数据即可避开正文内容 |
| `src/control/log-store.ts:45` | Database 的 readonly / strict 连接 | 已有只读 SQLite 连接用法；不要构造会启动写线程的 LogStore 来离线采集 |
| `scripts/testing/local-pool-ledger.ts:15` | create / status / reserve / finish | 账本 schemaVersion=1、mode=manual，含 runId、预留和回执；采集端只能读取，不能调用创建、预留或完成方法 |
| `scripts/testing/pool-common.ts:15` | 阶段、错误码及解码器 | 复用固定阶段、POOL_FAILURE_CODES 和 decodePoolTransportDiagnostics，不解析任意异常文本 |
| `scripts/testing/pool-transport.ts:42` | 发送事件及连接关联 | sendHeaders 早于写入；计数是关联模型 POST 连接累计值；不能推断池实收、执行或重试安全 |
| `scripts/local-pool.ts:53` | ready.json | 同目录现有 runId、PID、启动时间及地址；报告只需运行身份，不复制地址或凭据 |

## 完成时序与扫描

- `src/control/service.ts:156` 在 completed 事件中保存请求终态；`scripts/testing/local-pool-engine.ts:138` 在独立 TLS finished 帧中写账本，`:193` 才等待该帧。两者并非同一持久化事务，终态可先于账本最终回执可见。
- `src/control/log-writer.ts:51` 逐项写请求与捕获投影，没有跨表完整快照事务。报告需短暂等待记录收口；不能把单次查询中的缺口当成“未发送”。
- `src/control/log-store.ts:122` 按创建时间倒序，since/until 也按创建时间筛选。只推进创建时间水位会漏掉更早排队、稍后才失败的请求。取证采用有界分页循环扫描候选终态，每个完整循环从头开始。
- 独立只读数据库读取可在 HTTP 和日志写端关闭后继续进行最终扫描，支持历史补采；避免增加健康接口、详情原文下载或转发路径钩子。
- SQLite 元数据不能证明正文文件仍在。只检查合法 body_file 的存在性与尺寸，不读取正文、不重算原始哈希；报告分开显示“记录的采集状态”和“正文存储检查”。
- LogStore.error / failedIds 含内存缺口，不能仅凭数据库断言采集正常。服务内自动取证额外取得 `store.error !== null` 与配置日志模式；离线补采的当前内存采集状态为未知。

## 实际可见标识

- 已有三份脱敏证据：`artifacts/startup-live-recheck-20261107T061612729004Z/live-final-detail-{a4373f81-81ef-491a-ab76-b37e36af255b,10ede424-5277-43c1-82ae-fe94b6a711cd,a1d42439-a628-490f-938d-31913005d842}.json`。本轮只提取头部名称，没有复制值或正文。
- wire_final 中存在 `x-client-request-id`；响应路径中存在 `x-oneapi-request-id`、`x-amz-cf-id`，部分存在 `x-ds-trace-id`。这些是本轮最小标识白名单的依据。
- 标识按 capture.stage、attempt、header 记录来源。同一头重复且值不同才标冲突；不同头的不同标识不视为冲突。
- 现有账本及 TLS 样本没有独立的宿主 HTTP 代理 CONNECT 请求 ID，也没有外部日志关联证明。代理请求 ID 明确未知；不能把响应路径标识猜作具体生成方的内部 ID。
- `src/shared/log-api.ts:25` 的详情解码不完整校验每个头部元组及捕获字段；报告必须重建自己的最小对象，不能透传整个 RequestDetail 或任意附加字段。

## 安全、兼容与选择

- `src/control/trace.ts` 先注册请求、配置与池秘密，再保存脱敏头和正文；`src/control/redaction.ts` 是现有脱敏边界。取证只消费已脱敏记录并进一步收窄字段，不为二次脱敏读取真实 Key。
- 采用服务生命周期内的后台只读采集器及共用的一次性补采命令；不建立新的报告 Web 服务、不访问模型／外部日志、不增加依赖、不改表或 API。
- 缺少旧字段保持 unknown/null。摘要模式没有头值时说明未保存，关闭模式没有记录时说明不能取证；不把这些情况报告为零失败。
- 报告留在原运行目录的独立 incidents 子目录。输出有界、排他发布，重复扫描不覆盖原报告；迟到或已过保留期的证据以采集时状态为准，不自动重写历史快照。

## 相关规范

- `.trellis/spec/backend/logging-guidelines.md`：采集、持久化及只读查询；手工本地池运行；启动与故障隔离。
- `.trellis/spec/backend/runtime-contract.md`：单次发送、取消、头部保留、固定运行时及本地 Base URL 兼容。
- `.trellis/spec/frontend/state-management.md`：仅用于理解现有只读接口的状态语义，本轮不改前端。

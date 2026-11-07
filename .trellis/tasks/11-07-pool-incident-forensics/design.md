# 断连现场自动取证：技术设计

## 目标与边界

为手工本地池服务增加独立的后台证据汇总，并提供相同逻辑的一次性历史补采入口。读取现有脱敏日志元数据和账本，不进入请求响应背压链，不调用 HTTP 推理接口，不修改转发、运行时、日志表结构或既有接口。

已有类型、存储和时序依据见 `research/findings.md`；实现前再次读取其中涉及的真实定义。

## 入口与数据流

1. `startLocalPool` 完成服务及 ready.json 后启动采集器，绑定 options.runId 和本次运行目录。取证启动失败只登记受控诊断，不让已就绪的业务服务失败。
2. 新模块 `scripts/testing/local-pool-incidents.ts` 用独立 `Database(path, { readonly: true, strict: true })` 读取 `data/logs.sqlite`，仅查询 requests/captures 元数据；不构造 LogStore、不读取 bodies 正文。
3. 同目录读取 ready.json 和 ledger.json，严格核对可用 runId；每次账本回执只按完全相等的 requestId 关联，不使用会话、时间接近或列表模糊匹配猜测。
4. 候选是 `error / http_error / stream_error / incomplete`。success 和正常 canceled 不自动生成故障报告。日志模式 off 与全局写入缺口通过取证状态单独标识。
5. 默认每 2 秒推进一批最多 100 条候选；采用 `(created_at,id)` 键分页，完整循环结束后从头扫描，包含旧排队请求的晚终态。单批之间让出事件循环，不做整库同步遍历或无界候选集合。
6. 观察到候选后短暂等待收口，最长 5 秒；在预算内复读其捕获和匹配账本。预算到期仍缺失时产出明确缺口的现场快照，不等待业务或重放请求。
7. 报告发布到 `<run>/incidents/reports/<requestId>.json`，与根目录 status.json 隔离，合法请求 ID `status` 也不会碰撞。一份请求一个不可覆盖的快照，包含 collectedAt；已有报告须通过完整结构及身份校验才跳过。旧平铺报告只读兼容，保留原文件，不把旧 status.json 当请求报告。需要补充后续证据时，补采命令可显式写入新的输出目录。
8. `scripts/collect-pool-incidents.ts` 提供 `--run <ID> --run-dir <目录> [--request-id <ID>] [--output <新目录>]`，只进行一次扫描；不接收 Key、池配置、外部 URL 或真实调用参数。指定请求尚未收口时明确拒绝生成终态报告。

## 运行归属与只读边界

- 运行 ID 沿用 1–64 位、首位字母数字、其余字母数字／下划线／连字符；请求 ID 沿用日志详情的 1–128 位字母数字／下划线／连字符规则。只使用固定子路径，不从源载荷拼任意路径。
- 有效 ready、账本与启动绑定的 runId 必须一致；发生冲突时拒绝跨源拼接。账本缺失、损坏或超过读取上限时保留当前运行日志证据，账本来源标不可用，不从别的轮次补齐。
- CLI 需要至少一份可校验的运行元数据确认显式 --run，且所有可用来源不冲突；身份无法确认则只返回固定错误，不导出带猜测归属的报告。
- 数据库与来源文件只读。请求行、捕获投影及账本值均作为 unknown 解码；原始 SQL 行 ID／状态与载荷不符时标源损坏，不信任类型断言。
- 只读连接使用短查询、短读事务及短忙等待；遇锁／清理竞争记录缺口并留到下一轮，不持续占用写端。关闭采集连接前释放读事务。
- 服务内只读取 `store.error !== null` 和 logMode，取得日志采集是否存在内存缺口；不暴露 error 文本。CLI 无该内存证据时标未知。

## 新报告合同（schemaVersion=1）

所有对象按以下字段显式重建，不展开复制来源对象。

| 字段 | 语义与失败行为 |
| --- | --- |
| schemaVersion / collectedAt / runId / requestId | 固定版本、UTC 采集时间与已校验的身份 |
| request | createdAt、finishedAt、state、httpStatus、日志模式、captureErrorPresent；时间／数值非法为 null 并附固定缺口码，不保存 error 原文或上下文正文 |
| forwarding | sourceState、reservedAt、attempted、localStatus、upstreamStatus、outcome、failureCode；只取唯一匹配账本行，未知字段为 null/unknown；重复预留冲突不任选其一 |
| transport | 复用 decodePoolTransportDiagnostics 的四字段；phase 默认 unknown，其余默认 null；固定注明计数为关联连接累计值、并非池端实收 |
| captures | 五个已知阶段，每项含 attempt、capturedAt、source、representation、recordedStatus、observedBytes、storedBytes、sha256、bodyStorage；缺阶段、非法枚举／计数／哈希明确未知或损坏 |
| correlations | 按阶段、attempt、白名单头名保存合法值和 known/unknown/conflict；缺少代理请求证据单独标 unknown，标识不推定生成方 |
| evidenceGaps | 固定原因码列表，包含缺失、未保存、损坏、源冲突、取证时仍未收口或日志采集缺口；不保存任意 note、message、stderr 或额外字段 |

- `request.httpStatus` 为原日志的调用方观测；`forwarding.localStatus` 与 `forwarding.upstreamStatus` 保持独立。未取得池响应头时 upstreamStatus=null，不能用本地 502 回填。
- failureCode 仅接受现有 POOL_FAILURE_CODES；源缺失或非法时未知，不从 error 字符串猜码。
- capture.source / representation 使用现有固定来源值或 unknown；状态、计数、哈希逐项校验。raw SHA256 只是既有观测摘要，不因不读取正文而声称完成本轮内容复核。
- bodyStorage 只校验固定 bodies 目录内合法普通文件的存在性和尺寸，状态为 present / not_saved / missing / inconsistent / unknown；不追随越界路径或符号链接，不读取文件内容。recordedStatus 与存储检查独立，不能仅凭元数据声称正文仍可读。
- 账本字段缺失表示未知；不存在预留仅表示“未找到预留证据”，不是绝对的“模型没有执行”。

## 标识与脱敏

- 最小白名单：wire_final 的 `x-client-request-id`；upstream_response 的 `x-oneapi-request-id`、`x-ds-trace-id`、`x-amz-cf-id`。来自已有真实脱敏记录中的头名；后续扩展须有证据和测试。
- 逐项校验二元字符串头组，头名忽略大小写；标识最多 256 字符，只允许受限 ASCII 标识字符，拒绝脱敏占位符、换行、控制字符及异常长值。同源同头同值去重，不同值标冲突；不同头各自保留。
- 标识的来源只写采集阶段、attempt 和头名；代理 CONNECT ID 没有采集，固定未知。缺少最终头时不把 cc_prepared 中间头冒充最终头。
- 不复制全部请求对象、context、decisions、完整头、note、异常文本、正文、地址、环境或证书。使用既有已脱敏数据，不读取真实凭据配置。

## 落盘、状态与生命周期

- incidents 目录权限 0700，报告与 status.json 权限 0600；不接受符号链接输出，不修改既有源权限或文件。
- 报告先写受控临时文件，再排他发布；已有文件需校验全部固定字段、嵌套结构、枚举、可空值及 schema/runId/requestId。身份不符、缺字段、非法嵌套值或额外载荷均报告 REPORT_CONFLICT；完整声明 unknown/null 的合法部分证据仍有效。原始日志、账本和历史报告保持原样。
- status.json 仅在自己的输出目录原子更新，记录运行身份、active/degraded/stopped 状态、最近扫描时间／完整循环、当前日志可用性、报告计数与固定故障码。目录本身不可写时仅输出固定故障码到 stderr，不打印原始异常。
- 候选、账本读取、单条元数据和报告均设定上限。初始上限为单条元数据／报告 1 MiB、账本 32 MiB；超限只影响取证，显式标 SOURCE_OVERSIZE，不限制业务正文、发送或调用预算。
- 正常关闭先执行既有 running.close；无论其成功或失败，都 finally 停止定时器、等待当前批、做有界最终扫描并关闭取证连接。最终扫描累计各页故障，末页成功不能清除前页故障。最终收口预算最多 5 秒，未处理部分标 SHUTDOWN_PARTIAL；取证错误不覆盖原业务清理错误。
- 自动取证不改变 LocalPoolRunning.status 的预算合同，不新增 HTTP 字段。入口输出及 README 说明报告目录、状态位置和补采命令。

## 兼容性、取舍与回滚

- 采用直接读取已有元数据而非轮询详情 HTTP：避免下载正文，同时支持 HTTP 停止后的补采与最终扫描。代价是模块需跟随既有日志表合同，使用真实存储夹具回归，不引入自己的表结构版本。
- 不增加服务热路径完成钩子，降低取证故障对转发的影响；短轮询与明确缺口取代“任何强杀都能留下完整报告”的保证。硬终止、日志关闭／丢失或过期仍可能缺证。
- 第一份报告冻结采集时证据，避免后台改写现场。迟到证据可以显式补采到新目录，不能把它当作原采集时已知事实。
- 老账本和摘要模式兼容，缺字段保持未知；日志 off 不被取证绕过，也不自动提高日志等级。
- 回滚时移除手工入口的后台采集接入与新增命令即可；保留所有既有日志、账本及报告。无需数据库回滚或更改真实配置。

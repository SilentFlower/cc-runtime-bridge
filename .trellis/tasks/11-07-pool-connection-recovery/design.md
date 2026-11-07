# 技术设计

## 边界与数据流

- 在池第二段 Node 转发器内部观测，不向隔离原生进程传入池配置或凭据。
- 当前模型 POST 的诊断通过现有 finished 私有帧传回宿主，按 requestId 存入手工运行账本；不扩展普通 HTTP 日志查询或页面流程。
- `LocalPoolLedger.finish` 保留既有 attempted/upstreamStatus/localStatus/outcome，并新增可选 failureCode 与 transportDiagnostics。旧条目缺失新字段保持未知，不回填。

## 新增合同

- `PoolTransportDiagnostics`：`phase` 为 before_send / sending / awaiting_headers / response_body / unknown；`bodySentObserved` 为 boolean 或 null；`connectionBytesWritten`、`connectionBytesRead` 为非负有限整数或 null。
- phase 是当前已观测阶段，不是对端收包或模型执行证明。sendHeaders 发布在实际写入前，只能提升为 sending；bodySent 信号才能提升为 awaiting_headers，收到池响应头才能提升为 response_body。
- 连接计数属于关联连接的累计读写值，不称为该模型请求字节数。没有可靠对应关系时保持 null，不能混入代理 CONNECT 或其他请求。
- finished 帧的诊断可选，集中解码器校验枚举、布尔和计数；不可信或不完整观测降为 unknown/null，不改变模型结果。
- 错误码沿既有白名单，未知异常使用既有通用代码，不持久化异常 message 或调用参数。

## 请求关联和生命周期

- 利用当前内置 Undici 已核验的诊断通道，以异步请求作用域与 request 对象映射关联实际模型 POST；CONNECT 及其他请求不贡献模型阶段。
- 订阅只覆盖当前转发，随本次请求、映射和临时 socket 引用一同释放；不通过重复安装全局 fetch 或重建客户端采集。
- 观测异常只影响诊断可用性；失败的模型请求按既有结果返回，后续独立请求使用原有新连接策略继续执行。

## 传输修复决策

- 根据离线矩阵和未来受控诊断修复具体本地问题；在缺少因果证据前，不升级 Node、切换 HTTP 库、修改代理或增加请求重试。
- 模拟池已收完整 POST 而调用方未收到响应的情况继续返回失败，账本保留 attempted 和阶段；不以“未收响应头”授权重放。
- 如果原始故障仍缺少代理/池侧同时间证据，保留为未定位。诊断改进与原始断连解决分别验收。

# 技术设计

## 1. 现有定义与接入点

- ServerConfig.engine/EngineConfig 为本机控制配置；PreparedInput.input.body 是调用方业务输入。策略配置由新共享模块持有，不混入 MessageBody。
- runNativeJob 唯一回调中，先由现有分支生成或替换业务正文、验证字段并统一 stream，再处理缓存，最后创建 cc_prepared 和调用 Ree。
- generateNativeRequest 的 bootstrap、普通构造验证和必要账号上下文不参与策略。

## 2. 处理与所有权

新增纯策略处理器接收原始调用正文、待发送正文和已校验策略，返回处理后的正文及无正文内容的诊断。输入对象不可变；先评估完整候选及预算，确定可应用后再克隆改写，所有跳过分支保留完整原正文。preserve 不为观察而规范化内容。

| 场景 | sub2api 行为 |
| --- | --- |
| 调用方消息内容块已有 cache_control | 保留待发送布局，不替换调用方锚点，原因 caller_message_breakpoints |
| 调用方或待发送正文存在根 cache_control | 保留根缓存机制及原值，原因 root_cache_control_present |
| system/tools 缓存结构无法明确处理 | 保留正文，原因 unsupported_cache_control |
| system/tools 已占满四个断点 | 保留正文，原因 no_available_slots；不转换候选 string content |
| 无调用方消息标记，普通 API 有 SDK 自动消息标记 | 清除本轮 SDK 自动消息标记，再按候选规则选点；不移除正文块 |
| 无调用方消息标记，原生请求也未标消息断点 | 按候选规则补齐，不加入 CLI 种子内容 |
| 没有可用消息候选 | 保留正文，原因 no_cacheable_blocks |

只识别协议内容块上的缓存字段，工具 input_schema/input 等业务对象中的同名字段不解释为控制指令。可见的嵌套协议缓存块采用保守跳过，不递归改写工具结果正文。

## 3. 选点与 TTL

先计算 system/tools 的既有显式标记及剩余预算。候选按“最后一条消息 → 消息数不少于四条时倒数第二条 user”选取，每个候选取末尾可缓存块，去重并按原顺序写回。尾部无可缓存块时仍可选择另一有效候选，不臆造文本占位。

仅当 string content 实际被选中时，将该条 content 转为单个 text block。消息角色、顺序、内容、扩展字段和 thinking 签名保持；不把图片、thinking 或工具调用块移动到其他位置。

新标记不添加 scope。优先 1h；若任一已有前置 system/tools 标记为 5m 或省略 TTL，则新标记用 5m，避免在较短 TTL 后引入较长 TTL。未知标记类型、TTL、结构或不可明确统计的形态触发整体保留及诊断，不替调用方修复已有无效标记。

## 4. 配置与协议

- readConfig 解析 CCRB_CACHE_POLICY；EngineConfig 增加相应配置，缺省安全回退到 preserve，显式非法值失败。
- worker 环境白名单传递内部配置，独立解析后固定整个物理进程；请求正文与头部无法切换。
- worker_ready 增加可选的已校验策略能力/生效值。旧帧仅允许默认 preserve；显式 sub2api 缺能力或回显不一致时按受控配置错误隔离进程，业务请求不得发送。
- cc_prepared 增加可选、共享类型的 cache_policy 诊断，包括模式、应用/保留/跳过、原因、选中位置、标记数量及新 TTL；不包含 prompt、token 或设备身份。
- src/shared/protocol.ts 负责校验该可选字段，RequestTrace 将其投影到现有 capture.note。中间值标签继续正确，旧事件及旧日志仍可读。
- GET /api/health 增加已配置缓存策略，不宣称上游缓存命中。

## 5. 影响文件与验证

预计修改 src/shared 下的策略类型/处理器、contracts.ts、protocol.ts，src/control/{server,engine,trace}.ts，src/runtime/293/{job,worker}.ts，构建摘要清单、精简接纳表和使用说明。页面没有交互变化，必要时仅回归既有日志说明。

纯策略测试验证所有权及预算；集成测试验证配置、日志兼容和旧 worker 失败；原生测试验证 API/原生两条路径实际接收正文及 CCH。按固定配方重新生成精简产物并完成接纳，不复用旧产物冒充新能力。

## 6. 回滚

设置 preserve 并重建服务；保留旧日志、固定原版和既有精简文件。配置回滚不删除数据，策略不建立跨作业状态。

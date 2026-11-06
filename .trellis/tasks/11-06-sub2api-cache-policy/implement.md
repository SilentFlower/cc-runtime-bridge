# 实施计划

## 前置条件

父任务范围与本子任务 Brief 已展示并经用户确认；先进入 trellis-route 并读取 trellis-before-dev。主会话内联实施，不启动子代理。

## 实施顺序

- [x] 新建共享策略类型和配置校验，连接 readConfig、EngineConfig 与环境白名单。
- [x] 增加 worker 策略能力握手，验证默认兼容和显式选项不能被旧产物忽略。
- [x] 实现无状态纯处理器：所有权判定、根自动缓存跳过、预算、候选、TTL 和诊断。
- [x] 接入 runNativeJob 的单次真实发送边界，保留 bootstrap 和原生 CCH 所有权。
- [x] 加入可选运行时诊断及协议校验，复用 capture.note 和 health 配置投影，更新使用说明。
- [x] 执行单元/集成及原版离线发送验证，形成入站、中间值、真实接收和 CCH 对照。
- [x] 更新构建输入清单，双次构建并核对产物一致性、体积、执行体身份和原生回归，再登记新精简产物。
- [x] 完成 Check-All、Spec 评估及交付流程，交接给遥测子任务。

## 验证

- bun run typecheck、bun run build、bun run test、bun run test:integration。
- bun run test:native；使用 CCRB_TEST_CLAUDE_BINARY 指向新精简产物重复原生套件。
- 专项矩阵覆盖 CA1–CA5；与默认配置对照所有既有场景，核对调用方对象未变、最终模型请求一次、CCH 有效和真实上游请求零。
- 日志说明与 health 的变更按既有 browser 流程验证，保持原预览数据不变。

## 停止与回滚点

预算或缓存所有权不明确时按合同保留并说明，不能为通过测试清除调用方标记。原版发送证明失败时先定位失败，不构建或接纳部分通过的精简产物。现有源程序和旧运行时文件不覆盖；preserve 是行为回退入口。

## 本地交付证据

- 用户已确认父任务及两份子任务 Brief，缓存实现完成；full Check-All strict pass，Spec written。用户已确认两子任务及父任务的精确 Git 计划，业务变更已提交推送；本次独立同步缓存任务记录及 Close。
- 缓存独立阶段类型检查通过；单元 87、集成 17、原版原生 50、精简原生 50、页面 5 项通过。首次并行验证暴露的两个生命周期夹具问题已处理：保留握手后首个故障，missing_idle 给予实际进入作业的启动预算；最终单元套件 87/87。
- artifacts/cache-telemetry-controls-20261106/{cache-original,cache-compact}/requests.json 包含真实回环样本及各五项缓存场景；cache-cch-check.json 使用 libxxhash.so.0 独立核对 132 份最终正文。
- runtime/claude-293-cache-policy 与 -repeat 两次独立构建一致：27375672 B，外层 SHA256 a8a3bc686830c8e8c065eb0dae4e10741ef1b05ab6cfdf7a5f7786ba8fdaa670；执行体 112786616 B，SHA256 c69e297c6e9f320de8cfd29b4b45649c50d3f7be8e8fb4156d7e6e7eabcf0ea4。通过实际 /proc 核验后已登记，旧产物保留。
- 未使用真实账号、未访问真实上游、未改动两个参考仓库或运行中的预览数据。

- 最终集成通过单元 101、集成 17、原版/精简各 52 项原生及页面 5 项；168 份最终 CCH 核验通过。最终产物及完整证据见父任务 research/acceptance.md，遥测子任务已独立交付。

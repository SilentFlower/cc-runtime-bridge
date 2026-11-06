# 实施计划

## 顺序与责任

1. 完成两份子任务三件套和 Brief，连同父任务范围交给用户评审；初次评审通过前不修改产品代码或运行 task.py start。
2. 启动 11-06-sub2api-cache-policy，进入 trellis-route；默认在主会话实施，不派发代理。完成策略及其独立验证。
3. 启动 11-06-native-telemetry-switch，在缓存子任务已交付基线上实施开关及官方遥测生命周期。
4. 两个子任务分别完成 Check-All、Spec 评估与各自交付流程；父任务执行最终集成回归及任务树收口。

## 集成验收

- [x] readConfig、直接 EngineConfig 及 worker 边界使用同一枚举/默认值，非法值明确失败。
- [x] 原版与新精简产物验证 preserve/off、sub2api/off、preserve/on、sub2api/on；每个模型作业仅一个最终模型请求。
- [x] 缓存真实接收正文与中间值差异仅为原生 CCH 处理，调用方原标记及签名保持；策略跳过有明确原因。
- [x] 本地初始化不产生模型请求或遥测；on 的原生事件能通过本机接收器观察，off 无遥测网络上传。
- [x] 遥测失败、取消、关闭和 worker 重建不改变响应字节、模型终态和下一请求归属。
- [x] 旧日志、demo 和实际原生标签正确，wire_final 仍明确未采集。

## 验证命令

- bun run typecheck
- bun run build
- bun run test
- bun run test:integration
- bun run test:native
- CCRB_TEST_CLAUDE_BINARY=<新接纳精简产物绝对路径> bun run test:native
- bun run test:ui（若修改页面或日志展示合同）

原生验证脚本已经由 scripts/test-native.ts 建立无外网命名空间；新增专项探针沿用同等隔离。精简构建使用本机已固定校验的 7-Zip 工具与 SDK，避免构建过程中额外下载。

## 交付与回滚核对

- [x] 新构建输入进入 BRIDGE_SOURCES；最终精简产物经双次构建、回归、实际执行体核验后才更新 compact-profile。
- [x] 27933052 B 磁盘门槛保持；记录启动/暖请求数据，不复活已取消的相对性能门槛。
- [x] 文档说明两个配置、保留/跳过规则、遥测资格限制和重启生效方式。
- [x] 保留基线 pycache、既有预览服务和历史日志；参考仓库保持只读。
- [x] Spec 更新与提交推送按各自 owner 执行，不把 Brief 确认扩展为 Git 提交授权。

## 本地集成证据

research/acceptance.md 汇总当前全部回归、四组合、独立部署、重复构建及真实执行体核验。最终产物 27383864 B，原版与精简各 52 项原生验证、每份 80 份实际模型正文；168 份最终 TLS 正文的 CCH 独立匹配。旧速度诊断保留 false 及退出 1。用户已确认精确 Git 计划，业务变更和两个子任务记录已分别推送，两子任务均 completed + Close。本次独立提交父任务的集成验收与完成记录；full Check-All strict pass、Spec written，复用已完成的当前版本验证证据。

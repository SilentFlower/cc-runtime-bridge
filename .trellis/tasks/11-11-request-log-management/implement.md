# 请求日志管理实施计划

## 开工前

- [x] 读取现有请求页面、Dialog、共享 API 类型、诊断存储、私有采集、设置刷新和账号运行时生命周期定义。
- [x] 确认默认 info、统一保留 7 天及沿用现有容量保护。
- [x] 记录四仓初始状态到私有 `.trellis/.runtime/native-forwarding-log-baseline.json`，保留既有任务和业务改动。
- [x] 完成最终三件套收敛、Brief 完整评审、task.py start 与 trellis-route 实现入口。

## 实施顺序

1. 先定义模式枚举/默认值、可选历史字段、私有信封及捕获状态语义，更新全部读写者与测试构造。
2. 实现 settings 默认、写入前校验、启动及保存后 reload，在请求入口冻结模式并传递到 sender；info 在正文采集克隆/写入前短路，并门控既有 messages 专项日志的完整内容。
3. 调整 DiagnosticsStore 的 7 天策略、真实在途保护与只读可见性，覆盖事务和后台故障恢复。
4. 扩展 bench 私有快照工具的有效期与有界清理，接入独立后台生命周期；保护环境路径、软链接、账号归属及正在写入文件。
5. 更新 API 类型和请求记录页模式设置，将详情迁入 Dialog；分离列表/详情的异步控制，覆盖关闭和请求切换。
6. 使用合成身份与离线上游跑 info/debug、过期回收及弹窗归属验证，完成与预热/会话池的联合回归。
7. 进入 Check-All、规范评价与精确多仓 Git 计划，再沿原发布门禁交付。

## 预计文件范围

- cc2api：`src/model/request_diagnostics.rs`、`src/service/diagnostics.rs`、`gateway.rs`、`native_contract.rs`、`native_runtime.rs`、`native_capture.rs`、`runtime_transport.rs`、`src/store/diagnostics_store.rs`、`settings_store.rs`、`src/handler/router.rs`、`src/main.rs`、`web/src/api.ts`、`web/src/components/RequestDiagnostics.vue` 及关联测试。
- bench：`orchestrator/native_capture.py`、`account_runtime.py`、必要的 `main.py` 接线及关联 Python 测试。
- 本仓：本任务材料及确需补充的离线消费者夹具；相关三仓规范按实际实现同步。
- 与预热和会话池共享的文件以实际差异协调，最终 exact set 由完成后的 diff 确定。

## 验证命令与证据

- cc2api：定向运行模式、诊断、采集、设置及路由测试；随后执行 `cargo fmt --check` 与 `cargo test --locked`。
- 前端：`cd web && npm run build`；使用已有本地浏览器能力验证弹窗加载/关闭/切换、键盘焦点、长内容、分页及筛选。
- bench：运行现有 native_capture 与 account_runtime 对应 Python unittest，新增日期边界、无流量后台回收、重启、软链接、损坏与并发写入的必要回归。
- 本仓消费者有变化时执行 `bun run typecheck` 及对应隔离真实二进制夹具；合成凭据和本地上游记录 info 0 份完整内容、debug 脱敏及单次模型提交。
- 对实际改动执行要求的检查；已通过的检查只在新增改动或未决问题影响其结论时重跑。

## 停止与恢复点

- 本次恢复复用已联合验证的 cc2api 与 bench 业务提交；预热任务和本任务分别关联同一组业务提交，主仓单独提交本任务材料。补登规则见项目运维合同 `operations/auto-loop-recovery.md`。
- 模式字段必须在所有消费者定义完成后接线，旧字段缺失和枚举非法分别按合同处理。
- 遇到归属、路径或文件身份异常时结束该项清理并记录受控原因，继续保护非日志数据。
- 清理线程停止与服务退出同步，租约心跳使用独立资源。采集超时和磁盘错误保持业务单次转发。
- 发布或部署失败按原 SOP 恢复软件及配置，日志回收范围严格限于已确认的过期诊断数据。

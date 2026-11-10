# 实施计划

## 顺序与范围

- [x] 通过本任务完整 Brief 后激活，按 trellis-route/before-dev 进入实现；保护三仓已有变更。
- [x] 先实现并验证原始输入私有能力、格式/版本错误、取消/idle 收口及原版/精简入口一致性；复用现有业务组装与白名单。
- [x] 重建候选二进制并记录来源、分发/执行体身份；原版与候选分别完成离线回归和双次独立构建，成功后登记交付身份。
- [x] 在 cc2api 增加 request_backend 账号字段、双栈迁移、store/DTO/Accounts 界面及空闲切换门禁；默认 legacy。
- [x] 增加原生私有协议解码、账号/凭据代次进程池及固定身份校验；在 Gateway 的协议构造前分流，复用准入、授权/用量与响应许可。
- [x] 接入 V3 sender 能力与原生 Messages 通道；bench 增加二进制镜像输入、私有目录、显式原生内存预算与空闲重建校验。
- [x] 接入用户已确认的共享只读执行映像及60秒空闲回收，保留1个暖进程；复验隔离与满并发，依据实测同步较低预算。
- [x] 完成实际二进制的跨层离线验证、资源实测及旧后端回归，更新操作说明和发布说明。
- [ ] 完成 Check-All、Update-Spec、三仓精确 Push 计划；获准后提交/推送及同步任务记录。
- [ ] 使用已确认版本来源发布下一 beta 二进制附件与 SHA256，下载/校验实际发布附件并验证配置入口。

## 开工前读取

- 当前项目 .trellis/spec/backend/runtime-contract.md、logging-guidelines.md 的相关场景，及 guides 的复用/跨层指南。
- bench .trellis/spec/cc2api/backend/{service-architecture,settings-database,testing-quality}.md；protocol/claude-code-profile-upgrade.md；frontend/frontend-guidelines.md；deploy/deploy-guidelines.md。
- bench .trellis/spec/vibecoding-bench/backend/account-runtime-v3.md 的三角色、归属、凭据刷新和资源相关场景。
- 任何已有函数/类型在调用前读取真实定义；官方 OAuth 最小配置字段以固定源定义和合成回环实测为准。

## 验证矩阵

| 层 | 必要验证 |
| --- | --- |
| 私有协议 | raw_input 能力、有效输入、畸形帧/错归属、格式/上下文/版本错误零发送、唯一终态与 idle、base64 与 UTF-8 |
| 二进制 | 固定源、双次构建一致、实际执行体、脱离源码/官方源/Bun/构建工具独立执行、默认单次发送及旧方式回归 |
| 账号/API/存储 | legacy 默认与历史迁移、非法值、创建/编辑/列表、维护门禁、忙/空闲切换、SQLite/PostgreSQL 合同 |
| 进程池 | 两账号隔离、3 普通/6 Haiku/混合权重并发、排队与超额、降并发、代次变化、取消/迟到帧、进程退出与重建 |
| 真实请求 | API/293 原生、多轮工具/thinking、白名单与合法多值、会话/父子关联、CCH、JSON/SSE、上游错误/断线，每请求一次模型提交 |
| 用量与权限 | 响应额度头、usage、流结束许可、RT 排除、秘密扫描、刷新后新作业、所有权暂停阻止新活动 |
| V3 | network/CLI/sender 分离、UID/挂载/归属代次、私有 HOME、缺能力/预算拒绝、满并发资源峰值、legacy 128 MiB 布局回归 |
| 发布 | 版本/源码提交、附件实际 SHA256、Linux x64 启动与文档配置、明确回退 |

## 命令与证据

- 当前仓库：bun run typecheck；bun test tests/unit；bun test tests/integration --timeout 45000；固定源和候选分别运行 test:native/test:tls；补充与实际新入口对应的离线独立部署及协议测试。
- cc2api：cargo fmt --package claude-code-gateway --check；cargo test --locked；前端 npm run build。新增受控实际二进制回环测试在独立网络空间运行，普通测试使用合成 worker/本地上游。
- bench：相关 Python unittest/语法检查；按实际变更选择 V3 本地隔离验证器，并补充两账号/加权并发/配置切换/凭据变化场景。PostgreSQL 迁移采用本地测试实例或现有无副作用测试入口。
- 全部使用合成凭据、独立 HOME/配置与本地上游。真实生产、远程部署和付费推理留在任务范围之外。
- 验证证据集中在任务 research 与 gitignored artifacts；源码或配置未变且覆盖范围一致时复用有效结果。

## 风险与恢复点

- 新方式构造边界位于旧 Rust 重写之前；保护原始逻辑输入和 HeaderMap 同名值，避免二次封口和重复模型提交。
- 新进程池不能按标准 concurrency 简单截断 Haiku 实际活动数；默认 3 标准并发至少覆盖 6 个半槽请求。
- 旧 sender 128 MiB 不承载新池。发布前实测并明确有限预算，原生资源配置缺失时拒绝准备。
- 原生方式固定 293 及既有字段能力；新版本兼容和不支持配置的产品范围发生变化时先同步规划。
- 不覆盖既有二进制、日志、凭据或其他任务；候选使用新路径，失败保留真实记录。
- Git 和发布基于最终通过验证的精确范围；子模块先推送后固定父仓 gitlink。

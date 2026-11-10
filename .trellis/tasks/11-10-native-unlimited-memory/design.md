# 按账号无限内存设计

## 边界与表示

- 产品改动集中在 bench 与 cc2api 子仓，本仓保存任务材料及离线消费者夹具。
- 新增账号值 `fingerprint_json.mem="unlimited"`；全局默认保持有限。生产限定 bench 14 / gateway 12、并发 2。
- 原 swap 配置保留为恢复有限模式的历史值。无限模式取消 RAM 和合计 RAM/swap 限额，使用宿主可用资源。

## 统一合同

- `memory_bytes` 保持有限值解析。`account_limits(memory,swap)` 接受 `memory="unlimited"`，返回 Docker 语义 `(0,-1)`；无效 swap 仍拒绝。
- `isolated_account_limits` 在无限模式返回三个角色的 `(0,-1)`。有限模式保留原预算和 CLI 最低值校验。
- `scenario_account_limits`、`serial_review_limits` 同步支持无限模式，CPU/PID 仍用原设置。
- `sender_config` 对无限账号生成 `memory_mib=0`、`max_workers=2*concurrency`，省略 sender 预算也能准备；有限账号沿用原检查。
- 保存 `native_sender_memory="unlimited"`，避免生成 `0m`。
- Rust `NativeSenderConfig.memory_mib=0` 表示无 RAM 上限，字段仍必填。正数沿用原容量公式；`max_workers` 始终为正数。
- 路径、摘要、版本、协议、身份、目标、凭据和请求校验保持。旧消费者拒绝新无限配置，使用同批联合镜像保证兼容。

## 指标与评审

- 明确无限制的账号/CLI 内存以 0 表示。既有进程采集已将 cgroup `max` 转为 0，既有界面已显示“未限制”。
- 物理特征配置侧使用统一资源合同，避免直接使用有限解析器。
- 评审交接明确接受 RAM=0、MemorySwap=-1，CPU/PID 继续校验有效有限值；拒绝其他负数和不一致 HostConfig。
- 已保存的有限评审布局在空闲时重建，保持交接记录与新模式一致。

## 迁移与部署

1. 验证有限/无限配置、实际 cgroup、真实二进制和合成 TLS 消费链。
2. 经 Git 门禁提交消费者、父仓 gitlink 和任务材料，走既有 v3 联合 CI。
3. 生产核对 API、CLI、控制任务、待确认动作和租约，冻结保护集；兼容重建保持其他账号策略和持久目录。
4. 事务比较更新“11-5”的 `mem` 为 `unlimited`，受控重建角色。
5. 检查原生能力、实际 cgroup、身份/会话/成果、其他账号策略、管理鉴权及两库。
6. 生产通过准备及能力接口验证，真实业务结果由用户后续请求观察。

## 风险与恢复

- 无限账号可竞争宿主全部 RAM/swap，宿主 OOM 可能影响其他服务；用户已选择此模式。
- 小正文合成测试验证流程与隔离，长上下文峰值另行观察。
- 变更前记录非秘密资源元数据和身份摘要，沿用免生产数据备份约定。
- 未确认操作保留回执、租约和代次，先对账后继续。
- 回退旧镜像前先恢复兼容资源配置，具体恢复按实际失败范围和适用授权执行。

## CC 组装后采集

- 复用现有 `cc_prepared` 事件。保留有序头名称和值及正文，明确阶段为 CC 组装后。
- 账号固化采集开关，默认关闭。凭据值和敏感头脱敏后写入账号私有持久目录。
- 单份正文最多 2 MiB，单账号最多 50 份、总量最多 100 MiB。摘要与原始长度独立保存，截断和写入失败可见。
- `fingerprint_json.native_capture_enabled=true` 经 sender 的可选 `native_capture_dir` 开启采集，默认关闭。
- 私有文件为 `/flows/api/cc-prepared/<attempt_id>.json`，目录 0700、文件 0600；正文 2 MiB、头 128 KiB，按最旧顺序轮转。
- 管理端 `GET /admin/request-diagnostics/:request_id/captures/:attempt_id` 先核对尝试属于当前请求，再经服务鉴权读取调度器 `/internal/v3/native-captures/{account_id}/{attempt_id}`。读取保持只读，响应禁止缓存。
- `capture_status` 区分 disabled/saved/dropped/failed/timeout；保存最多等待 250 ms，超时写入仍受有界许可控制。
- 先注册有序头数组中的 Authorization、Cookie、API Key 及 Bearer 内容，再统一脱敏正文及头值。原始转发对象保持，正文只替换秘密并保留其顺序与空白。
- 采集错误影响采集状态；请求按原模型生命周期收口。界面用普通文本展示内容。

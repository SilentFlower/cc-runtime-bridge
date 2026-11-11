# 平台在线更新：代码证据与候选方案

日期：2026-11-11。状态：规划研究。用户已确认第一版采用维护窗口切换。

## 当前机制与约束

| 证据 | 当前行为 | 对改造的影响 |
| --- | --- | --- |
| `/root/project/vibecoding-bench/.github/workflows/v3-build.yml:1` | v3 push 自动联合构建 control/account，发布 GHCR 镜像及保留 14 天的 Actions 制品 | 复用构建能力，补充持久可获取的受信发行目录与版本通道；CI 成功和批准发布分别表达 |
| `/root/project/vibecoding-bench/deploy/v3/manage.py:73`、`:608`、`:683`、`:701` | 清单与镜像角色、批次、摘要、平台核对；发布后按 registry digest 获取镜像 | 延续精确身份核验，新增发行目录和清单的信任验证，明确不同 digest 语义 |
| `/root/project/vibecoding-bench/deploy/v3/manage.py:109` | 数据库存在凭据归属记录时拒绝回退到旧所有权协议 | 回退规划必须声明已有持久数据的读写兼容条件 |
| `/root/project/vibecoding-bench/deploy/v3/compose.yml:1` | 同一 control 镜像提供 gateway/orchestrator，账号环境独立；orchestrator 挂载 Docker socket | 更新执行服务应有独立生命周期，平台进程切换后持续执行与记录恢复信息 |
| `/root/project/vibecoding-bench/orchestrator/account_isolation.py:24`、`:36`、`:135` | 角色标签和 sender binding 使用 runtime.release_id | 需要拆开发布来源与协议兼容；环境归属、代次与绑定秘密仍逐项验证 |
| `/root/project/vibecoding-bench/orchestrator/account_runtime.py:620`、`:833` | 镜像批次与当前 release 严格一致，发送器绑定再次核对 release | 控制服务更新复用旧环境需要修改完整校验链；直接放宽 release 比较会破坏现有约束 |
| `/root/project/vibecoding-bench/cc2api/src/store/db.rs:458`、`:522`、`:564`、`:665` | 启动迁移会按存储画像同步账号软件字段 | 镜像回退与数据回退需分别声明；账号字段变更采用显式迁移边界与逐项验收 |
| `/root/project/vibecoding-bench/.trellis/spec/vibecoding-bench/backend/account-runtime-v3.md:1316` | 内核更新已有签名清单、冻结 revision、幂等操作、排空、持久状态与中断恢复 | 复用契约与成熟机制，平台更新另设部署级操作范围 |
| 同一规格 `:242`、`:1141` | US 保留既有资源、免备份；部署完成后必须定向回收，保留当前及最近两个完整历史批次和引用 | 自动更新应继承部署偏好，健康验收成功后才进入清理 |

## 候选总体结构

发布端 CI → 受信发行目录及版本清单 → 独立更新执行服务 → 平台控制服务／账号运行环境。

现有内核更新由账号侧原机制执行，系统更新页统一展示并提供入口。

- 发行清单描述完整可安装组合、镜像摘要、兼容范围、迁移条件和回退边界。完整组合中允许复用兼容的历史账号镜像，该混合组合必须有明确声明及验证依据。
- 更新服务持有部署级独占操作锁，限定目标部署和动作，持久化阶段、原版本、候选版本、执行结果及恢复信息。接口需要管理员鉴权和独立内部证明，任意 shell 指令不进入协议。
- 平台版本与账号环境版本分别登记，来源摘要保留。兼容检查替代“必须整批相同”的单一判断；部署、账号、环境、代次、协议与凭据所有权仍完整核对。
- 下载与准备期间现行服务继续工作。用户已确认切换时暂停新接单、等待在途自然结束，随后执行短暂维护切换。
- 候选健康失败时，仅在旧版可读取当前数据且满足回退条件时执行回退。发生不可逆或未知状态时进入明确的恢复流程，界面展示阻断原因。
- 更新服务自身通过独立运维路径管理。平台首轮底座迁移需要一次部署，后续平台更新由该底座承接。

## 候选交付顺序

1. **发行与兼容合同**：确定版本、制品、信任、数据迁移和回退语义，补齐持久发行入口与发布流程。
2. **账号环境兼容解耦**：贯通角色识别、sender binding、环境复用与重建；区分兼容复用与需要空闲升级的环境。
3. **独立更新执行服务**：完成准备、排空、切换、验收、回退和重启恢复，限定部署级权限及并发行为。
4. **统一系统更新页面**：展示三类组件版本、变更、兼容状态、操作进度、历史和恢复入口，适配现有后台风格。
5. **验证与首轮接入**：离线模拟制品、真实隔离容器、启动迁移与故障注入；形成一次性底座接入操作单及后续点击更新操作单。

本轮按单一完整交付维护任务。以上为内部实施步骤；新发行合同、门禁、执行服务与页面共享同一更新操作协议，需要联合验收后交付。已读取任务树规则，本轮保持单任务组织。

## 必须覆盖的故障场景

- 非受信清单、摘要漂移、架构不符、发行目录获取失败、部分镜像缺失。
- 连续点击、迟到请求、并发升级、内核切换与平台更新冲突。
- API 长流、CLI/Pi 活动、未知执行意图、排空超时。
- 下载中断、平台退出、更新服务退出、宿主重启、切换后健康失败。
- 旧账号环境与新控制服务兼容／不兼容、账号环境部分升级与明确收口。
- 数据库前向兼容、可逆迁移、不可逆迁移、凭据所有权协议降级拒绝。
- 更新后清理保留集、容器引用变化、清理失败后仍可恢复。

## 已确认维护策略与研究补充

用户回复“接受”，确认第一版暂停新接单、等待在途完成、短暂维护切换。

- `/root/project/vibecoding-bench/orchestrator/main.py:12600` 的既有 quiesce 会检查账号维护证明、环境任务和 sender 活动，成功后停止环境。该动作适用于需要收口实例的情况。兼容账号环境的复用需要独立的排空证明和平台级接单门禁。
- `/root/project/vibecoding-bench/orchestrator/native_kernel_upgrade.py:393` 附近已有持久排空阶段、维护归属检查、续租、120 秒有界等待和失败释放机制。平台级排空还需要覆盖 CLI/Pi、任务调度和执行意图，等待时限另行设计。
- `/root/project/vibecoding-bench/cc2api/src/service/runtime_bridge.rs:38` 表明现有内部收口操作经服务证明调用。平台更新需要将接单暂停和恢复接单的归属证明纳入持久协议。

候选故障行为：排空超时保留旧版本，按本次操作归属释放可安全释放的门禁；状态不明确时进入恢复流程。更新服务独立保存进度，页面在平台切换后重连并继续显示。

## 已确认触发策略与规划结论

用户回复“可以”，确认自动检查版本、管理员点击安装。排空与切换作为管理员发起的同一次操作执行；自动检查只更新提示。

通过 `gh repo view SilentFlower/vibecoding-bench --json nameWithOwner,visibility,url` 实际读取仓库可见性为 PUBLIC。平台清单和签名拟发布于该仓库的精确 GitHub Release 附件。GHCR 包的匿名可读性需要首次接入预检；镜像包作为同一受信发行的获取后备路径。

第一版将不可逆迁移在自动更新预检阶段阻断，US 保持既有免备份选择。完整合同、实现边界及校验计划转入 `design.md` 和 `implement.md`。

## 官方机制核对

- [GitHub Release 管理](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)：开启不可变发行后应先创建草稿、附齐制品再发布。设计采用精确发行附件，并将可前进的版本目录放入专用 Git 分支。
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content)：支持按 commit/branch/tag 的 ref 读取，公开资源支持匿名获取。设计先解析通道 commit，再固定相同 ref 读取目录及签名。
- [systemd 服务说明](https://www.freedesktop.org/software/systemd/man/255/systemd.service.html)：故障重启受 Restart 与启动速率限制共同控制。首次接入模板需配置合理退避，并以持久状态驱动恢复。

# 实施进度与恢复索引

## 当前结论

- 正式 Check-All 的 3 项 CHK 与 1 项 FBK 已全部修复并重检，结论严格通过。最终证据位于本文“授权修复与重检完成”；较早条目保留实施历史。
- Update-Spec 结果为 written：bench 部署规范新增 `platform-online-update.md`，部署索引增加入口。六节合同、源代码字段/状态机反查、相对链接和 `git diff --check -- .trellis/spec` 均通过。
- 用户已确认精确 Push 计划，cc2api 与 bench（含子模块指针）已依序推送成功。任务进度 helper 已写入 completed，Close 返回 closed；本仓按确认范围提交同步任务记录。生产首次接入及现场发行验证由后续上线指令承接。

## 授权与现场

- 本任务已通过有效后台确认领取：request `4c8010d1-1803-4288-846a-7be735862854`，receipt `b5ad24b6-af12-4348-8f16-e8b5bef495d3`，action=implement。started 与 completed 回执均已成功记录，completed 对应任务激活及进入 inline 路由。
- 任务已 in_progress；`trellis-route` 返回 implement=inline。当前会话继续本地实现与隔离验证。
- 生产部署保持暂停。首次底座生产接入、密钥配置和部署操作由后续明确指令承接。
- 业务仓起点 bench HEAD `5b2d167028a8647f1c6f4e7dd37c6ef36262ee48`、cc2api HEAD `90224de9f1218dc41c3c27cdb9f76efadbc2cc19`。bench 原有 `doc/claude-code-2.1.303-protocol-study.md` 修改及历史未跟踪任务目录属于其他工作。

## 已落地代码

- `orchestrator/system_update_contract.py`：严格 DTO、真实 Ed25519 验签、目录新鲜度、双库兼容、冻结请求、有界下载和安全文件读取。
- `deploy/v3/system_release.py`、`publish_system_release.py`、`system-update-policy.json`：迁移源码合同、组件内容身份、精确 Release、独立签名和 Git commit 原子目录；CI 改造已写入。
- `account_update_identity.py`、`account_isolation.py`、`account_runtime.py`：平台与账号镜像来源分离、私有实际镜像来源证明，原归属校验延续。
- `system_update_gate.py`、`system_updates.py`、`main.py`、Rust `service/system_update.rs` 及管理桥：持久门禁、完整流计数、实际在途证明、私有 Unix socket、公开管理路径。
- `system_updater.py`、`system_update_host.py`：独立状态机、双端排空、精确控制服务切换、环境按需重建、恢复、配置 CAS、软件字段 CAS、数据结构及身份摘要、定向回收。
- `install_system_updater.py`、`compose-updates.yml`：默认预览的首次接入 prepare/finalize、固定源码包、私有策略、候选配置及 systemd 模板。
- Vue `SystemUpdates.vue`、api/router/Dashboard：实际系统更新页面、确认、进度、回退、重连及移动端样式。

## 已取得证据（随后代码变化需相应重验）

- `.venv/bin/python -m unittest discover -s deploy/v3 -p 'test_system*.py'`：最近一次 15 项 passed，日志 `/tmp/v3-platform-system-all-tests.log`。
- `.venv/bin/python -m unittest discover -s orchestrator -p 'test_account_runtime.py'`：92 项 passed，日志 `/tmp/v3-platform-update-account-regression.log`。新增活动保留机制后需重验。
- `test_system_update_gate.py`：2 项真实文件／线程 passed。后续需补充跨请求作业登记与撤销场景。
- `cargo test` 已有一轮全量通过，日志 `/tmp/v3-platform-update-cargo-all.log`。该轮之后管理续接代码有变化，最终需重新验证。
- Vue 构建通过，日志 `/tmp/v3-platform-update-web-build.log`。目录过期提示代码变化后需重新构建。
- `python3 deploy/v3/verify_system_update_browser.py --output .deploy/platform-online-update/browser`：5 组交互场景 passed、0 脚本异常、4 次合成业务写入、0 实际模型请求。证据位于 bench `.deploy/platform-online-update/browser/`。移动端截图已实际查看。

## 待完成重点

1. 完成原控制请求／交互式登录的有限续接集成，确保维护门禁既拒绝新工作，又允许原工作完成。新增的 ContextVar、作业 reserve/release 和私有 admitted-control 接口需要定向测试。
2. 增加 HostDeployment 的实际 Docker 验证及故障注入。当前本机 Docker 29.1.2 可用，磁盘余量约 470 GiB。
3. 可用本地测试底座：control `vibebench-v3-control:v3-verify-kernel-online-final`（OCI index `sha256:5767b3e68e8d7eb9595ea3665854ee74df074d47bdf7a38e39fc4205a9664086`），account `vibebench-v3-account:v3-verify-kernel-online-final`。隔离验证必须用随机部署、独立数据根和合成凭据，禁止混入生产。
4. 完成首次接入／日常更新／异常恢复说明，补齐目录过期、原登录收口和组件真实来源回归。
5. 最终 Rust fmt/type/build、全量 Rust 与相关 Python 回归、浏览器验证、隔离容器验证，随后按 Phase 2.1 completion 进入正式 Check-All，再执行 Spec 和精确 Git 计划。

## 工具环境

- bench `.venv/bin/python` 有 FastAPI/docker 等应用依赖。系统 `python3` 有 Playwright。两者按验证入口选择。
- 构建和测试大日志写入 `/tmp/v3-platform-*.log`；不将私有凭据写入输出。
- 所有实现 inline；当前授权及路由没有要求启动子代理。


## 第二轮实现与验证补充

- 已将 Python 维护准入迁移到真实 ASGI 生命周期，覆盖流式正文与断连 finally。原登录通过登记中的有限活动续接，迟到确认拒绝。
- 已补齐账号真实来源展示、环境分布与预计重建数量。状态页和排空读取采用非阻塞环境锁，维护中的环境显示待核验。
- 已补齐账号重建前持久意图、原／候选实际镜像 ID 集合与私有部分恢复路径。恢复继续核对 CLI、发送器、租约、执行登记和其他环境阻塞。
- 宿主身份摘要加入账号与环境绑定、设备 UUID、组织 UUID 和双端凭据所有权记录。软件字段 CAS 与结构证据保持独立。
- 新增 SYSTEM-UPDATES.md，覆盖 CI 独立密钥、首次 prepare/finalize、systemd、日常安装回退及 reconcile。
- 最新离线系统测试：22 项通过，日志 /tmp/v3-platform-system-all-tests.log。新增维护／ASGI／恢复测试 8 项通过，日志 /tmp/v3-platform-update-admission-tests.log。
- 旧部署入口 test_manage.py 33 项通过；内核与鉴权回归 13 项通过；账号原回归与门禁合计 95 项通过。
- Rust 库全量 767 通过、4 ignored；新增完整 Body 释放测试后 system_update 定向 2 项通过。宿主 release 构建及 fmt 检查通过。
- 浏览器最新页面 5 组场景通过，0 脚本错误、0 真实模型请求；证据 .deploy/platform-online-update/browser。
- 已定位并纠正本地 Docker 夹具的两个环境问题：大型项目库扫描改为测试专属空库；宿主 glibc 2.39 产物改为项目同款 Bookworm 容器编译。构建日志 /tmp/v3-platform-update-bookworm-build.log，输出 bench .deploy/platform-online-update/bookworm-binaries。
- 当前正在执行真实容器联合验证（第五轮）：进程 session_id=47397，日志 /tmp/v3-platform-update-docker-5.log。调用命令为 bench .venv/bin/python deploy/v3/verify_system_update.py --output .deploy/platform-online-update/docker --gateway-binary .deploy/platform-online-update/bookworm-binaries/claude-code-gateway --sender-binary .deploy/platform-online-update/bookworm-binaries/account-sender。
- 当前脚本覆盖真实首次接入、合成账号三角色、本地 TLS 长 API 原流、未知 CLI 进程取消、控制复用、账号重建、停止状态保留、回退、健康故障、部分角色故障与独立进程中断恢复。最终结论以本轮真实输出为准。
- 正式 Check-All 尚待本地联合验证收敛后，通过 Phase 2.1 completion 进入。当前所有改动仍属于已授权 inline 实施。


## 已完成真实容器联合验证

- 第五轮实际命令退出 0，报告 bench `.deploy/platform-online-update/docker/results.json`：9 组 passed、real_model_calls=0。
- 实测包含真实 TLS 长响应完整收口、原三角色 ID 和代次复用、账号组件真实重建、停止环境保留、显式回退、候选验收故障恢复、部分 CLI 角色缺失恢复，以及切换后独立进程退出 92 再重启恢复。
- Docker 默认网络池已实际返回 `all predefined address pools have been fully subnetted`。隔离夹具改用与现有 Docker 网络及宿主路由均不重叠的显式测试网段。生产模板保持原网络合同。
- 第七轮正在增加真实容器引用保护、最近两个组合保留和精确旧镜像回收，session_id=60276，日志 /tmp/v3-platform-update-docker-7.log，证据目录 bench .deploy/platform-online-update/docker-final。
- 系统离线测试新增合法长中文历史的重启读取，最新 23 项通过。原业务调度／Pi／养号／登录／评审相关回归 149 项通过。
- 最终 `cargo test` 已完整通过，实际 suite 汇总见 /tmp/v3-platform-update-cargo-final.log；fmt 和 Bookworm 构建日志继续有效。


## 实施阶段完成与 Pre-Check

- 实际 Docker 回收探针确认：删除最后一个 tag 会同步移除 RepoDigest；重复删 digest 导致误报失败。现已只删除经证明的唯一 tag。
- 独立实际保留／回收验证退出 0：bench `.deploy/platform-online-update/retention/results.json`。验证了当前及最近两个完整组合、全部容器引用，以及容器移除后的精确 tag 回收。
- 最新系统离线测试 25 项通过；维护／ASGI／部分恢复 8 项；旧部署 33 项；内核与鉴权 13 项；账号 92 项；调度／Pi／养号／登录／评审 149 项。最终 Rust 共 853 passed、8 ignored。Vue build 与浏览器 5 组通过。
- 第八轮完整容器脚本继续复验最终回收修复，session_id=42008，日志 /tmp/v3-platform-update-docker-8.log，输出 .deploy/platform-online-update/docker-final。
- Pre-Check 当前 no-hold；已完成实施定向验证，进入正式 Check-All。生产部署继续等待后续明确指令。


## Check-All 授权修复

- request 218e7ad2-49a1-4596-a418-d733b8cae2fc 已有效 claimed=true，action=repair_all_and_recheck，receipt a7be1f5c-ac7e-4af3-9db9-f33c7d670ba1。started 已记录。范围 CHK-001、CHK-002、CHK-003、FBK-001。
- 已将批次活动限定到单项投放事务，原项目续接保留其他门禁，三处 Rust 改为显式导入。首次 finalize 核对原安装及共享服务锁后幂等收口。
- 新增实际 Scheduler/SQLite/线程 3 项通过；首次接入重试和归属测试 6 项通过。相关回归与 Check-All 重检进行中。


## 授权修复与重检完成

- CHK-001、CHK-002、CHK-003、FBK-001 已全部修复。Check-All 重检严格通过，剩余 CHK/FBK 为零。
- 本轮实际证据：/tmp/v3-platform-repair-scheduling.log 5 项；/tmp/v3-platform-repair-system-all.log 29 项（含首次接入 6 项）；/tmp/v3-platform-repair-related.log 95 项；/tmp/v3-platform-repair-cargo-final.log 全量 853 passed、8 ignored；fmt、Python 语法及双仓 diff 检查通过。
- 原真实容器最终联合验证仍为10组通过、0真实模型调用，报告 bench .deploy/platform-online-update/docker-final/results.json。浏览器5组与独立真实回收证据保留。修复涉及的调度及首次接入边界已用真实 SQLite/线程/文件和故障注入补充验证。
- 修复回执 a7be1f5c-ac7e-4af3-9db9-f33c7d670ba1 已 completed。下一步按 completion chain 进入 Spec 与精确 Push 计划。生产部署继续暂停。

# 实施恢复记录

## 当前授权

- 原请求 bd0ea6b0-6d26-4738-8e0d-128dc74fa390 已 claimed=true/action=implement/source=policy_timeout；回执 6d297f44-4fdf-4196-9c27-42196a74dadf 的 started/completed 是 Brief 激活与路由交接事实。当前任务仍为 in_progress。
- implement 路由恢复为 inline/builtin-default。无子代理。生产接入按独立上线授权执行。
- 三仓初始基线保存在 .trellis/.runtime/system-update-migrations-baseline.json。其它任务及父仓协议研究改动归原所有者。

## 实施状态

- bench/Rust 初始迁移定义已抽成纯模块，提供固定维护入口及版本台账。bench 的工程命名空间和 Rust 的 49 项默认定义、10 个历史画像一同冻结，避免后来业务默认值改变旧迁移。原导入入口保留兼容。
- 受信 v2 绑定迁移计划和来源演练证据，使用独立 updates/v3-migrations 通道。首发继承旧发行引用。旧通道仅刷新时间并保留原发行序号。
- 快照覆盖双 SQLite/WAL，限制私有文件和空间，保留最近两组及恢复引用。恢复支持两库部分替换、暂存复制中断续接；恢复完成边界先于原程序启动；release_started 后保护后来数据。
- 宿主停止服务并按 inode 检查跨容器数据库持有者，离线维护进程使用精确镜像及固定单库挂载，恢复前清理同操作进程。元数据读取显式关闭连接。
- 一次性底座升级默认预览，精确来源、服务、锁及状态复核，实际 Unix socket 能力验收，失败恢复原源码及策略。
- 页面加入迁移计划、阶段、快照大小和具体兼容缺口，未知迁移状态保留展示。CI 加入所有权检查、登记测试、真实旧镜像演练和签名发布前置证据。

## 首轮验证记录（历史）

- 源码所有权及登记摘要检查通过。定向冻结测试12项通过；受信来源规则5项通过。
- 控制层65项通过：/tmp/system-update-migrations-control-final.log。随后句柄关闭等宿主修正有独立定向回归。
- 业务196项通过：/tmp/system-update-migrations-python-final.log。命名空间冻结后的同套回归已在 /tmp/system-update-migrations-business-frozen.log 实际 exit=0。
- 管理接口13项通过：/tmp/system-update-migrations-management-python.log。
- 新 Rust 台账3项通过。全量最后一轮在 /tmp/system-update-migrations-rust-final-pass.log，已实际 exit=0；共857项通过、8项依赖专用数据库或原生 TLS 夹具的场景按原标记跳过。旧历史测试的准备入口改为 legacy，以保留历史迁移断言；版本化重复执行另有保持管理员选择的断言。
- web build 通过：/tmp/system-update-migrations-web-final.log。首次真实浏览器5组场景通过，新增未知状态后的复验在 /tmp/system-update-migrations-browser-final.log。
- 候选已实际构建完成（exit=0）：db-migrations-packaged-20261112，清单 .deploy/system-update-migrations/packaged-manifest.json，日志 /tmp/system-update-migrations-image-packaged.log，会话83507。所有本地 dirty 候选仅供验证。
- 早期 Docker 演练在镜像身份核验处失败，已修正为复用项目 OCI/config 身份判断。尚待最新候选重新跑完整链，旧失败结果不算验收通过。第二次演练发现 Dockerfile 漏复制 Python 登记 JSON，已补 COPY 并以 packaged 批次重建。

## 首轮实施后待办（历史）

1. 取上述进程实际退出码，完成最新候选构建。
2. 运行 verify_system_update.py --migration-manifest .deploy/system-update-migrations/packaged-manifest.json，使用已有 bookworm 夹具二进制，输出到 .deploy/system-update-migrations/docker-final。覆盖签名旧来源、真实候选/旧程序读写、底座接入、安装、半库掉电、恢复后启动掉电、健康失败、账号重建、显式回退和新数据保持。
3. 汇总机器证据和实际来源差异，更新验收勾选及上线操作说明。
4. 按 Phase2.1 Pre-Check → route(check) → full Check-All（审查期间只读）→ Update-Spec → 精确三仓 Push 计划确认推进。Git 写入需独立精确授权。

## 后续定向修正

- 同合同安装仅比较两库 contract，历史许可列表轮换不会误拦普通业务发行；7项迁移集成及9项快照测试通过。
- 快照完成后仍复核私有目录权限；数据句柄在 Host metadata/health 中明确关闭，跨命名空间 FD 用 inode 判定。
- 来源通道仅 ref 404 允许转旧通道，资产缺失直接失败。CI 已加入对应测试。
- 当前最终控制回归68项通过（/tmp/system-update-migrations-control-complete.log）；随后同合同/私有目录新增测试按各自日志定向覆盖。
- 最新 web build、5组真实浏览器交互和196项冻结后业务回归均通过。
- 三仓 HEAD 与基线一致，全部原有无关 dirty 文件逐字节保持（实际SHA核对结果为空）。

- packaged 真镜像的三个兼容演练证据已实际生成，旧库→候选→原程序及快照恢复通过。完整生命周期第一次在接入后空新通道的测试目录处停止，已修正夹具在接入后装入本次签名新目录，并增加复制源码独立解释器导入验证。当前会话另跑 docker-verified；日志 /tmp/system-update-migrations-docker-verified.log。

## 交付审查事实回读

- 最新系统控制回归72项通过，日志 /tmp/system-update-migrations-control-lifecycle.log，实际 exit=0。
- 最终真实容器验收14场景通过，实际 exit=0，日志 /tmp/system-update-migrations-docker-acceptance.log，报告 /root/project/vibecoding-bench/.deploy/system-update-migrations/docker-acceptance/results.json。该轮实际验证台账 [1,0] 后恢复同一组旧数据，并执行最近两组快照的精确断言。三份实际镜像兼容证据保存在同目录 compatibility-{1,2,3}.json。
- 当前候选为本地 dirty 验证镜像，provenance.json 标记 verification_only。生产 CI 与宿主接入沿原上线授权边界。
- 审查复现：bench 缺 enabled/upstream_socks5_host/upstream_socks5_port 时，apply 仍返回 ready/version1。gateway 删除必要 token 列并清空台账后，实际候选维护入口仍返回 ready/version1。
- 审查复现：env -u PYTHONPATH 运行 verify_database_compatibility.py --help 和 test_system_database 单独 discover 都因 runtime_files 缺失退出1。工作流的这两个步骤采用相同默认环境。
- 审查复现：底座替换 system_updater.py 后子进程 os._exit(93)，service_active=false，journal=replacing，源码已变更；重跑 apply 返回“底座升级前服务需要处于可核验运行状态”。
- 当前审查结论存在3项待处置缺口。任务保持 in_progress。

- 当前报告编号：CHK-001（默认 CI 入口导入失败）、FBK-001（缺少必要字段仍登记成功）、FBK-002（底座替换中断后缺少恢复入口），均为 P1/pending。DOC-001 为本执行记录的实际状态回读，已按日志与命令结果更新。

## Check-All 修复批次 1 进展

- 当前确认 87bc43bc-921c-47d7-89ec-bd644a9c3ddb 已成功领取，action=repair_all_and_recheck，回执 7ddfbf9f-0d70-4a05-8aa4-3a50c3315300 已 started。范围为原 CHK-001、FBK-001、FBK-002。
- CHK-001：演练入口按 manage 自举顺序导入；快照模块独立配置项目路径，独立 discover 测试先导入所属入口。默认无 PYTHONPATH 的控制测试67项及入口帮助实际 exit=0。
- FBK-001：两库按冻结基线核验最低表、字段、SQLite 亲和及主键；旧库先检查稳定核心，迁移后及已登记库核验完整最低结构，兼容新增字段。Python/Rust 缺列、异常主键、台账损坏及重复迁移定向验证通过。main 两个历史夹具调整为真实核心结构并保留原缺列迁移断言。迁移定义及登记摘要保持稳定。
- FBK-002：增加独立接入锁、已发布未完成日志检测、按 UUID 的恢复预览和 apply。完整备份后发布 prepared 日志目录，替换和恢复意图先于副作用。恢复允许服务停机，核对精确摘要、原/目标状态、门禁及服务归属，保护后来状态及后续接入记录。源码/策略/状态三处真实 os._exit、恢复再次 os._exit、重复恢复、外来变化及副本损坏共11项测试 exit=0，日志 /tmp/migration-repair-upgrade-final.log。
- 管理接口13项 exit=0，cargo fmt --check exit=0。Rust 首轮全量在 gateway 长压缩响应异步用量等待5秒超时，实际 exit=101；同一测试单独复跑 exit=0。正在以 test-threads=2 复跑全套，保留原失败日志。
- 候选 db-migrations-repaired-20261112 构建实际 exit=0，清单 repaired-manifest.json；完整业务回归290项实际 exit=0，日志 /tmp/migration-repair-business-final.log。

## 当前重检结论

- Check-All 修复批次1完成，画像 interactive/auto/full/high：此次改变最低结构验证及底座恢复 CLI/持久状态，按 full 重检。三维均通过，原 CHK-001、FBK-001、FBK-002 均 resolved，剩余 CHK/FBK 为0。DOC-001 为执行记录、验收勾选与事实状态同步。
- 默认 CI 控制67项、管理13项、业务290项、所有权检查及 fmt 均实际 exit=0。底座最新11项定向与新增文件缺席恢复的独立合成复验实际 exit=0。Rust 全套以 --test-threads=2 实际 exit=0，共860 passed、8 ignored；跳过条件沿原独立 PostgreSQL 和原生 TLS 夹具要求。
- 实际候选镜像的未登记/已登记两库缺列4场景全部拒绝（exit1），原台账行数保持0/1。报告 /root/project/vibecoding-bench/.deploy/system-update-migrations/schema-rejection.json；验证进程实际 exit=0。
- 修复后完整容器14场景实际 exit=0，日志 /tmp/migration-repair-docker.log，报告 /root/project/vibecoding-bench/.deploy/system-update-migrations/docker-repaired/results.json。三份实际镜像兼容证据均完成，半库中断前真实台账为[1,0]，最近两组快照精确断言通过，真实模型调用为0。
- web 源码自前次5组真实浏览器验收后保持，复用 /tmp/system-update-migrations-browser-final.log 和 /tmp/system-update-migrations-web-final.log；本轮正式 Docker 前端阶段也实际构建通过。
- 三仓 HEAD、全部原有无关 dirty SHA 与空 staged 均通过实际回读。当前受检65个路径含待更新子模块引用。
- 本地候选继续标记 verification_only。生产 CI、首次宿主接入及真实数据库验收由 release.md 的独立上线授权承接。规范已同步，三仓精确 Git 计划经用户确认，业务仓已推送；任务记录按同一计划收口。

## Git 交付收口

- 用户已确认三仓精确计划。cc2api 与 vibecoding-bench 的业务提交及推送均实际成功，父仓子模块指向同次已推送子仓。
- 父仓暂存校验发现新增连接模块末尾多余空行，已在原计划文件内清理；Python AST 完全一致、compile 及最终暂存差异检查通过。既有行为验收和规范结论继续适用。
- 当前任务全部现有10个记录文件由同次完成进度提交同步，包含实施清单、完成态及确定性 Close。其它任务与研究文件保留各自归属。生产接入沿 release.md 独立授权。

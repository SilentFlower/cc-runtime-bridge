# 自动迁移规划依据

## 已核实的发行阻断

- 新发行 `system-ci-43065339778-1`：bench 合同 `e7232926f126ec2a3ad60b3f346c4a7ad473d66497617acc6773c0c05117674b`；父源码 `3c814384d12a3cdecfcd7c1b1284ba97b84dbdda`。
- 旧发行 `system-ci-43044877359-1`、`system-ci-43040287422-1`、`system-ci-43016902583-2`：bench 合同均为 `2de4434796c055c7b128be4b4546da54d571e94645237c0f3378815294bb1486`。
- 两侧 gateway 合同 `9b28f95cf540f10d2651026d95af6d8e7c9ece44f4c4939c62a2cbc775ddbcd1` 相同。
- 材料来自 GitHub Release 的实际 `system-release.json`；当前新版本的旧合同许可仅含自身。
- `deploy/v3/system_release.py::data_contracts` 将 `account_runtime.py` 全文纳入摘要，原因是该模块含 CREATE TABLE 和 ALTER TABLE。新增普通查询改变该指纹。
- 实际比较 `1dfc2505` 与本次新源码：`account_runtime.py::__init__` 的 SQL 迁移函数 AST 相同；`main.py` 中 SQL 相关函数一致；gateway 的 `db.rs` 和 `settings_store.rs` 差异为空。

## 现有执行与恢复

- bench：`orchestrator/main.py` 的初始化及各服务初始化；`account_runtime.py:168-183` 按列存在性补齐环境和运行字段。
- gateway：`src/store/db.rs::init_db`、`migrate`；支持 SQLite/PostgreSQL。规范要求两种 schema 同步考虑，部分 ALTER 目前依赖幂等错误容忍。
- `deploy/v3/system_updater.py::_execute` 在排空后进入 switching，依次切换、等待双端、更新环境、健康检查、提交安装状态及清理。
- `deploy/v3/system_update_host.py::health` 比较实际 schema 与声明，保护身份和资源；`restore` 恢复旧镜像、部署配置、环境及软件字段。
- 现有 storage 备份使用 SQLite backup API 并验证隔离恢复；更新 SOP 为 US 记载免备份选择。
- 宿主执行器使用固定安装源码和策略。新增宿主阶段的接入路径需单独设计，发行清单不具备任意命令权限。

## 规划状态

- 已确认目标：让常规建表及迁移随系统更新执行，兼容检查以实际迁移语义与验收为依据。
- 用户已选择自动数据库快照恢复，替代本功能范围内原 US 免备份选择。
- 已形成设计：默认两组完成快照、维护窗口内双库离线迁移、开放准入后的数据保护，以及 v1/v2 底座接入。

## 新格式和固定执行器的接入依据

- `system_update_contract.py::validate_release` 对顶层字段和 updater=1 采用严格校验；`SystemUpdater.check` 下载目录全部清单后才提交目录。直接把新格式塞入旧目录会影响旧实例检查更新。
- `install_system_updater.py::SOURCE_FILES` 明确复制宿主固定源码，既有实例不会随着控制镜像变化获得新恢复逻辑。计划增加受控的一次性执行器升级，继续使用原策略、服务锁、门禁和版本状态。
- 计划采用 v2 受信格式与独立通道，旧通道保留并刷新支持的旧格式；新增迁移代码只在镜像固定维护入口执行，发行不携带任意宿主命令。
- 现有 `storage_backup.py` 已明确 `DATABASES=('gateway/gateway.sqlite','bench/db.sqlite')`；使用 SQLite backup API 和逻辑摘要，并保持文件 uid/gid。计划提取数据库专属能力，快照不包含全业务目录。

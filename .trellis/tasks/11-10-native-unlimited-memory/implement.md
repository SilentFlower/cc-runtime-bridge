# 实施计划

## 执行前

- [x] 完成 Brief 门禁并启动任务，使用 inline 路由加载规范。
- [x] 冻结三仓既有脏文件，保护其他任务和历史改动。
- [x] 读取资源函数、原生池、指标和评审交接的实际定义。

## 实现与验证

- [x] 更新 bench `resource_budget.py`、`native_sender.py`、`account_isolation.py`、`account_runtime.py`，贯通显式无限模式与持久化。
- [x] 更新 `physical_features.py`、`project_review_runtime.py` 的有限假设，复用现有无限值显示。
- [x] 核对 `deploy/v3/manage.py` 的无限账号兼容，保持全局有限默认和 US 例外。
- [x] 更新 cc2api `native_contract.rs`、`native_runtime.rs` 及必要的备用平台检查；零哨兵仅豁免 RAM 公式。
- [x] Python 覆盖有限/无限资源、native sender、runtime、指标、物理特征和评审恢复。
- [x] 部署工具验证有限默认和无限账号兼容。
- [x] Rust 验证预算、错误配置、身份、取消、回收与真实二进制。
- [x] 合成 Docker 验证三个角色/评审的 HostConfig/cgroup，保持 CPU/PID。
- [x] 真实二进制离线 fixture 覆盖 2 普通/4 Haiku、单次提交、HTTP/SOCKS 和池恢复。
- [x] 执行格式、适用 Check-All，保存证据并评价/更新规范与部署说明。

- [x] 增加按账号 CC 组装后采集、凭据脱敏、限额轮转及诊断详情只读入口，验证隔离、截断和失败状态。

## 交付与生产

- [x] 完成精确多仓 Git 计划及发布门禁，核验同批 CI 镜像/清单。
- [x] 真正空闲后记录旧资源元数据和恢复步骤，迁移“11-5”并重建角色。
- [x] 验证原生能力、cgroup、身份/会话/成果、其他账号策略、两库和鉴权，确认实际 sender 绑定网关账号 12。
- [x] 完成健康部署后的精确旧镜像回收，保留全部容器及三套完整发布。
- [x] 报告启动结果及请求详情入口，业务结果观察由用户后续请求触发。

## 范围

- 产品：本仓离线消费者夹具 `scripts/testing/cc2api-native.ts`；bench `orchestrator/`、`deploy/v3/`、cc2api `src/service/native_*.rs` 及相关测试、规范和说明。
- 任务：本目录三件套、Brief 和进度证据。
- 运维：私有精确计划及回执；凭据与 `.deploy` 运维目录留在提交范围外。

## 验证与当前状态

- FBK-001：新增落盘回归在修复前失败；补齐有序头二元组凭据注册后，3 项采集测试通过。验证客户端凭据在正文及扩展头重复出现、大小写、Bearer、Cookie、API Key、普通头多值及转发输入保持。
- 真实二进制新增网关回归 4 次通过；通过独立 TLS 服务核对账号 bearer，管理读取链核对脱敏头及正文。
- 前轮无限 HTTP/SOCKS 各 14 次及有限 HTTP 17 次通过；Docker network/sender/CLI/静态评审/串行评审的 memory.max、memory.swap.max 均为 max，CPU/PID 保留。
- Python 原生资源/采集/评审/物理特征 43 项、账号运行时 85 项、部署工具 33 项通过；重画像保留无限资源及采集开关的定向复验通过。前端构建、根仓类型、Rust 格式及 Python 语法通过。
- 全量 Rust 验证 759 项单测及 85 项默认集成测试通过。Check-All 严格通过，FBK-001 修复重检通过；三个既有规范已同步。

## 联合交付与生产验收

- cc2api `17add96`、bench `817237a`、本仓消费者夹具 `c7d7261` 已推送。联合 CI [42844229807](https://github.com/SilentFlower/vibecoding-bench/actions/runs/42844229807) 成功，发布为 `ci-42844229807-1`。
- 联合清单 schema 3、布局 2、凭据归属 1、父仓及子仓提交均匹配；镜像内八份控制源码及原生二进制校验通过。
- US 生产沿用免备份、免宿主 RAM 重新估算约定。API、CLI、控制任务、待确认动作及租约空闲检查通过后切换同批镜像。
- 平台 14 ↔ 网关 12 ↔ 环境 `15551aa6f302494cb9b5440750899c2c` 对应一致。目标保持 native293、并发 2，sender 实际绑定账号 12、`memory_mib=0`、`max_workers=4`，原生准备返回 generation 7、active 0、协议 1、版本 2.1.293。
- 目标 network/sender/CLI 的 Docker RAM 为 0、合计 RAM/swap 为 -1；实际 memory.max、memory.swap.max 均为 max。CPU/PID 与原策略一致。CLI 指标导入成功，受限内存值为 0。
- 网关账号 11、10 的兼容重建准备通过，有限内存和 CPU/PID 策略一致。其他容器身份、镜像、启动时间及重启次数保护核对通过。
- 仅网关账号 12 开启采集，sender 私有目录为 `/flows/api/cc-prepared`。请求详情前端资源已部署，管理接口匿名 401、授权 200，公共页面和网关健康通过，两库 quick_check 均为 ok。
- 账号身份、资源策略及会话/成果保护摘要核对通过。HOME 当前 access token 与对应网关账号一致，refresh token 由网关保管。所有生产验收操作的模型调用数为 0。

## 部署异常与恢复证据

- 新网关启动迁移把目标 canonical_env 的 node_version/build_time 改为软件默认值，触发身份保护检查。根据旧账号镜像实测 Node 版本及原导入约定重建候选，完整旧身份摘要唯一匹配后，通过事务比较恢复这两个软件元数据字段；完整身份摘要复验一致。
- 切换后账号 12 在 `2026-11-10T15:45:11Z` 正常刷新 OAuth，HOME 凭据副本随权威网关同步。动态凭据摘要转移单独记录，原始基线保留。复验三个绑定账号的身份、当前 access token 对应关系及 refresh token 归属通过。
- 最终验收使用 `verification-final.json` 的 passed 回执。生产私有证据位于 `/opt/vibebench-v3-us/operations/native-unlimited-ci-42844229807-1`，本地回执位于 bench `.deploy/native-unlimited-ci-42844229807-1/`；秘密留在私有运维目录。

## 发布后镜像回收

- 按冻结计划移除 `ci-42158082782-1` 的两份旧 control/account 镜像，保留当前发布与最近两套完整历史发布及所有容器引用镜像。
- 回收后磁盘可用 22,838,583,296 字节，净释放 3,417,374,720 字节；38 个原容器、14 个运行容器及 25 份受保护镜像核对通过，健康与两库检查通过。
- 回收回执为私有目录中的 `image-cleanup-result.json`，status 为 passed。当前任务交付完成，后续业务请求可通过详情观察 CC 组装后头和值及正文。

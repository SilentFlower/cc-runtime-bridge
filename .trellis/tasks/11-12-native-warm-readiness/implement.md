# 实施与验证计划

## 实施顺序

1. [x] 完成 Brief 评审并激活任务；经 trellis-route 进入实现，加载相关 cc2api/bench 规范和实际类型。
2. [x] 在 native_contract.rs 定义新状态与可选诊断字段，先补跨平台编译和旧记录反序列化兼容。
3. [x] 统一池身份与候选活性核验入口，覆盖 busy 身份检查、原子取用、共享准备登记、退出计数和取消。
4. [x] 提供私有零模型 readiness 接口，并扩展网关协调器的周期检查、退避、当前身份发布及停止回收。
5. [x] 把业务实际 PID、暖命中和阶段计时贯通 sender→NativeRequestObservation→持久诊断；核验准备等待仍计入请求总时间。
6. [x] 贯通 bench 环境安全摘要、原生环境卡片和 Vue 请求详情；复用现有 CSS 与异步结果归属规则。
7. [x] 执行离线真实二进制/回环和故障回归，记录首轮复用及冷暖阶段对照。
8. [x] 通过 Check-All、Spec 同步和精确 Git 交付，保留联合 CI/后续部署入口。

## 文件责任范围

- 主执行仓 `/root/project/vibecoding-bench/cc2api`：`src/service/{native_contract,native_runtime,native_runtime_unsupported,native_prewarm,runtime_transport,gateway,diagnostics}.rs`、`src/model/request_diagnostics.rs`、管理员路由和关联测试；`web/src/{api.ts,components/RequestDiagnostics.vue}`。
- `/root/project/vibecoding-bench`：`orchestrator/{account_runtime,main}.py` 及对应测试，`webui/{environments.js,environments.css}`，`deploy/v3/verify_environment_ui.py` 和必要的隔离原生验收扩展。
- 本仓：本任务材料、性能研究记录及必要的固定真实运行时离线夹具。固定运行时源码与发布二进制只有确认存在初始化缺口后才另行评估；不以消费者重标 ready 替代初始化验证。
- 相关规范在 Spec 阶段按实际合同更新。其它进行中的头部与连接任务材料保持其各自所有权。

## 验证矩阵

| 场景 | 关键断言 | 对应验收 |
| --- | --- | --- |
| 首次准备及健康巡检 | worker_ready/映像核验先于 ready，模型 POST=0 | A1/A2 |
| 空闲 1 分钟/30 分钟/数小时 | 同 PID、同代次；首业务启动次数=0，模型一次 | A2/A6 |
| 外部终止热进程、管道 EOF/迟到帧 | 状态失效、合并补位；新 PID 真实标冷恢复 | A3/A4 |
| bearer/身份/配置/环境代次变化 | 旧 ready 作废、旧 busy 不充当当前就绪 | A3 |
| 准备与业务竞争、全忙、取消 | 一个共享启动、原上限、正确归还、零重放 | A4 |
| 网关重启、周期退避、协调器停止 | 补偿已运行账号、去重、取消收口 | A3/A4 |
| 休眠/停用/排他维护/系统更新 | 查询不唤醒，不抢租约、不启动新角色 | A1/A7 |
| 内核激活/回滚及迟到准备 | 精确目标隔离、切换后实际首业务复用 | A3/A7 |
| 状态读取失败与历史记录 | unknown/过期可见，旧字段为未观测 | A5 |
| 桌面/390px 页面与请求详情 | 真实源码合成浏览器，状态归属、安全文本 | A5 |
| 相同正文/CPU 冷暖对照 | 分段分布、warm_hit、PID 与启动计数一致 | A6 |

## 验证命令与证据要求

- Rust：在 cc2api 执行 `cargo fmt --check`、`cargo test --locked`；先运行新增针对性测试再执行完整现有检查。固定二进制 `native_real_binary` 使用原隔离脚本注入 CCRB_TEST_BINARY/PROXY/CA，不直接联外运行 ignored 用例。
- Python：在 bench 执行受影响的 `orchestrator/test_account_runtime.py`、`test_runtime_diagnostics.py`、`test_native_kernel_upgrade.py` 测试模块及新增准备状态用例；以实际仓库测试导入方式执行。
- 前端：cc2api/web 中 `npm run build`（vue-tsc 与 Vite），bench 的 `deploy/v3/verify_environment_ui.py` 使用本地构建产物和全部合成 API。
- 复用 `deploy/v3/verify_forwarding.py --native` 的真实二进制、双账号三角色与回环上游证据；先读取脚本参数和环境边界，再运行必要场景。
- 每次证据注明源码、二进制 SHA、正文大小、CPU/RAM、启动数、PID、观测位置和模型请求数。虚拟时间与真实等待分别记录；没有真实数小时观察时如实标注虚拟时间覆盖。
- 逐项核对 A1～A7 后提交交互 Check-All，随后进入 Spec 与精确 Git 计划。

## 失败恢复与交付界限

- 池生命周期失败先定位并修复，保留原固定摘要、门禁和单次提交要求。
- 候选准备失败沿现有内核回滚操作清理；未知活动保持维护阻塞和可见失败原因。
- 合成测试只清理自身登记的临时进程、网络与文件；真实账号模型调用为 0。
- 本轮交付代码与验证材料。生产升级沿独立联合 CI 和部署授权执行。

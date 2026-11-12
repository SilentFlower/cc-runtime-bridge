# 实施与验收计划

## 前置与顺序
- [x] 最终Brief评审通过后激活当前任务，按trellis-route默认inline执行；读取各层规范与当前基线，保持既有无关改动。
- [x] 先把额度字段导致池身份变化及实际客户端拒绝数组两个离线复现转为有效回归。
- [x] 修复pool_identity的quota_identity归一化，覆盖凭据/代理/环境/内核变化与取消竞争。
- [x] 修复Cc2ApiClient批量状态响应及环境投影，贯通读取错误、快照缺失、过期与代次不匹配。
- [x] 核对试点备用配置的完整投影和开启/关闭转换，补真实容量观测与后台第二worker回归。
- [x] 明确并实现Rust可选ingress_capture与私有快照追加字段，先实现共享脱敏/预算/真实哈希，再保存既有header_policy事件与有界正文观察差异。
- [x] 在NativeRequestObservation/AttemptDiagnostic中仅追加必要有界摘要，复用现有summary_json；同步Rust/Python/TypeScript读取合同与旧记录兼容。
- [x] 完成请求诊断三块展示及环境准备卡片错误提示，保持既有组件和移动端风格。
- [ ] 执行联合行为验证、Pre-Check及Check-All，修复选定问题后更新Spec、准备精确Git计划。

## 主要文件
- 子仓`cc2api/src/service/{native_contract,native_runtime,native_capture,runtime_transport,diagnostics,gateway,native_prewarm}.rs`、`src/model/request_diagnostics.rs`及实际引用测试。
- 子仓`cc2api/web/src/{api.ts,components/RequestDiagnostics.vue}`、相关前端测试和请求诊断说明。
- 父仓`orchestrator/{main,account_runtime,native_capture}.py`、`webui/environments.js`及实际需要的样式与对应unittest。
- 试点配置涉及`deploy/v3/manage.py`、`compose.yml`及既有环境说明，先核对实际差异再限定修改。
- 根仓任务材料及命中的共同协议/日志规范。根运行时生产代码仅在发现现有事件合同不足并完成材料更新后才纳入。

## 定向验证
- Rust：`cargo fmt --check`、`cargo test --locked --lib`；执行范围覆盖native_runtime/native_capture/runtime_transport/gateway/diagnostics，之后按规范跑适用完整Rust测试。
- Python：以项目既有解释器运行`orchestrator/test_native_capture.py`、`test_account_runtime.py`、实际Cc2ApiClient的main相关测试；修改配置时补manage与Compose校验。
- 前端：`cc2api/web`执行既有Node测试及`npm run build`；实际浏览器桌面与390px检查详情、错误提示、异步归属和安全文本。
- 真实固定二进制与隔离回环：准备/候选激活完成→首次业务补写quota→worker/PID不变、warm_hit=true、startup为null；再覆盖身份变化、回滚、故障、取消及并发占用。
- 主/子agent合成请求：白名单外头与重复头逐项删除可见、合法协议/父子关联保留、根本机设置删除及嵌套同名字段保留、metadata必要改写可追溯。
- 采集：info无新增原文、debug多阶段统一脱敏、Unicode截断、总预算和6MiB上限、旧记录/旧快照、过期/缺失/写入失败及最终TLS未采集提示。
- 只读刷新/准备/巡检上游模型计数0；每条合成业务唯一提交；真实生产推理不作为自动测试步骤。

## 性能与证据
- 保存修复前根因复现与修复后同条件结果，记录真实PID、worker_id、代次、各本地阶段和完整性。
- 使用同正文、预算及计时边界比较预热首轮与稳定热请求；本地回环未施加生产CPU cgroup限额，时延只作离线行为证据。线上sender已按授权提高到1核。所有扩容成本仍计入prepared_ms。
- 同身份并发、在途备用、停止/休眠、更新与内核门禁逐项验证，超出热容量的扩容如实记录。

## 风险与恢复
- 额度观察字段规范化不能影响凭据/代理/绑定/内核隔离；通过真实反例回归核对。
- debug入口预览增加私有报文和文件载荷，必须在传输前脱敏并约束预算；原始哈希与脱敏预览分开。
- 新旧gateway/sender混装会涉及可选私有字段兼容，交付按同一联合平台发行处理。
- 阶段采集失败、轮转或历史缺失保持可见，业务错误处理与提交次数沿原合同。
- 其他生产上线与试点开关变更在后续授权范围内执行，形成release.md后按SOP核对。

## 用户追加的生产CPU操作
- [x] 固定US环境11-5 sender在线从0.25提高到1核，范围、原地生效与失败恢复检查完成。
- [x] 固定US环境11-5 network在线从0.25提高到0.5核，保留其他角色额度与原容器。
- [x] 核查network CPU节流窗口、qdisc及网卡错误/丢包；明确累计与窗口数据口径。
- [x] 用户选择页面手动即时调整与重建持久化。
- [x] 完成CPU配额持久化及手动调整界面的增量设计和实现。

## 追加的流中断诊断
- [x] 新增受控错误类型摘要，覆盖截断HTTP响应、连接错误、超时及秘密不回显。
- [x] 贯通网关根ID、原生attempt/job ID、worker/PID及绑定代次。
- [x] 补齐sender归并前错误、IPC异常、超时及下游取消日志；补本地SOCKS隧道故障及收口日志。
- [x] 离线断流/静默/取消测试与Rust完整检查；记录上线后需要的新样本。

## 追加的内核行为修复
- [x] 保存beta.4首响应预算误作用的短预算与原预算离线复现。
- [x] 修复api.Ree取消信号归属，补持续有数据长流、真正取消及单次发送回归。
- [x] 贯通设置→NativeSubmission→worker能力/指令→封口前TTL改写，覆盖off/5m/1h和旧能力拒绝。
- [x] 固定来源构建新候选，校验完整制品及原生实际行为；生产上线沿后续授权执行。

## 已完成验证与收尾
- [x] 动态CPU兼容旧评审布局，交接期间拒绝调额；36项CPU与评审回归通过。
- [x] 更新器冻结实际CPU，重建与软件回滚按归属恢复；15项更新器回归通过。
- [x] 根仓类型检查、180项单元测试；官方来源及新候选各67项原生测试通过（各46项条件跳过）。
- [x] 子仓866项Rust测试通过，8项条件跳过；新增TTL输入校验单项回归通过。
- [x] 父仓184项运行时/客户端/采集测试通过；最新11项合同定向回归通过。
- [x] 新页面5场景和既有环境页16场景通过，覆盖390像素、过期回执、筛选及安全文本。
- [x] 真实原生联合回环：31次合成业务、并发峰值6，候选激活/回滚、首条额度补写复用、实际TTL及Rust快照→Python读取通过。
- [x] beta.4持续流181039ms误断；新候选持续185457ms正常收口；主动取消1506ms完成。每条业务唯一提交。
- [ ] 完成Pre-Check、Check-All、Spec同步与精确Git计划确认。
- [ ] 后续上线授权后按release.md核验新内核、联合平台及宿主更新器。

命令、输出和制品依据见research/stream-interruption-and-cache.md与release.md；测试证据保存在本机/tmp/native-stage-*.log及gitignored artifacts/native-stage-diagnostics-20261112/evidence。

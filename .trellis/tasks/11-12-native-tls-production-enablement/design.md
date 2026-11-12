# 原生TLS默认采集生产接入设计

## 现有边界

- 根仓`native/tls-observer/`拥有固定执行体准入、BPF副本和HTTP限界；平台子仓`cc2api/src/service/native_tls_observer.rs`拥有单worker异步准备与收口，`native_runtime.rs`拥有真实原生worker。
- 平台`orchestrator/account_isolation.py`目前以UID1001、CapDrop ALL、NoNewPrivs启动sender；`content_capture_settings.py`已有冻结代次/revision、独占维护租约和失败恢复。复用这些入口。
- 线上两个账号的临时配置验证了固定beta.5与大正文。临时启动器依赖容器NoNewPrivs=false。正式实现采用独立受限加载入口，业务角色恢复NoNewPrivs=true。
- 同期任务`11-12-request-diagnostics-ui`拥有已有开关和诊断布局。本任务补充默认值、TLS能力、失败说明与操作闭环，适配其最新类型及DOM。

## 默认策略与生命周期

`native_capture_enabled`继续是账号fingerprint内的持久选择。缺字段表示默认开启；布尔true开启、false关闭；其他类型属于配置错误并提示对账。读取、创建sender配置、开关CAS和系统更新共用一个策略解释入口，避免默认值漂移。历史显式false保持关闭。无需数据库新列或迁移脚本。

首次部署和系统更新带入采集制品。运行中环境按既有账号镜像内容变化流程排空重建。停止环境保持停止，下一次启动自动准备。开关沿现有维护门禁修改fingerprint并重建；返回实际配置和能力结果。旧镜像显示需系统更新。未知内核保留明确IMAGE_NOT_ADMITTED，原生业务按既有路径执行。

## 可信制品与解释器

canonical源码仍在本仓`native/tls-observer/`。新增受控导出工具向平台`images/v3/tls-observer/`生成固定文件清单、来源revision和各文件SHA。正式导出要求来源已提交且相关路径干净；开发快照显式标记。平台Docker构建阶段编译BPF及受限入口，运行阶段安装固定依赖并验证清单，镜像登记采集协议能力标签。

Rust帮助进程启动使用可信固定路径，覆盖实际`/usr/local/bin/python3`；清环境策略保持。sender只从镜像受控目录选择采集客户端，页面输入仅包含既有enabled与冻结版本，禁止下发任意命令、路径、偏移或能力集合。

## 受限加载与业务权限

每个启用采集的sender容器使用可信加载进程管理本容器内的采集子进程。初始权限限于已验证加载必需的能力，隔离试验以SYS_ADMIN及身份降权所需能力为候选。加载器派生原sender并清空其有效、许可、继承及ambient能力，设置NoNewPrivs；Rust sender与原生worker继续UID1001。容器自身保持NoNewPrivs=true、只读程序层、原网络命名空间及角色挂载。

加载器通过私有Unix socket接收固定schema请求。使用SO_PEERCRED、实际sender父子关系、进程启动时刻及pidfd约束客户端和目标。仅允许本sender的直属原生worker及固定映像SHA；broker派生observer时传入可信owner，原standalone直属PPID校验继续保留。socket父目录由root持有，业务用户只能连接。请求并发最多为原生max_workers，每worker最多一个实例，启动与收口复用2秒后台预算。

可信observer短时持有加载权限，附着成功且能力清零后才发送ready。固定C监督进程在同UID零能力下独立响应stdin挂断，并有界回收观察器；broker关闭stdin完成取消，避免依赖帮助进程pidfd分配。socket尾部收口最多等待250ms。broker取消、EOF、超时、sender退出均释放探针和FD。加载器不提供通用exec、文件访问或任意PID观察。镜像文件和进程权限防止业务用户修改加载器。seccomp以固定官方模板的原零能力规则为基线，仅补实际需要的BPF/perf调用；禁止privileged容器、host PID、全局sysctl调整和向sender挂载Docker socket。

**实施技术门槛**：先在生产等价隔离容器验证这套加载与降权路径、读取目标/proc和附着权限、业务全能力清零及NoNewPrivs。该组合已通过本地生产等价容器验证。门槛失败时记录具体原因并调整受限实现；涉及额外权限或放宽业务策略时单独评审。临时NoNewPrivs=false方案不自动成为正式发行配置。

## 大正文与资源合同

把已验证的六档固定事件容量合入canonical：16KiB/64KiB/256KiB/1MiB/4MiB/8MiB，事件头32字节，ring16MiB。Python先读头，再按accepted读取有效副本。保持SSL实际返回长度、代次序号、独立writes/bytes/dropped/read_errors/oversized对账。超过8MiB单写或ring满只标采集缺口。正文全量SHA与2MiB共享脱敏预览独立，现有6MiB快照及轮转合同保持。

默认开启扩大常驻探针资源。按实际原生max_workers核算ring及帮助进程峰值，纳入sender原资源预算；满额明确缺证并释放过期实例。保持现有单次业务提交、固定TLS实现与无模型预备。

## 状态合同与页面

在既有sender鉴权内部状态中增加可选TLS能力摘要，并由orchestrator映射到`content_capture.tls_observer`。新增对象合同：

- `state`：`not_installed|disabled|stopped|preparing|ready|unavailable`。
- `reason`：受控诊断码或null；`checked_at_ms`：真实检查UTC毫秒或null。
- `protocol_version`：已验证协议版本或null；`image_admitted`：核验结论布尔或null。
- ready仅来自当前环境代次的实际已就绪采集槽。配置标签只代表安装能力。单次采集仍由该请求wire_final表明完整性。

既有`enabled/applied/supported/generation/revision`语义保持。动态状态不加入配置revision。响应缺扩展字段的旧版按未知能力显示；切换时重新冻结版本、复核绑定与更新门禁。列表状态只读查询，刷新不得新增模型请求。全局info/debug保留原选择，页面说明debug保存脱敏原文。

## 失败恢复与发布

开关切换继续保存原fingerprint和操作审计；重建/实际配置核验失败走原恢复，恢复不完整进入reconcile。开启后复用既有异步零模型预备及批量巡检；页面在取得同代次实际ready前显示准备或受控缺口，避免在维护锁和排他租约内等待网关反向查询造成死锁。停止环境记录stopped待启动。镜像升级的逐环境结果明确记录能力检查和失败原因，保持原更新器的兼容回退、数据与身份保护。

发布前输出精确制品、权限差异、所有受影响环境和回退点。10-30及11-5临时绑定在正式候选验收后按空闲维护迁移。当前生产授权范围限定这两个账号；其他账号的正式发行切换沿上线SOP取得授权。

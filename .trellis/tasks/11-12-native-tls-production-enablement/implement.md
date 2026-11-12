# 实施计划

## 执行顺序

- [x] 完成首次Brief评审，启动本任务并通过trellis-route进入实施；读取各仓AGENTS、before-dev及真实类型定义，冻结多会话差异。
- [x] 先完成隔离权限技术门槛：固定加载器、Unix peer及目标归属、NoNewPrivs、全能力清零、固定SHA和异常退出；使用合成凭据、隔离网络及真实beta.5。失败按设计收口。
- [x] 合入六档大正文BPF与有效字节解析，覆盖独立计数、单写超限、满ring、HTTP长度限界及凭据跨事件缺口。
- [x] 实现受控制品导出、Docker多阶段构建、依赖/固定Python入口及采集能力标签；正式来源清单绑定canonical提交和文件SHA。
- [x] 抽取统一默认策略，缺字段默认true、显式false持久保留，所有读取/创建/重建入口共用；沿现有内容采集开关加入能力检查、真实状态和失败恢复。
- [x] sender内部鉴权状态追加TLS摘要；orchestrator与环境卡贯通状态、停止待启动、需更新与受控失败原因，复用同期UI改动。
- [x] 验证新建/历史缺字段/显式关闭、重建/系统更新/回退、忙时拒绝/旧revision/失败恢复、未知映像/加载失败及断连清理。
- [x] 执行Check-All、Spec更新和精确多仓Git交付；已完成canonical提交→固定revision正式导出→平台提交，联合构建由平台v3工作流承接。
- [ ] 生成正式候选及上线操作范围，按SOP授权后部署；复验10-30、11-5真实自然请求和其他已授权账号，保留恢复材料。

## 验证入口

- 根采集器：`python3 -m unittest discover -s native/tls-observer -p 'test_*.py'`及`python3 native/tls-observer/build.py`；新增加载器、归属与六档边界离线测试。
- Rust：在平台cc2api目录执行格式检查及native_tls_observer、native_runtime、native_capture相关定向测试；状态合同变更后按影响范围执行回归。
- Python：在平台目录执行现有`test_account_runtime.py`及内容采集相关用例，补充默认值、能力状态、CAS和恢复断言；系统更新测试按改动文件选取。
- 生产等价镜像：开启/关闭完整ClientHello协议投影对比，真实beta.5与独立TLS接收器核对512KiB及4MiB以上实体SHA，验证六PID并发和资源峰值；强制ring丢失时单次业务完成且缺口可见。
- 页面：现有环境UI验证脚本和真实浏览器覆盖桌面/390px、默认开启、关闭再开启、更新重建、旧镜像、失败及迟到响应归属。零模型请求计数作为断言。
- 正式读取链：真实Rust快照→Python私有读取200→Vue最终TLS原文及来源，区分实体完整与预览截断。生产模型仅观察自然流量。

## 回退点及保护

- 权限技术门槛失败先停正式接入，保留具体失败证据。涉及新安全边界的替代方案单独评审。
- 代码只覆盖本任务精确文件，已有环境UI/系统更新其他会话改动按实际基线适配。
- 开关失败恢复原策略和服务；更新失败依原操作与镜像来源恢复；身份/代理/数据/内核选择沿原保护。
- 本规划确认覆盖代码及隔离验证。生产发布另按实际候选和权限、环境清单确认。

## 当前验证证据

- 2026-11-12用户确认完整Brief，任务已in_progress，route=inline。
- 实际隔离容器保留NoNewPrivs=1，sender UID1001、CapEff=0；加载器仅SYS_ADMIN/SETUID/SETGID，ready前观察器能力清零。512KiB及4MiB以上的实体/整体HTTP SHA与独立接收器一致。
- 合成回环4,719,311字节，六worker并发完整，采集开关ClientHello协议投影一致，真实模型0。首轮六worker夹具错误使用768MiB预算产生退出；按现有六worker部署预算1536MiB重跑通过。
- Rust库全量788通过、4条件跳过；实际Rust六PID并发回环通过，正式Python reader核验成功。新增状态测试和最终制品验证以本轮最终日志为准。
- Python内容采集10项及账号运行时96项通过；新增带探针镜像标签的真实生命周期断言已加入。

## Check-All修复

- CHK-001：角色验收区分固定加载器和真实sender/worker；按精确入口、能力集合及seccomp核对加载器，业务P/E/I/A为0且NoNewPrivs=1。三角色真实容器含本地构建、秘密隔离和内存/tmp压力通过；3项故障断言覆盖越权、身份和主进程歧义。
- CHK-002：Observer公开构造器补齐owner、started来源、缺省及失败语义。
- FBK-001：开启前独立按安装协议门禁，新增关闭态旧镜像用例，维护租约/重建均为0。Python内容采集11项通过。
- FBK-002：固定C监督进程以同UID零能力观察管道挂断并回收Python观察器；broker取消直接关闭stdin，收口不再分配帮助进程pidfd。退出和socket尾部回收分别有2秒/250ms上限。句柄耗尽、EOF和弃读回归通过。
- 修复候选镜像完整回环覆盖取消后同worker再次准备、512KiB、4MiB以上、六worker并发和ClientHello投影对照，真实模型0。最终重检与制品摘要以本轮最终证据为准。

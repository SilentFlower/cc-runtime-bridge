# CLI 对齐候选验收

## 当前结论

**当前工具规则为：省略 tools 与 [] 均无工具，非空列表仅采用调用方定义，不注入 CC 工具。** 本轮已重建并完成原版/精简回归、完整出站对照、独立部署、重复构建和日志页面验证。用户已取消 vm2api 相对速度准入，以安全与稳定优先；正式 full Check-All 无新增 CHK/FBK，Spec 评估为 no-op，业务代码已按用户确认计划提交并推送。

用户已批准本任务的完整 Brief；没有提交或推送代码，没有将未通过的速度改记为通过。接纳表目前只含本轮固定验收候选，旧 SDK 和过渡产物身份已移除。生产自动 wire_final 能力仍为 false。

## 当前显式工具产物与验证

- 分发：runtime/claude-293-explicit-tools-final，27371576 B，SHA ae4fd1da7ccdb05aa205539fa998a51ded52a739c75992f5835d596573052ac2；实际执行体 112778424 B，SHA d73e858911efbeb78642f0575722c9e6618699107432f3f7902345cbfea60e85。配方 9、17 份源码摘要，部署预算仍为 27933052 B。
- 本轮实跑单元 55 项/157 断言、集成 17 项/65 断言；原版与精简原生各 28 项/429 断言，共 128 项用例通过，类型检查与构建通过。省略/[]/自定义工具同 PID 交替，system 替换、错误、取消、重建、秘密处理及已声明/未声明 Bash 均验证；本地文件未创建，未继续模型轮次。
- 正式 full Check-All 核对源码、测试及工具链仍覆盖这些结果，并补跑 `bun run test:ui`，退出 0，3 项页面用例通过，日志为同证据目录 check-ui.log；当前回归合计 131 项。只自动同步检查状态及原生装配说明的过期事实，未在检查阶段修改业务代码、配置或测试。
- 新采集真实交互 CLI 的 --tools ''、禁用工具加业务 system、禁用工具加空 system 三种配置，各主/辅助两份最终正文。两份桥接入口各 40 份最终 TLS 正文独立核验 CCH，五种业务输入与匹配 CLI 完整对照通过；全部 40 对正文及头另作原版/精简比较。
- 两次独立构建的分发、执行体、配方、源码与闭包集合一致。隐藏官方源、项目及全部旧 /tmp 后完成无工具默认请求和 shutdown；实际 /proc 执行体匹配，只观测到 189 B 配置增量，没有完整执行体磁盘展开。
- 新执行体完成 108 组分词和 24 组 Unicode 规范化对照。独立 Node TLS 接收器另采集 14 个场景，全部 CCH 通过；default/no-tools 的 tools=[]，custom-tools 只有 lookup_status。已追加到现有预览，52 条旧详情摘要不变，当前 66 条；每页 50 条、第二页 16 条，桌面/手机验证无页面错误，nativeFinalCapture 仍为 false。
- 当前五轮计时为启动至首轮 2714.881 ms、就绪后首轮 27.282 ms、暖复用 17.413 ms；作业后 RSS 中位 186195968 B。旧相对速度脚本按暖比值 1.324318 返回 passed=false、退出 1，保留原样本；当前无相对速度要求，不把该诊断改成通过或作为安全缺陷。
- 本轮全部网络测试为合成凭据、独立 HOME/config/cwd、无外网回环，真实上游请求为 0；未采用首发裁剪或其它研究原型。原生兼容及 CCH 不构成账号免封承诺。

本轮证据根目录为 artifacts/cli-alignment-20261105T064401Z/explicit-tools：unit.log、integration.log、typecheck.log、native-{original,compact}.log、bridge-{original,compact}/{requests,comparison}.json、bridge-compact/all-requests-comparison.json、cli-approved-*/、benchmark/、reproducibility.json、deployment-report.json、intl-verification.json、final-tls-explicit-tools/、preview-import.json 和 browser-verification.json。

以下章节保留上一静态复用产物及接受延迟时的历史记录；其中的“当前”指记录发生时，不能将旧哈希、44 项子集或旧计时当成本轮重新验证的结果。

## 历史：用户决定与安全复核（2026-11-05）

- CHK-001 保留 P1 及原始证据：当前产物暖中位 33.782 ms，固定历史标杆 13.564 ms，比值 2.490476，原速度门槛未通过。
- 用户明确决定：“算了我们这个不以原来那个为目标吧。这个延迟其实能接受。保证安全把”。该决定接受当前延迟风险并取消相对速度要求，不等于性能修复或接受其它安全缺陷。
- 接受绑定下文的 fc985633 分发、ed82acdc 执行体及完整原生 CLI 合同；部署预算 27933052 B、凭据保护、每轮新根、单次发送、故障退役和不重放保持有效。将来改变相关实现或证据时须重新判断该接受是否仍适用。
- 当前 17 份构建源码摘要、分发 SHA 和字节数与最终 manifest 一致。没有采用首发消费裁剪、环境副本、后端/功能配置缓存等研究原型，没有增加真实上游请求。
- 定向命令 `unshare --net bun test tests/unit/engine.test.ts tests/unit/header-policy.test.ts tests/unit/profile.test.ts tests/unit/redaction.test.ts tests/unit/startup-failure.test.ts tests/unit/worker-protocol.test.ts --timeout 30000` 退出 0，44 项用例、113 个断言通过；日志为 artifacts/cli-alignment-20261105T064401Z/safety-review/unit.log。这 44 项属于既有回归子集，不与原 129 项重复累加。
- 复核实际源码中的单次调用守卫、原始响应独占、工具/代理拒绝、先注册秘密后持久化、每轮 nEr 新根及终态加 idle 后复用；原版/候选原生对照、独立部署和重复构建证据继续覆盖当前未变化的产物。兼容及 CCH 只证明已覆盖条件下的请求行为，不承诺账号免封。

## 固定身份与体积

| 对象 | 字节数 | SHA256 |
| --- | ---: | --- |
| 官方 2.1.293 源 | 252755128 | 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978 |
| runtime/claude-293-cli-static-final | 27371576 | fc985633319c3bfb80fafac915c7cd5368c481954487cc40074322ca6f76d1c7 |
| 实际执行体 | 112778424 | ed82acdc54a642bf2835ea175aab480fa52dbd498176c2acc41c0fa93672cf96 |
| vm2api 固定标杆分发文件 | 27933052 | 8484c4c58f4b7782a190f7cab7c8aa5d1f706ae26b2d2a5cafe81af070f0611b |

完整必需运行时部署集合为一份候选可执行文件，余量 561476 B。原版、Bun、JS、提取目录、7zz、SDK 和 manifest 均非运行依赖；系统 glibc/ELF 组件和既有控制面单列。内存执行体约 107.55 MiB，与分发大小及 RSS 分开。

配方 8 保留固定 Bun 1.4.3/revision eecfd55debb281c3fe3518098b1a49f76429637c 的原生代码。已应用的有界裁剪为 80 个 Vt.create、54 个终端本地命令 load 执行守卫、1 个仍可达的附件加载守卫和 134 份文本资源的无损转换；CLI 查询准备、技能及资源正文保留；加载器使用便携 -O3。新增六个经函数摘要核验的纯正文格式化缓存，每个工厂保留最近一次原始条件与文本，单项 UTF-8 键和值 ≤64 KiB，动态读取和外层钩子保留；详细边界见 [静态复用记录](./static-text-reuse.md)。ICU 与固定 BCJ2/LZMA2 加载路线沿用已验证合同。

## 原版与候选行为

- 单元 55、集成 17、原版原生 27、候选原生 27、浏览器 3，共 129 项自动化用例通过；类型检查与基本构建另行执行。
- 原版及候选各 425 个原生断言，每方 40 份实际 TLS 接收正文独立核验 CCH，全部 40 份正文与头部另作两份入口的完整对照。构造/初始化没有模型发送，实际每轮至多一次发送，真实上游转发为 0。已拒绝合成密钥的连续两次请求均保持 native_configuration/503、拒绝记录不变且不发送。
- 缺省工具、显式空列表及自定义列表的单 PID 交替调用正常；缺省 system、业务替换、空文本与空数组正常。默认 Bash tool_use 原样返回，未创建合成 touch 文件或继续模型轮次。
- 六类关联、主/子代理压缩、工具/thinking 历史、Unicode、流/非流、HTTP/SSE 错误、取消、空闲及流中崩溃后的重建通过。
- 新增暖进程切换 Sonnet/Opus/Haiku、默认/空/自定义工具并恢复原条件的验证；PID 不变，恢复后的非 billing system 与原始输入一致。静态命中仍执行条件读取，失败、条件变化与超限不污染缓存。
- 传输失败与采集消费者失败均收口并退役；下一请求重建，不重放失败作业、不接收迟到事件。响应保持原始逻辑字节，SDK 不接收 Response。
- 五个业务输入与四个对应真实 PTY 主样本完成全字段比较。动态 UUID、CCH、长度及专用路径均先独立验证再定点归一化；工具、静态 system、消息块、模型参数及实际头部无额外忽略项。
- 当前实际 memfd 与原版另做 108 组分词、24 组 Unicode 规范化对照，覆盖默认/en/zh/ja/th/ar、组合字符和 emoji，结果一致；不将其扩大为保留全部 locale 定制输出的承诺。

原生绑定与限制见 [native-bindings.md](./native-bindings.md)，基线条件与九次参考/十四份原文见 [cli-baseline.md](./cli-baseline.md)。

## 历史五轮固定 HTTP 配对

下表为旧相对速度规则的实际结果。用户现已取消该速度准入；原始 summary.json 的 passed=false 和下表结论不修改。

两方各五个新进程，每进程六轮，奇偶轮反转顺序。相同业务输入、同一回环 HTTP SSE 上游及 739 B 响应，独立 HOME/config/cwd、合成密钥，unshare 网络空间仅启用回环；无压缩任务并行。共 60 次本地模型路径请求，每轮一次，无重放。

| 中位指标 | 候选 | 标杆 | 比值 | 结论 |
| --- | ---: | ---: | ---: | --- |
| 启动至首轮完整完成 | 3238.330 ms | 2959.781 ms | 1.094111 | 通过 |
| 就绪至首轮完整完成 | 50.993 ms | 94.134 ms | 0.541703 | 通过 |
| 后续五轮暖复用 | 33.782 ms | 13.564 ms | 2.490476 | 未通过 |

就绪前初始化和解包均计入启动，不相加不同阶段的中位数。页缓存未清理，协议边界不含 HTTP 控制面或模型推理。候选作业后 RSS 中位 192888832 B，标杆 217006080 B；观测峰值分别为 194715648/240951296 B。候选 HOME 配置增量为 188 B，标杆 0 B，不是执行体磁盘展开。

静态复用前候选的两批完整五轮失败结果保存在 repairs/benchmark-repair/ 和 repairs/benchmark-repair-recheck/；当时主机出现其它项目编译负载，保留全部样本，不用跨批绝对时间宣称收益。新增同窗口旧/新/标杆三方五轮研究：旧/新暖中位为 32.088/31.172 ms，约减少 2.855%；主线程 CPU 为 29.240/27.403 ms，约减少 6.283%。该研究不替代上表正式两方验收，不承诺固定收益；当前暖指标仍失败。

新增工作量字段显示该 HTTP 夹具下候选正文 126888 B、system JSON 27973 B、27 个工具，标杆 6464/6065 B、无工具声明。这是同一 API 输入的不同默认装配，不能声称两方发送完全相同正文。

## TLS 条件补充诊断

此前 758ce54a 前候选保留官方目标地址，经固定本机 CONNECT/TLS 上游另做五轮同输入对照。前候选实际声明 13 个工具、正文 87836 B，标杆无工具声明、正文 6571 B；暖复用中位仍为标杆 2.964 倍。该批的绝对时间明显不同，保留全部原样本，不与 HTTP 批次直接相减或据此宣称改进。

该历史诊断只区分自定义 HTTP 地址对默认装配的影响，不替换原固定脚本或原样本。字节码探针也没有证明暖收益；去掉第二个 SDK、重复正文编码/扫描及协议解码后，固定候选仍未达到旧目标。排查假设、失败尝试和预防措施见 [debug-analysis.md](./debug-analysis.md)。用户现在接受延迟，不继续追赶该目标，也不据此声称它绝对不可能。

## 独立部署与重复构建

在私有挂载/网络命名空间隐藏官方源、整个项目（包含 src/scripts/node_modules/runtime/artifacts）及全部旧 /tmp，仅给观测端留一份复制的候选。候选通过已核验 FD 启动，实际 /proc 执行体 SHA/字节数匹配，完成一次包含默认 CLI 工具和 Unicode 的请求及正常 shutdown。只观测到约 189 B 本地确认配置增量，未观测到完整执行体磁盘展开。该次为功能/文件系统验证，不作为性能样本。

两个独立临时目录以相同工具、源码和配方生成相同分发字节数/SHA，执行体清单身份也相同；闭包审计数组按条目集合比较完全一致。实际执行体身份同时由原生回归、配对和独立部署核对，不能仅信任 manifest。

## 最终采样与页面

独立 Node.js HTTPS 接收端先用原始 TLS 请求验证大小写、顺序和重复头的保留，再采集 14 个场景。Bun 兼容层探针确实把头名小写化，不能把它的 rawHeaders 当成未变化的原始头；新的演示样本使用独立 Node 接收端。

14 份最终正文 CCH 独立验证，正文与 cc_prepared 的差异仅为原生写入的五位 CCH。日志分别标明中间值和 offline_tls_receiver；表示为去除 HTTP 分块框架后的实体正文，不称为 TLS 密文。真实上游转发为 0。

静态复用候选的 14 条日志已追加到现有预览库，原有 38 条详情的完整投影 SHA 保持不变。桌面及手机浏览器验证总计 52 条、每页 50 条及第二页 2 条，CLI 身份、原始采样来源、最终 CCH、脱敏、历史 SDK 标识及页面宽度正常，无页面错误。健康接口 nativeFinalCapture 继续为 false。

预览为 http://127.0.0.1:8787/，可打开 wire-final-tls-static-cli-default → 原始数据 → 最终出站采样。

## 证据位置

完整原始证据保存在被忽略的 artifacts/cli-alignment-20261105T064401Z：

| 证据 | 相对该目录的路径 |
| --- | --- |
| 交互参考与 CCH | cli-approved-*、cli-terminal-default、verify-baseline.mjs |
| 原版原生实际接收及完整对照 | static/bridge-original/{requests,comparison}.json |
| 候选原生实际接收及完整对照 | static/final/bridge-compact/{requests,comparison,all-requests-comparison}.json |
| 固定性能 | static/final/benchmark/{samples,summary}.json |
| 同窗口旧/新/标杆研究 | static/final/benchmark-ab/{samples,summary}.json |
| TLS 条件诊断 | benchmark-tls-context/{samples,summary}.json |
| 独立部署 | static/final/deployment-report.json、deployment-probe.ts、static/final/verify-deployment.mjs |
| 重复构建 | static/final/reproducibility.json |
| 原始头兼容层探针 | raw-headers-probe.json |
| 当前执行体 Unicode/Intl 对照 | static/final/intl-verification.json |
| 独立 Node 最终样本 | static/final-tls-static/{summary.json,cases/,conditions-*.json} |
| 预览导入与浏览器 | static/preview-import.json、static/browser-verification.json、static/cli-final-{desktop,mobile}.png |
| 当前定向安全验证 | safety-review/unit.log |

manifest 为 runtime/claude-293-cli-static-final.manifest.json，重复产物为同前缀加 -repeat。原始专有源码、二进制、提示词、完整采样和合成配置不提交 Git；本页只记录合同、统计和身份。

## 验收对应与后续

| 条目 | 状态 |
| --- | --- |
| A1 原版交互及打印差异 | 通过 |
| A2 省略/空/显式工具、匹配的 CLI 正文和替换 | 本轮两份入口通过，省略不注入内置声明 |
| A3 六类关联与实际归因 | 通过已公开的单轮分类边界 |
| A4 两份入口原生回归及单次发送 | 本轮各 28 项通过，40 对完整出站一致 |
| A5 多轮隔离与故障恢复 | 通过 |
| A6 产物身份、部署体积与计时记录 | 新哈希、体积、重复构建、独立部署和计时记录完成；无相对速度准入 |
| A7 最终样本、历史与页面 | 新 14 条追加，原 52 条保持，66 条页面验证通过 |

保留旧 CHK-001 的 P1、用户接受及旧哈希速度失败结论；用户已取消该相对速度准入，不把旧数据套到新产物，也不记为性能修复。full Check-All、Spec 评估及确认计划中的业务提交/推送已完成，最终任务完成态及 Close 结果由 task.json 记录，任务记录按已确认范围同步。

# 缓存策略与第一方遥测验收

## 范围与默认行为

- CCRB_CACHE_POLICY 默认 preserve，可选 sub2api；CCRB_TELEMETRY 默认 off，可选 on。控制配置经只读 health、引擎白名单及 worker 握手贯通，调用方同名头不能覆盖。
- sub2api 保守保留调用方消息断点、根缓存、system/tools TTL 与 scope；只在预算和候选明确时应用尾部选点。原生传输持有最终 CCH，不改业务正文或 thinking 签名。
- on 连接固定 293 的第一方采集、鉴权和批处理，先完成本地 bootstrap；按业务异步作用域、官方资格、采样、模型目录及脱敏规则采集。后台处理及同步重入保护不进入模型响应等待链。
- health 的 initialized 仅代表 logger 初始化，不能说明已上传。自动更新、错误上报、远程功能配置和第三方 exporter 保持关闭。

## 固定身份与重复构建

官方来源仍为 2.1.293 / Bun 1.4.3，252755128 B，SHA256 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978；本轮未修改来源。

| 对象 | 大小 B | SHA256 |
| --- | ---: | --- |
| runtime/claude-293-cache-telemetry-release | 27383864 | 20f3cb6d928aaf9c863275a02a99a4244fa6db7e5a6b1e957af8bedf1a2605f9 |
| 实际 memfd 执行体 | 112831672 | 67a49e01124d189620ce630c198f0c3db074649ebe93e895d4a87ca8c80966f2 |

与 -repeat 在两个独立构建目录生成，外层、执行体、来源、原生节及配方一致；22 份桥接构建输入摘要匹配当前源码。配方 9，固定本机 7-Zip 26.05 工具及 SDK，未下载依赖。分发体积 26.12 MiB，低于 27933052 B 上限，余量 549188 B；执行体 107.60 MiB 为内存文件，不计作磁盘节省或 RSS。

独立验收完成后才将确切身份加入 compact-profile，旧 cache-policy 和 native-ingress-release 身份保留。外部 manifest 不能增加授信，显式开启旧产物不支持的能力时发送前失败。

## 最终回归

证据根目录：artifacts/cache-telemetry-controls-20261106/，为被忽略的本地验收产物，不提交原生正文、二进制或提取源码。

| 命令或专项 | 最终结果 | 证据 |
| --- | --- | --- |
| bun run typecheck | 通过 | final-typecheck.log |
| bun run build | 通过 | final-build-entry.log |
| bun run test | 101 项通过 | final-unit.log |
| 精简身份登记后的 profile 定向验证 | 1 项通过，复用上述套件覆盖，不重复计数 | final-profile.log |
| bun run test:integration | 17 项通过 | final-integration.log |
| bun scripts/test-native.ts | 52 项通过 | release-original-verified.log |
| CCRB_TEST_CLAUDE_BINARY 指定最终精简文件的同一原生套件 | 52 项通过 | release-compact-verified.log |
| bun run test:ui | 5 项通过 | final-ui.log |
| 两次独立构建与当前输入摘要核验 | 一致 | release-reproducibility.json |
| 隐藏构建输入的独立部署 | preserve/off、sub2api/on 各四轮通过 | deployment-report.json |
| 默认/en/zh/ja/th/ar 的分词、规范化 | 108 + 24 组与原版一致 | intl-verification.json |
| libxxhash.so.0 独立 CCH 核验 | 原版 80、精简 80、独立部署 8，合计 168 份匹配 | release-cch-check.json |

原生测试由 scripts/test-native.ts 建立 unshare --net，只启用回环；所有身份、凭据、HOME/config 均独立合成。原版与精简分别保存 66 份可读取且无 captureError 的业务日志，实际模型请求每作业一次，不产生额外 bootstrap 模型请求。其他 API 路径及明文 HTTP forward 请求为零；生产 wire_final 能力仍为 false。

首次精简套件为 34 通过 / 18 失败，captureError 明确为日志队列上限，失败样本保留于 release-compact/ 与 release-compact.log。测试矩阵在每轮响应计时后排空异步日志队列并检查无错误，随后两份完整套件均通过；未扩大生产队列、改为响应等待写盘或放松日志断言。早期未调用官方网络初始化 Jb 的遥测失败证明也保留，不算入最终通过。

## 四种组合与故障

下表为每份最终原生套件中的独立专用进程；每组两个模型作业，均核对最终 CCH、原始响应、业务会话和 cli 入口。

| 缓存 / 遥测 / 接收器 | 模型请求 | 遥测批次 | 实际状态 |
| --- | ---: | ---: | --- |
| preserve / off / 正常 | 2 | 0 | off |
| sub2api / off / 正常 | 2 | 0 | off |
| preserve / on / 正常 | 2 | 1 | initialized |
| sub2api / on / 正常 | 2 | 1 | initialized |
| preserve / on / 500 | 2 | 1 次尝试 | initialized，不能称为上传成功 |
| preserve / on / 慢响应 5 秒 | 2 | 1 次尝试 | initialized，有界关闭 |
| on / 取消后重建 | 2 | 1 | 退役后 pending，新 worker initialized |

两种运行时实收事件由真实构造路径产生，例如 tengu_api_query、tengu_api_cache_breakpoints；不补造 tengu_init/api_success 或进程指标。设备为专用 e×64，上传会话只属于业务，bootstrap 与迟到作用域不混入。500 和慢响应不触发模型重试；慢响应时原版/精简暖请求为 40.857/40.090 ms，关闭为 1023.702/1053.468 ms。开启后的取消与退役约 26.864/26.411 ms，下一轮重新初始化，模型内容及遥测会话独立。

suppressed、原生初始化异常、非法配置、旧 worker 缺能力及畸形握手另由单元/协议边界验证。默认关闭状态不调用初始化、采集和退出上传；最多跟踪 128 个进行中的原生采集承诺，退出总预算 1000 ms。

## 独立部署与时延

独立挂载/网络空间隐藏官方源、整个项目及旧 /tmp；观察器与可执行文件独立拷贝，/tmp 限制 16 MiB。两组各四次模型请求及 shutdown 成功，/proc 实际执行体与登记身份一致，仅观测到 189 B 配置增量，没有完整运行时磁盘展开。off 零上传，on 实收一批，初始化前零上传。所有域名仅转到本机 TLS 接收器，真实上游请求为零。

默认 preserve/off 的固定协议性能脚本交错执行两方各五个新进程、每进程六轮，共 60 次本机 HTTP SSE 模型请求。页缓存未清理，无并行压缩，不含 HTTP 控制面、日志及模型推理。

| 指标 | 当前精简中位数 |
| --- | ---: |
| 启动至 worker_ready | 2805.860 ms |
| 启动至首轮完整完成 | 2833.758 ms |
| 就绪后首轮 | 28.160 ms |
| 暖复用 | 18.519 ms |
| 作业后 RSS | 187654144 B |
| 专用配置增量 | 188 B |

ready 中位数从五份 ready_ms 直接求得，不以两个阶段中位数相减。候选正文 35413 B、工具数零；固定 SHA 8484c4c… 标杆正文 6464 B、未声明工具。旧 ≤1.10 诊断暖比值 1.692，passed=false、退出 1，完整保留 release-benchmark/{samples,summary}.json 与日志；用户已取消相对速度门槛，本轮不以不同批次数据宣称提速。独立部署的 TLS 总首轮另含观察器 /proc 哈希核验，不能与裸协议数字直接相减。

## 保留项与交付状态

- 两个参考仓库 HEAD 与工作区保持原样：vm2api e0fbed172c40721bd68d7d9d5d8a53a4205b1e0c；cc2api 47e75ef4a1e982e2693edab81d5387eedb6adf40。
- 基线 pycache SHA256 仍为 2cc351928a54cd8f205b59eee416ba130f9e5b802b1ecd62ab4a95c9a259ab5c；既有预览进程与历史数据未作测试写入。
- 未使用真实账号、未付费推理、未访问真实模型或遥测上游。真实 OAuth/账号策略环境不在本轮验收范围。
- 本地实现和验收已完成，full Check-All strict pass、Spec written。用户确认精确 Git 计划后，业务变更与两个子任务记录已分别提交推送，子任务均 completed + Close；本次父任务记录同步最终集成验收、完成态及 Close。

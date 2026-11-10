# 固定 293 终端 CLI 的离线基线

> 当前工具规则更新：用户已确认省略 tools 与 [] 均无工具。下文保留真实 CLI 缺省工具池及最初决定的历史；本轮对照使用 --tools 空值，当前证据见 [验收记录](./acceptance.md)。

## 目标与方法

用户要求对齐终端 CLI 的真实请求行为。本次直接运行未修改的固定官方 2.1.293，使用真实 PTY、独立 HOME/config/cwd、合成 API key 和本机 CONNECT/TLS 接收器。仅启用新网络命名空间的回环，代理固定连接本机接收器，不解析或转发公网目标。没有注入 BUN_OPTIONS，也没有替换 fetch。

固定来源 SHA256 为 8968405e26db478af44eabc4635ab5ca557057b702a54460a59c13e1b253e978，实验后保持不变。工具选择、提示词及功能门控依赖模型、权限、配置与项目环境，下列数字只对应当前干净环境的实测，不能硬编码为所有 CLI 的通用结果。

## 已验证结果

| 入口 | 身份前缀类别 | entrypoint | turn_origin | 初始工具声明 | 本地请求数 |
| --- | --- | --- | --- | ---: | ---: |
| 交互终端主请求 | 官方 CLI | cli | human | 13 | 1 个主请求 |
| 交互终端标题生成 | 官方 CLI | cli | 未携带 | 0 | 1 个 auxiliary |
| -p 默认 | Agent SDK | sdk-cli | sdk | 12 | 1 |
| -p 追加业务 system | CLI within SDK | sdk-cli | sdk | 12 | 1 |
| -p 显式空工具 | Agent SDK | sdk-cli | sdk | 0 | 1 |
| -p 自定义 system | Agent SDK | sdk-cli | sdk | 12 | 1 |

五个启动场景共六次本机模型路径请求，所有最终 CCH 均独立核验通过；真实上游请求为 0，成功连接只指向回环。交互式参考进程另有 8 次面向公网 DNS 的 connect 尝试，均返回 ENETUNREACH，被隔离网络阻断；不能将“没有成功外连”表述为“没有外连尝试”。全部参考进程已关闭。交互式终端主请求与标题辅助请求明确区分，不能把辅助调用漏算或宣称每次完整 CLI 启动只有一次请求。

目标主请求的身份为 `You are Claude Code, Anthropic's official CLI for Claude.`，User-Agent 为 `claude-cli/2.1.293 (external, cli)`。主请求正文为 90502 B，四个 system 块分别为 190、57、10682、16766 B；最终 CCH=0022e。这些字节数与哈希是观察证据，不是构造常量。

主请求初始工具为 Agent、AskUserQuestion、Bash、Edit、ListAgents、Read、ReportFindings、ScheduleWakeup、Skill、ToolSearch、Workflow、DeferredToolPlaceholder、Write。用户消息还包含环境、模型说明、延迟工具、代理类型、技能、权限模式、时间及归因等运行时上下文。仅补上一句 CLI 身份文本不能获得这套装配。

## 开工时桥接的差异（e68722f）

- src/runtime/293/job.ts:67 将用户消息 turnOrigin 固定为 sdk，:96–97 固定非交互选项；:81 只传业务 system，:87 没有原生默认工具。
- src/control/header-policy.ts:71 的普通主请求 querySource 固定为 sdk；原版交互入口有独立的 repl_main_thread 来源生成器。
- src/control/engine.ts:208 虽已设置 entrypoint=cli，但仍添加 SDK client-app 标识；它与默认终端 User-Agent 的组成不同。
- 当前已有的 TLS 样本证明 CCH、头部与已支持正文可发送，但不能证明系统提示词、工具环境和默认值与终端 CLI 一致。
- 默认模型参数也应从原生 CLI 装配核对。本次主请求包含 max_tokens=32000、adaptive thinking、effort=high、context_management、safeguards；调用方显式参数需要保留，并明确与参考 CLI 的等价配置，不把不同输入的差异一律归一化。

## 已定位的原生边界

- 版本专属提示词选择器 Nrr 由 isNonInteractiveSession、hasAppendSystemPrompt 和 recordedCliPrefix 决定身份前缀；模型提供方还存在单独分支。
- 核心模块中已读取并确认导出的 VA(e,n,r)，它经内部 LVt 装配默认 system 的共享与会话段；模型、工具、动态环境、权限与配置会影响结果。后续适配必须继续读取调用链和参数定义后再调用，不能直接复制录制文本。
- chunk-57d0836j.js 的 u1e() 按真实输出风格生成 repl_main_thread 来源；默认工具池、会话环境及消息提醒需进一步追踪同一 CLI 主循环的构造入口。
- 标题生成来自独立辅助路径。单轮桥接继续只执行调用方本轮模型请求，不为对齐主请求额外启动标题或建议推理；这项边界需要在最终 Brief 中明确。

## 原始证据与边界

摘要保存在 cli-baseline-summary.json。原始数据位于本机被忽略的 artifacts/cli-alignment-20261105T064401Z，包括两份 CLI 启动脚本、PTY 驱动、逐请求正文/头部、终端输出、network trace、帮助与 CCH 校验脚本。完整默认提示词、工具描述和官方提取源码不提交。

最初三次 PTY 尝试分别停在目录信任或合成 API key 确认，没有模型请求，已保留失败现场。最后只对隔离的空目录预置版本已定义的信任配置，并在终端确认合成 key，取得正常主请求及辅助请求；没有修改宿主账号或项目产品代码。

## 已确认的接口行为

用户已确认推荐规则：省略 tools 时采用原生 CLI 默认工具，显式传入时完整使用该列表，显式 [] 表示无工具，不叠加 CLI 内置工具。这样保留调用方对可用工具的控制，避免模型选择调用方未声明实现的工具。提示词、延迟工具目录和提醒均应与实际工具集一致，不能只改出站数组。本轮继续不在本机自动执行工具。

## 同配置交互参考与原生装配验证

新增四个真实 PTY 场景：预先在专用配置确认同一合成密钥，分别使用默认、--tools ''、--system-prompt 业务正文、--system-prompt ''。这四次共八份最终 TLS 正文全部独立验证 CCH，包含四个主请求和四个标题 auxiliary。加上上表五次场景，现有九次参考启动、十四份正文；来源 SHA256 再次核验未变。新增场景使用同样的网络命名空间及固定回环代理，没有另录系统调用 trace，不宣称没有外连尝试。

预先确认密钥的主请求使用默认权限，没有 auto 的 safeguards 或权限提醒；首次终端确认的样本进入 auto，必须作为另一配置分支保存。桥接控制配置明确提供的合成 API key 按官方本地规则确认，与预先确认场景比较，不通过强制权限模式或删除 safeguards 消除差异。

原生最小装配边界已跑通：vwo/REr 选择 CLI 交互和 markdown 问题预览，Hoe/$8e 注册内置定义；XUr/JUr/dmn/B1e 生成权限，OD/k0t/$0t/F0t 生成工具池；yF/rs/f9e/rg 等生成每轮状态。pie 生成初始原生附件，OM 装配日期、归因和其余上下文，受控 deps.callModel 进入 K_t，并在 fetchOverride 中止。低层 K_t 单独调用不会完成这些 CLI 提醒。

原版桥接和当前精简候选各通过 25 项原生回归。五个主请求输入（默认、无工具、业务 system、空文本 system、空数组 system）与四个对应 PTY 主样本完成全字段对照，工具、静态提示词、全部消息块、默认模型参数和实际头部一致；本次每方三十四份桥接 TLS 正文均独立核验 CCH。只归一化经过关联校验的 session/prompt/request UUID、已独立核验的 CCH/Content-Length、环境提醒里的专用 cwd、与 cwd 编码一致的 config/projects 目录；没有删除其他 system 或消息差异。当前精简候选的相同行为验证已通过，独立部署与重复构建也通过；性能未达到既定门槛，详见 acceptance.md。

对照脚本为 artifacts/cli-alignment-20261105T064401Z/compare-bridge.mjs，参考核验为 verify-baseline.mjs；原版实际接收及比较报告位于 bridge-original-optimized/{requests,comparison}.json 及 bridge-compact-candidate/{requests,comparison}.json。完整默认提示词仍只在被忽略的证据目录。
